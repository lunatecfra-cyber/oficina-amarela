import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Gamification } from "./gamification.ts";
import { createD1MissionContacts } from "./mission-contacts.ts";
import { createD1RankingAdmin } from "./ranking-admin.ts";
import { applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 do ranking, gamificação e contatos", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-ranking-admin-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let admin: ReturnType<typeof createD1RankingAdmin>;
  let record: ReturnType<typeof createD1Gamification>;
  let contacts: ReturnType<typeof createD1MissionContacts>;
  let adminId: number;
  let editorId: number;
  let spokespersonId: number;
  let missionId: number;
  let cycleId: number;

  async function newUser(handle: string, papel: string, referrer?: number) {
    const row = await db
      .prepare(
        `INSERT INTO users (apelido, nome, email, papel, indicado_por_id)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(handle, handle, `${handle}@d1.local`, papel, referrer ?? null)
      .first<{ id: number }>();
    return Number(row?.id);
  }

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db, schema);
    admin = createD1RankingAdmin(db);
    record = createD1Gamification(db);
    contacts = createD1MissionContacts(db);
  });

  beforeEach(async () => {
    for (const table of [
      "auditoria_admin",
      "bloqueios_constancia",
      "gamificacao_eventos",
      "indicacoes_recompensas",
      "ranking_aprovacoes",
      "avaliacoes",
      "ranking_ciclos",
      "pautas",
      "users",
    ]) {
      await db.prepare(`DELETE FROM ${table}`).run();
    }
    adminId = await newUser("insp.d1", "admin");
    spokespersonId = await newUser("voz.d1", "voz");
    editorId = await newUser("ed.d1", "editor", spokespersonId);

    const mission = await db
      .prepare(
        `INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id, pontuada)
         VALUES (?, 'Missão D1', 'short', 'aprovada', ?, 1) RETURNING id`,
      )
      .bind(spokespersonId, editorId)
      .first<{ id: number }>();
    missionId = Number(mission?.id);

    const cycle = await db
      .prepare(
        `INSERT INTO ranking_ciclos (nome, inicia_em, termina_em)
         VALUES ('Ciclo D1', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')
         RETURNING id`,
      )
      .first<{ id: number }>();
    cycleId = Number(cycle?.id);

    await db
      .prepare(
        `INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_por, aprovado_em)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(missionId, cycleId, editorId, adminId, new Date().toISOString())
      .run();
    await db
      .prepare("UPDATE users SET entregues = 1, reputacao = 25, streak = 1 WHERE id = ?")
      .bind(editorId)
      .run();
  });

  after(() => miniflare.dispose());

  test("motivo em branco para antes de qualquer escrita", async () => {
    assert.deepEqual(await admin.cancelApproval(missionId, adminId, "  "), {
      ok: false,
      reason: "reason_required",
    });
    assert.deepEqual(await admin.grantConsistencyShield(editorId, adminId, ""), {
      ok: false,
      reason: "reason_required",
    });
  });

  test("anular desconta uma vez só, mesmo repetindo", async () => {
    assert.deepEqual(await admin.cancelApproval(missionId, adminId, "engano"), { ok: true });
    assert.deepEqual(await admin.cancelApproval(missionId, adminId, "de novo"), {
      ok: false,
      reason: "approval_not_active",
    });

    // A reputação não entra na conta da anulação: o desconto fixo de 25 não
    // correspondia ao XP que a entrega paga. Entregues e streak, sim.
    const editor = await db
      .prepare("SELECT entregues, reputacao, streak FROM users WHERE id = ?")
      .bind(editorId)
      .first<{ entregues: number; reputacao: number; streak: number }>();
    assert.deepEqual(editor, { entregues: 0, reputacao: 25, streak: 0 });

    const mission = await db
      .prepare("SELECT pontuada FROM pautas WHERE id = ?")
      .bind(missionId)
      .first<{ pontuada: number }>();
    assert.equal(Number(mission?.pontuada), 0);

    const audits = await db
      .prepare("SELECT count(*) AS total FROM auditoria_admin WHERE acao = 'aprovacao_anulada'")
      .first<{ total: number }>();
    assert.equal(Number(audits?.total), 1);
  });

  test("anular abaixo de duas aprovações revoga a indicação e devolve os pontos", async () => {
    await db
      .prepare(
        `INSERT INTO indicacoes_recompensas (convidado_id, convidador_id, pontos, premiado_em)
         VALUES (?, ?, 100, ?)`,
      )
      .bind(editorId, spokespersonId, new Date().toISOString())
      .run();
    await db.prepare("UPDATE users SET reputacao = 100 WHERE id = ?").bind(spokespersonId).run();

    assert.deepEqual(await admin.cancelApproval(missionId, adminId, "engano"), { ok: true });

    const referrer = await db
      .prepare("SELECT reputacao FROM users WHERE id = ?")
      .bind(spokespersonId)
      .first<{ reputacao: number }>();
    assert.equal(Number(referrer?.reputacao), 0);

    const reward = await db
      .prepare("SELECT revogado_em FROM indicacoes_recompensas WHERE convidado_id = ?")
      .bind(editorId)
      .first<{ revogado_em: string | null }>();
    assert.ok(reward?.revogado_em, "a indicação precisa ficar revogada");
  });

  test("bloqueio para no máximo de dois, inclusive em concessões simultâneas", async () => {
    assert.deepEqual(await admin.grantConsistencyShield(editorId, adminId, "um"), { ok: true });

    const racing = await Promise.all([
      admin.grantConsistencyShield(editorId, adminId, "corrida a"),
      admin.grantConsistencyShield(editorId, adminId, "corrida b"),
    ]);
    assert.equal(racing.filter((result) => result.ok).length, 1);

    const total = await db
      .prepare("SELECT count(*) AS total FROM bloqueios_constancia WHERE editor_id = ?")
      .bind(editorId)
      .first<{ total: number }>();
    assert.equal(Number(total?.total), 2);

    assert.deepEqual(await admin.grantConsistencyShield(editorId, adminId, "quarto"), {
      ok: false,
      reason: "shield_limit_reached",
    });
  });

  test("bloqueio para editor inexistente não grava nada", async () => {
    assert.deepEqual(await admin.grantConsistencyShield(987654, adminId, "fantasma"), {
      ok: false,
      reason: "shield_limit_reached",
    });
    const total = await db
      .prepare("SELECT count(*) AS total FROM bloqueios_constancia")
      .first<{ total: number }>();
    assert.equal(Number(total?.total), 0);
  });

  test("auditoria recente vem com o nome do ator e respeita o limite", async () => {
    await admin.grantConsistencyShield(editorId, adminId, "leitura");
    const audit = await admin.recentAudit(10);
    assert.equal(audit[0].acao, "bloqueio_concedido");
    assert.equal(audit[0].ator_nome, "insp.d1");
    assert.deepEqual(await admin.recentAudit(0), []);
  });

  test("gamificação pontua uma vez por referência", async () => {
    const first = await record(editorId, "missao_entregue", `pauta:${missionId}`);
    assert.deepEqual(first, { recorded: true, xp: 100, registrado: true });

    const again = await record(editorId, "missao_entregue", `pauta:${missionId}`);
    assert.deepEqual(again, { recorded: false, xp: 0, registrado: false });

    const editor = await db
      .prepare("SELECT reputacao FROM users WHERE id = ?")
      .bind(editorId)
      .first<{ reputacao: number }>();
    assert.equal(Number(editor?.reputacao), 125, "25 do preparo + 100 do evento, sem repetir");

    // O apelido em inglês é a mesma regra, não uma segunda pontuação.
    assert.deepEqual(await record(editorId, "daily_login", "2026-08-30"), {
      recorded: true,
      xp: 25,
      registrado: true,
    });
    assert.deepEqual(await record(editorId, "entrada_diaria", "2026-08-30"), {
      recorded: false,
      xp: 0,
      registrado: false,
    });
  });

  test("contatos da missão trazem porta-voz e editor, e nada quando não existe", async () => {
    assert.deepEqual(await contacts(missionId), {
      title: "Missão D1",
      spokesperson: { name: "voz.d1", email: "voz.d1@d1.local" },
      editor: { name: "ed.d1", email: "ed.d1@d1.local" },
    });
    assert.equal(await contacts(987654), null);
  });
});
