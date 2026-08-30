import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

describe("aprovação atômica de missão", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("./client.ts");
  const { postgresMissionApproval } = await import("./mission-approval.ts");
  let missionId: number;
  let spokespersonId: number;
  let otherSpokespersonId: number;
  let editorId: number;
  let adminId: number;

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    await sql`TRUNCATE users RESTART IDENTITY CASCADE`;
    const users = await sql`
        INSERT INTO users (apelido, nome, email, papel)
        VALUES
          ('voz.aprova', 'Voz Aprova', 'voz.aprova@teste.local', 'voz'),
          ('voz.aprova.outra', 'Outra Voz', 'outra.voz.aprova@teste.local', 'voz'),
          ('editor.aprova', 'Editor Aprova', 'editor.aprova@teste.local', 'editor'),
          ('admin.aprova', 'Admin Aprova', 'admin.aprova@teste.local', 'admin')
        RETURNING id
      `;
    [spokespersonId, otherSpokespersonId, editorId, adminId] = users.map(
      (user) => user.id as number,
    );
    const [mission] = await sql`
        INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id)
        VALUES (${spokespersonId}, 'Missão para aprovar', 'short', 'em_revisao', ${editorId})
        RETURNING id
      `;
    missionId = mission.id as number;
    await sql`
        INSERT INTO ranking_ciclos (nome, inicia_em, termina_em, criado_por)
        VALUES ('Ciclo de teste', now() - interval '1 day', now() + interval '1 day', ${adminId})
      `;
    await Promise.all([sql`SELECT 1`, sql`SELECT 1`, sql`SELECT 1`, sql`SELECT 1`]);
  });

  after(async () => {
    await sql`TRUNCATE users RESTART IDENTITY CASCADE`;
  });

  test("duas aprovações concorrentes pontuam exatamente uma vez", async () => {
    const input = {
      missionId,
      actor: { id: adminId, role: "admin" as const },
      rating: 5,
      comment: "Excelente",
    };
    const results = await Promise.all([
      postgresMissionApproval.approveMission(input),
      postgresMissionApproval.approveMission(input),
    ]);
    assert.equal(
      results.every((result) => result.ok),
      true,
    );
    assert.equal(results.filter((result) => result.ok && result.scored).length, 1);

    const [editor] = await sql`
        SELECT entregues, reputacao, streak, nota::float8 AS nota FROM users WHERE id = ${editorId}
      `;
    const [counts] = await sql`
        SELECT
          (SELECT count(*)::int FROM avaliacoes WHERE pauta_id = ${missionId}) AS avaliacoes,
          (SELECT count(*)::int FROM ranking_aprovacoes WHERE pauta_id = ${missionId}) AS ranking,
          (SELECT count(*)::int FROM auditoria_admin
           WHERE entidade = 'pauta' AND entidade_id = ${String(missionId)}) AS auditoria
      `;
    assert.deepEqual(editor, { entregues: 1, reputacao: 25, streak: 1, nota: 5 });
    assert.deepEqual(counts, { avaliacoes: 1, ranking: 1, auditoria: 1 });
  });

  test("somente a porta-voz proprietária pode finalizar", async () => {
    assert.deepEqual(
      await postgresMissionApproval.approveMission({
        missionId,
        actor: { id: otherSpokespersonId, role: "spokesperson" },
        rating: 4,
      }),
      { ok: false, reason: "forbidden" },
    );
    const approved = await postgresMissionApproval.approveMission({
      missionId,
      actor: { id: spokespersonId, role: "spokesperson" },
      rating: 4,
    });
    assert.equal(approved.ok, true);
    const [mission] = await sql`SELECT status FROM pautas WHERE id = ${missionId}`;
    assert.equal(mission.status, "finalizada");
  });

  test("nota inválida falha antes de alterar estado", async () => {
    assert.deepEqual(
      await postgresMissionApproval.approveMission({
        missionId,
        actor: { id: adminId, role: "admin" },
        rating: 6,
      }),
      { ok: false, reason: "invalid_rating" },
    );
    const [mission] = await sql`SELECT status, pontuada FROM pautas WHERE id = ${missionId}`;
    assert.deepEqual(mission, { status: "em_revisao", pontuada: false });
  });
});
