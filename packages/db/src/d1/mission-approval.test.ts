import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionApproval } from "./mission-approval.ts";
import { applyD1Schema } from "./schema.ts";
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
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db as unknown as D1DatabaseLike, schema);
    approval = createD1MissionApproval(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM auditoria_admin"),
      db.prepare("DELETE FROM indicacoes_recompensas"),
      db.prepare("DELETE FROM ranking_aprovacoes"),
      db.prepare("DELETE FROM ranking_ciclos"),
      db.prepare("DELETE FROM avaliacoes"),
      db.prepare("DELETE FROM mission_approvals"),
      db.prepare("DELETE FROM denuncias"),
      db.prepare("DELETE FROM mensagens"),
      db.prepare("DELETE FROM ofertas"),
      db.prepare("DELETE FROM pautas"),
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
        .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
        .bind(handle, handle, `${handle}@teste.local`, role)
        .first<{ id: number }>();
      ids.push(user?.id as number);
    }
    [spokespersonId, otherSpokespersonId, editorId, adminId] = ids;
    const mission = await db
      .prepare(
        "INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
      )
      .bind(spokespersonId, "Missão aprovada no D1", "short", "em_revisao", editorId)
      .first<{ id: number }>();
    missionId = mission?.id as number;
    await db
      .prepare("INSERT INTO ranking_ciclos (nome, inicia_em, termina_em) VALUES (?, ?, ?)")
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
      .prepare("SELECT entregues, reputacao, streak, nota FROM users WHERE id = ?")
      .bind(editorId)
      .first();
    const counts = await db
      .prepare(
        `SELECT
           (SELECT count(*) FROM avaliacoes WHERE pauta_id = ?) AS avaliacoes,
           (SELECT count(*) FROM ranking_aprovacoes WHERE pauta_id = ?) AS ranking,
           (SELECT count(*) FROM auditoria_admin WHERE entidade_id = ?) AS auditoria`,
      )
      .bind(missionId, missionId, String(missionId))
      .first();
    assert.deepEqual(editor, { entregues: 1, reputacao: 25, streak: 1, nota: 5 });
    assert.deepEqual(counts, { avaliacoes: 1, ranking: 1, auditoria: 1 });
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
      .prepare("SELECT status, pontuada FROM pautas WHERE id = ?")
      .bind(missionId)
      .first();
    assert.deepEqual(mission, { status: "finalizada", pontuada: 1 });
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
