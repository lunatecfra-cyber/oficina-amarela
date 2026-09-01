import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionApproval } from "./mission-approval.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 da aprovação de missão", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-approval-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let approval: ReturnType<typeof createD1MissionApproval>;
  let missionId: number;
  let spokespersonId: number;
  let otherSpokespersonId: number;
  let editorId: number;
  let adminId: number;

  before(async () => {
    db = await miniflare.getD1Database("DB");
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    approval = createD1MissionApproval(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM admin_audit"),
      db.prepare("DELETE FROM referral_rewards"),
      db.prepare("DELETE FROM ranking_approvals"),
      db.prepare("DELETE FROM ranking_cycles"),
      db.prepare("DELETE FROM reviews"),
      db.prepare("DELETE FROM mission_approvals"),
      db.prepare("DELETE FROM reports"),
      db.prepare("DELETE FROM messages"),
      db.prepare("DELETE FROM offers"),
      db.prepare("DELETE FROM missions"),
      db.prepare("DELETE FROM users"),
    ]);
    const ids: number[] = [];
    for (const [handle, role] of [
      ["voz.aprova.d1", "voz"],
      ["voz.aprova.d1.outra", "voz"],
      ["editor.aprova.d1", "editor"],
      ["admin.aprova.d1", "admin"],
    ]) {
      const user = await db
        .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
        .bind(handle, handle, `${handle}@teste.local`, role)
        .first<{ id: number }>();
      ids.push(user?.id as number);
    }
    [spokespersonId, otherSpokespersonId, editorId, adminId] = ids;
    const mission = await db
      .prepare(
        "INSERT INTO missions (spokesperson_id, title, format, status, reserved_by_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
      )
      .bind(spokespersonId, "Missão aprovada no D1", "short", "em_revisao", editorId)
      .first<{ id: number }>();
    missionId = mission?.id as number;
    await db
      .prepare("INSERT INTO ranking_cycles (name, starts_at, ends_at) VALUES (?, ?, ?)")
      .bind("Ciclo D1", "2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z")
      .run();
  });

  after(() => miniflare.dispose());

  test("duas aprovações concorrentes pontuam uma única vez", async () => {
    const input = {
      missionId,
      actor: { id: adminId, role: "admin" as const },
      rating: 5,
      comment: "Excelente",
    };
    const results = await Promise.all([
      approval.approveMission(input),
      approval.approveMission(input),
    ]);
    assert.equal(
      results.every((result) => result.ok),
      true,
    );
    assert.equal(results.filter((result) => result.ok && result.scored).length, 1);

    const editor = await db
      .prepare("SELECT delivered_count, reputation, streak, rating FROM users WHERE id = ?")
      .bind(editorId)
      .first();
    const counts = await db
      .prepare(
        `SELECT
           (SELECT count(*) FROM reviews WHERE mission_id = ?) AS reviews,
           (SELECT count(*) FROM ranking_approvals WHERE mission_id = ?) AS ranking,
           (SELECT count(*) FROM admin_audit WHERE entity_id = ?) AS audit`,
      )
      .bind(missionId, missionId, String(missionId))
      .first();
    assert.deepEqual(editor, { delivered_count: 1, reputation: 25, streak: 1, rating: 5 });
    assert.deepEqual(counts, { reviews: 1, ranking: 1, audit: 1 });
  });

  test("porta-voz precisa ser proprietária e finaliza a missão", async () => {
    assert.deepEqual(
      await approval.approveMission({
        missionId,
        actor: { id: otherSpokespersonId, role: "spokesperson" },
      }),
      { ok: false, reason: "forbidden" },
    );
    const result = await approval.approveMission({
      missionId,
      actor: { id: spokespersonId, role: "spokesperson" },
      rating: 4,
    });
    assert.equal(result.ok, true);
    const mission = await db
      .prepare("SELECT status, is_scored FROM missions WHERE id = ?")
      .bind(missionId)
      .first();
    assert.deepEqual(mission, { status: "finalizada", is_scored: 1 });
  });

  test("nota inválida não grava o evento idempotente", async () => {
    assert.deepEqual(
      await approval.approveMission({
        missionId,
        actor: { id: adminId, role: "admin" },
        rating: 0,
      }),
      { ok: false, reason: "invalid_rating" },
    );
    assert.equal(
      await db.prepare("SELECT count(*) AS total FROM mission_approvals").first("total"),
      0,
    );
  });
});
