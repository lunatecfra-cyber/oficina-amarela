import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach, describe } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionLifecycle, type D1DatabaseLike } from "./mission-lifecycle.ts";
import { applyD1Schema } from "./schema-test-helper.ts";

describe("paridade local D1 da missão", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-mission-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );

  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let missions: ReturnType<typeof createD1MissionLifecycle>;
  let spokespersonId: number;
  let editorId: number;

  before(async () => {
    db = await miniflare.getD1Database("DB");
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db as unknown as D1DatabaseLike, schema);
    missions = createD1MissionLifecycle(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM ofertas"),
      db.prepare("DELETE FROM pautas"),
      db.prepare("DELETE FROM users"),
      db.prepare("DELETE FROM fila_emails"),
    ]);
    const spokesperson = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("voz.d1", "Voz D1", "voz.d1@teste.local", "voz")
      .first<{ id: number }>();
    const editor = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor.d1", "Editor D1", "editor.d1@teste.local", "editor")
      .first<{ id: number }>();
    spokespersonId = spokesperson?.id as number;
    editorId = editor?.id as number;
  });

  after(() => miniflare.dispose());

  async function createMission(status: string, reservedBy: number | null = null) {
    const mission = await db
      .prepare(
        "INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
      )
      .bind(spokespersonId, "Missão D1", "short", status, reservedBy)
      .first<{ id: number }>();
    return mission?.id as number;
  }

  test("mantém os mesmos motivos tipados do PostgreSQL", async () => {
    assert.deepEqual(await missions.finishMission(999_999, spokespersonId), {
      ok: false,
      reason: "mission_not_found",
    });
    const missionId = await createMission("em_revisao", editorId);
    assert.deepEqual(await missions.finishMission(missionId, spokespersonId), {
      ok: false,
      reason: "mission_not_awaiting_spokesperson",
    });
  });

  test("só uma entrega concorrente vence", async () => {
    const missionId = await createMission("reservada", editorId);
    const results = await Promise.all([
      missions.submitDelivery(missionId, editorId, {
        link: "https://video.example/um",
        videoUrl: null,
      }),
      missions.submitDelivery(missionId, editorId, {
        link: "https://video.example/dois",
        videoUrl: null,
      }),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(
      (results.find((result) => !result.ok) as { reason: string }).reason,
      "mission_not_held",
    );
  });

  test("reedição e conclusão preservam estado e autoria", async () => {
    const reviewId = await createMission("em_revisao", editorId);
    assert.deepEqual(await missions.requestInspectorRevision(reviewId, "  Corrigir áudio  "), {
      ok: true,
    });
    const review = await db
      .prepare("SELECT status, notas_inspetor, reedicao_pedida_por FROM pautas WHERE id = ?")
      .bind(reviewId)
      .first();
    assert.deepEqual(review, {
      status: "reedicao",
      notas_inspetor: "Corrigir áudio",
      reedicao_pedida_por: "inspetor",
    });

    await db.prepare("UPDATE pautas SET status = 'aprovada' WHERE id = ?").bind(reviewId).run();
    assert.deepEqual(await missions.finishMission(reviewId, spokespersonId), { ok: true });
  });

  test("os cinco índices duráveis recusam duplicatas", async () => {
    await createMission("reservada", editorId);
    await assert.rejects(() => createMission("reedicao", editorId), /UNIQUE constraint failed/);

    const otherEditor = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor.d1.outro", "Outro Editor D1", "editor.d1.outro@teste.local", "editor")
      .first<{ id: number }>();
    const otherEditorId = otherEditor?.id as number;
    const expires = "2099-01-01T00:00:00.000Z";

    const pairMissionId = await createMission("disponivel");
    await db
      .prepare(
        "INSERT INTO ofertas (pauta_id, editor_id, status, expira_em) VALUES (?, ?, 'expirada', ?)",
      )
      .bind(pairMissionId, editorId, expires)
      .run();
    await assert.rejects(
      () =>
        db
          .prepare(
            "INSERT INTO ofertas (pauta_id, editor_id, status, expira_em) VALUES (?, ?, 'rejeitada', ?)",
          )
          .bind(pairMissionId, editorId, expires)
          .run(),
      /UNIQUE constraint failed/,
    );

    const pendingMissionId = await createMission("disponivel");
    await db
      .prepare("INSERT INTO ofertas (pauta_id, editor_id, expira_em) VALUES (?, ?, ?)")
      .bind(pendingMissionId, editorId, expires)
      .run();
    await assert.rejects(
      () =>
        db
          .prepare("INSERT INTO ofertas (pauta_id, editor_id, expira_em) VALUES (?, ?, ?)")
          .bind(pendingMissionId, otherEditorId, expires)
          .run(),
      /UNIQUE constraint failed/,
    );

    const otherMissionId = await createMission("disponivel");
    await assert.rejects(
      () =>
        db
          .prepare("INSERT INTO ofertas (pauta_id, editor_id, expira_em) VALUES (?, ?, ?)")
          .bind(otherMissionId, editorId, expires)
          .run(),
      /UNIQUE constraint failed/,
    );

    await db.prepare("INSERT INTO fila_emails (chave) VALUES (?)").bind("missao:1").run();
    await assert.rejects(
      () => db.prepare("INSERT INTO fila_emails (chave) VALUES (?)").bind("missao:1").run(),
      /UNIQUE constraint failed/,
    );
  });
});
