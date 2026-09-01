import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach, describe } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionQueue } from "./mission-queue.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade local D1 da fila de missões", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-queue-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let now = new Date("2026-08-30T15:00:00.000Z");
  let queue: ReturnType<typeof createD1MissionQueue>;
  let spokespersonId: number;
  let editorIds: number[];

  before(async () => {
    db = await miniflare.getD1Database("DB");
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    queue = createD1MissionQueue(db as unknown as D1DatabaseLike, () => now);
  });

  beforeEach(async () => {
    now = new Date("2026-08-30T15:00:00.000Z");
    await db.batch([
      db.prepare("DELETE FROM offers"),
      db.prepare("DELETE FROM missions"),
      db.prepare("DELETE FROM users"),
      db.prepare("DELETE FROM email_queue"),
    ]);
    const spokesperson = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("voz.fila.d1", "Voz Fila D1", "voz.fila.d1@teste.local", "voz")
      .first<{ id: number }>();
    spokespersonId = spokesperson?.id as number;

    editorIds = [];
    for (let index = 1; index <= 3; index++) {
      const editor = await db
        .prepare(
          `INSERT INTO users (handle, name, email, role, last_seen_at)
           VALUES (?, ?, ?, 'editor', ?) RETURNING id`,
        )
        .bind(
          `editor.fila.d1.${index}`,
          `Editor Fila D1 ${index}`,
          `editor.fila.d1.${index}@teste.local`,
          new Date(now.getTime() - index * 1_000).toISOString(),
        )
        .first<{ id: number }>();
      editorIds.push(editor?.id as number);
    }
  });

  after(() => miniflare.dispose());

  async function createMission(status = "disponivel", reservedBy: number | null = null) {
    const mission = await db
      .prepare(
        `INSERT INTO missions (spokesperson_id, title, format, status, reserved_by_id)
         VALUES (?, 'Missão da fila D1', 'short', ?, ?) RETURNING id`,
      )
      .bind(spokespersonId, status, reservedBy)
      .first<{ id: number }>();
    return mission?.id as number;
  }

  async function createOffer(missionId: number, editorId: number, expiresAt?: string) {
    await db
      .prepare(
        `INSERT INTO offers (mission_id, editor_id, offered_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(
        missionId,
        editorId,
        now.toISOString(),
        expiresAt ?? new Date(now.getTime() + 5 * 60_000).toISOString(),
      )
      .run();
  }

  async function missionState(missionId: number) {
    return db
      .prepare("SELECT status, reserved_by_id FROM missions WHERE id = ?")
      .bind(missionId)
      .first<{ status: string; reserved_by_id: number | null }>();
  }

  test("uma reserva vence cada corrida de missão e editor", async () => {
    const missions = await Promise.all([createMission(), createMission(), createMission()]);
    const sameEditor = await Promise.all(
      missions.map((missionId) => queue.reserveMission(missionId, editorIds[0])),
    );
    assert.equal(sameEditor.filter((result) => result.ok).length, 1);
    assert.ok(
      sameEditor
        .filter((result) => !result.ok)
        .every((result) => result.reason === "already_holds_mission"),
    );

    const sharedMission = await createMission();
    const sameMission = await Promise.all(
      editorIds.slice(1).map((editorId) => queue.reserveMission(sharedMission, editorId)),
    );
    assert.equal(sameMission.filter((result) => result.ok).length, 1);
  });

  test("despacho, projeção e aceite preservam o contrato PostgreSQL", async () => {
    const missionId = await createMission();
    assert.equal(await queue.dispatchOffers(), 1);

    const offer = await db
      .prepare("SELECT editor_id, status FROM offers WHERE mission_id = ?")
      .bind(missionId)
      .first<{ editor_id: number; status: string }>();
    assert.equal(offer?.status, "pendente");
    assert.equal((await missionState(missionId))?.status, "oferecida");

    const pending = await queue.pendingOfferFor(offer?.editor_id as number);
    assert.equal(pending?.mission.id, `db-${missionId}`);
    assert.equal(pending?.mission.title, "Missão da fila D1");

    assert.deepEqual(await queue.acceptOffer(missionId, offer?.editor_id as number), { ok: true });
    assert.deepEqual(await missionState(missionId), {
      status: "reservada",
      reserved_by_id: offer?.editor_id,
    });
    assert.deepEqual(await queue.acceptOffer(missionId, offer?.editor_id as number), {
      ok: false,
      reason: "offer_invalid",
    });
  });

  test("aceite concorrente respeita a missão ativa do editor", async () => {
    const editorId = editorIds[0];
    assert.deepEqual(await queue.reserveMission(await createMission(), editorId), { ok: true });
    const offered = await createMission();
    await createOffer(offered, editorId);

    assert.deepEqual(await queue.acceptOffer(offered, editorId), {
      ok: false,
      reason: "already_holds_mission",
    });
    assert.deepEqual(await missionState(offered), {
      status: "oferecida",
      reserved_by_id: null,
    });
    const offer = await db
      .prepare("SELECT status FROM offers WHERE mission_id = ?")
      .bind(offered)
      .first<{ status: string }>();
    assert.equal(offer?.status, "pendente");
  });

  test("recusa e expiração liberam a missão no mesmo statement", async () => {
    const rejected = await createMission();
    await createOffer(rejected, editorIds[0]);
    assert.deepEqual(await queue.rejectOffer(rejected, editorIds[0]), { ok: true });
    assert.equal((await missionState(rejected))?.status, "disponivel");
    assert.deepEqual(await queue.rejectOffer(rejected, editorIds[0]), {
      ok: false,
      reason: "offer_invalid",
    });

    const expired = await createMission();
    await createOffer(expired, editorIds[1]);
    await db
      .prepare("UPDATE offers SET offered_at = ? WHERE mission_id = ?")
      .bind(new Date(now.getTime() - 5 * 60_000 - 1).toISOString(), expired)
      .run();
    assert.equal(await queue.expireOffers(), 1);
    assert.equal((await missionState(expired))?.status, "disponivel");
  });

  test("despachos concorrentes não deixam missão oferecida órfã", async () => {
    for (let index = 0; index < 5; index++) await createMission();
    const counts = await Promise.all([queue.dispatchOffers(), queue.dispatchOffers()]);
    const pending = await db
      .prepare("SELECT COUNT(*) AS total FROM offers WHERE status = 'pendente'")
      .first<{ total: number }>();
    const orphan = await db
      .prepare(
        `SELECT COUNT(*) AS total FROM missions p
         WHERE p.status = 'oferecida'
           AND NOT EXISTS (
             SELECT 1 FROM offers o WHERE o.mission_id = p.id AND o.status = 'pendente'
           )`,
      )
      .first<{ total: number }>();
    assert.equal(pending?.total, counts[0] + counts[1]);
    assert.equal(orphan?.total, 0);
  });

  test("disponibilidade e janela de presença evitam trabalho indevido", async () => {
    const unavailable = Array.from({ length: 3 }, () => Array(7).fill(false));
    await db
      .prepare("UPDATE users SET availability = ? WHERE id = ?")
      .bind(JSON.stringify(unavailable), editorIds[2])
      .run();
    const missionId = await createMission();
    assert.equal(await queue.dispatchOffers(), 1);
    const offer = await db
      .prepare("SELECT editor_id FROM offers WHERE mission_id = ?")
      .bind(missionId)
      .first<{ editor_id: number }>();
    assert.notEqual(offer?.editor_id, editorIds[2]);

    await db.prepare("UPDATE users SET last_seen_at = NULL WHERE id = ?").bind(editorIds[0]).run();
    await queue.markEditorActive(editorIds[0]);
    const first = await db
      .prepare("SELECT last_seen_at FROM users WHERE id = ?")
      .bind(editorIds[0])
      .first<{ last_seen_at: string }>();
    now = new Date(now.getTime() + 30_000);
    await queue.markEditorActive(editorIds[0]);
    const second = await db
      .prepare("SELECT last_seen_at FROM users WHERE id = ?")
      .bind(editorIds[0])
      .first<{ last_seen_at: string }>();
    assert.equal(second?.last_seen_at, first?.last_seen_at);
  });
});
