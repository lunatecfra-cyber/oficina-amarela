import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Gamification } from "./gamification.ts";
import { createD1MissionContacts } from "./mission-contacts.ts";
import { createD1RankingAdmin } from "./ranking-admin.ts";
import { applyAllD1Migrations } from "./schema.ts";
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
        `INSERT INTO users (handle, name, email, role, referred_by_id)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(handle, handle, `${handle}@d1.local`, papel, referrer ?? null)
      .first<{ id: number }>();
    return Number(row?.id);
  }

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    await applyAllD1Migrations(db);
    admin = createD1RankingAdmin(db);
    record = createD1Gamification(db);
    contacts = createD1MissionContacts(db);
  });

  beforeEach(async () => {
    for (const table of [
      "admin_audit",
      "consistency_shields",
      "gamification_events",
      "referral_rewards",
      "ranking_approvals",
      "reviews",
      "ranking_cycles",
      "missions",
      "users",
    ]) {
      await db.prepare(`DELETE FROM ${table}`).run();
    }
    adminId = await newUser("insp.d1", "admin");
    spokespersonId = await newUser("voz.d1", "voz");
    editorId = await newUser("ed.d1", "editor", spokespersonId);

    const mission = await db
      .prepare(
        `INSERT INTO missions (spokesperson_id, title, format, status, reserved_by_id, is_scored)
         VALUES (?, 'Missão D1', 'short', 'aprovada', ?, 1) RETURNING id`,
      )
      .bind(spokespersonId, editorId)
      .first<{ id: number }>();
    missionId = Number(mission?.id);

    const cycle = await db
      .prepare(
        `INSERT INTO ranking_cycles (name, starts_at, ends_at)
         VALUES ('Ciclo D1', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z')
         RETURNING id`,
      )
      .first<{ id: number }>();
    cycleId = Number(cycle?.id);

    await db
      .prepare(
        `INSERT INTO ranking_approvals (mission_id, cycle_id, editor_id, approved_by, approved_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(missionId, cycleId, editorId, adminId, new Date().toISOString())
      .run();
    await db
      .prepare("UPDATE users SET delivered_count = 1, reputation = 25, streak = 1 WHERE id = ?")
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

    const editor = await db
      .prepare("SELECT delivered_count, reputation, streak FROM users WHERE id = ?")
      .bind(editorId)
      .first<{ delivered_count: number; reputation: number; streak: number }>();
    assert.deepEqual(editor, { delivered_count: 0, reputation: 25, streak: 0 });

    const mission = await db
      .prepare("SELECT is_scored FROM missions WHERE id = ?")
      .bind(missionId)
      .first<{ is_scored: number }>();
    assert.equal(Number(mission?.is_scored), 0);

    const audits = await db
      .prepare("SELECT count(*) AS total FROM admin_audit WHERE action = 'aprovacao_anulada'")
      .first<{ total: number }>();
    assert.equal(Number(audits?.total), 1);
  });

  test("anular abaixo de duas aprovações revoga a indicação e devolve os pontos", async () => {
    await db
      .prepare(
        `INSERT INTO referral_rewards (invitee_id, inviter_id, points, awarded_at)
         VALUES (?, ?, 100, ?)`,
      )
      .bind(editorId, spokespersonId, new Date().toISOString())
      .run();
    await db.prepare("UPDATE users SET reputation = 100 WHERE id = ?").bind(spokespersonId).run();

    assert.deepEqual(await admin.cancelApproval(missionId, adminId, "engano"), { ok: true });

    const referrer = await db
      .prepare("SELECT reputation FROM users WHERE id = ?")
      .bind(spokespersonId)
      .first<{ reputation: number }>();
    assert.equal(Number(referrer?.reputation), 0);

    const reward = await db
      .prepare("SELECT revoked_at FROM referral_rewards WHERE invitee_id = ?")
      .bind(editorId)
      .first<{ revoked_at: string | null }>();
    assert.ok(reward?.revoked_at, "a indicação precisa ficar revogada");
  });

  test("bloqueio para no máximo de dois, inclusive em concessões simultâneas", async () => {
    assert.deepEqual(await admin.grantConsistencyShield(editorId, adminId, "um"), { ok: true });

    const racing = await Promise.all([
      admin.grantConsistencyShield(editorId, adminId, "corrida a"),
      admin.grantConsistencyShield(editorId, adminId, "corrida b"),
    ]);
    assert.equal(racing.filter((result) => result.ok).length, 1);

    const total = await db
      .prepare("SELECT count(*) AS total FROM consistency_shields WHERE editor_id = ?")
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
      .prepare("SELECT count(*) AS total FROM consistency_shields")
      .first<{ total: number }>();
    assert.equal(Number(total?.total), 0);
  });

  test("auditoria recente vem com o nome do ator e respeita o limite", async () => {
    await admin.grantConsistencyShield(editorId, adminId, "leitura");
    const audit = await admin.recentAudit(10);
    assert.equal(audit[0].acao, "bloqueio_concedido");
    assert.equal(audit[0].actorName ?? audit[0].ator_nome, "insp.d1");
    assert.deepEqual(await admin.recentAudit(0), []);
  });

  test("gamificação pontua uma vez por referência", async () => {
    const first = await record(editorId, "missao_entregue", `pauta:${missionId}`);
    assert.deepEqual(first, { recorded: true, xp: 100, registrado: true });

    const again = await record(editorId, "missao_entregue", `pauta:${missionId}`);
    assert.deepEqual(again, { recorded: false, xp: 0, registrado: false });

    const editor = await db
      .prepare("SELECT reputation FROM users WHERE id = ?")
      .bind(editorId)
      .first<{ reputation: number }>();
    assert.equal(Number(editor?.reputation), 125, "25 do preparo + 100 do evento, sem repetir");

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
