import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1InvitationAdmin } from "./invitation-admin.ts";
import { applyD1Schema } from "./schema-test-helper.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 da administração de convites", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-invitation-admin-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let admin: ReturnType<typeof createD1InvitationAdmin>;
  let adminId: number;

  before(async () => {
    db = await miniflare.getD1Database("DB");
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db as unknown as D1DatabaseLike, schema);
    admin = createD1InvitationAdmin(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM invitation_redemptions"),
      db.prepare("DELETE FROM convites_porta_voz"),
      db.prepare("DELETE FROM auditoria_admin"),
      db.prepare("DELETE FROM users"),
    ]);
    const inspector = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("inspetor.d1", "Inspetor D1", "inspetor.d1@teste.local", "admin")
      .first<{ id: number }>();
    adminId = inspector?.id as number;
  });

  after(() => miniflare.dispose());

  const issue = (email: string, tokenHash: string, validityDays = 7) =>
    admin.issueInvitation({ email, tokenHash, adminId, validityDays });

  test("emitir guarda só o hash, calcula a expiração e audita", async () => {
    const result = await issue("voz.d1@teste.local", "a".repeat(64));
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const invitation = await db
      .prepare("SELECT email, token_hash, criado_por, expira_em FROM convites_porta_voz")
      .first<{ email: string; token_hash: string; criado_por: number; expira_em: string }>();
    assert.equal(invitation?.email, "voz.d1@teste.local");
    assert.equal(invitation?.token_hash, "a".repeat(64));
    assert.equal(invitation?.criado_por, adminId);
    assert.ok(new Date(invitation?.expira_em as string).getTime() > Date.now());

    const audit = await db
      .prepare("SELECT ator_id, acao, entidade FROM auditoria_admin")
      .first<{ ator_id: number; acao: string; entidade: string }>();
    assert.deepEqual(audit, {
      ator_id: adminId,
      acao: "convite_criado",
      entidade: "convite_porta_voz",
    });
  });

  test("reemitir revoga o convite aberto e mantém um só válido", async () => {
    await issue("voz.d1@teste.local", "a".repeat(64));
    const reissued = await issue("voz.d1@teste.local", "c".repeat(64));
    assert.equal(reissued.ok, true);

    const open = await db
      .prepare(
        "SELECT count(*) AS total FROM convites_porta_voz WHERE usado_em IS NULL AND revogado_em IS NULL",
      )
      .first<{ total: number }>();
    assert.equal(open?.total, 1);

    const listed = await admin.listInvitations();
    assert.deepEqual(listed.map((invitation) => invitation.status).sort(), ["revogado", "valido"]);
    assert.deepEqual(
      listed.map((invitation) => invitation.createdByName),
      ["Inspetor D1", "Inspetor D1"],
    );
  });

  test("listar classifica expirado sem depender do relógio do banco", async () => {
    await db
      .prepare(
        "INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em) VALUES (?, ?, ?, ?)",
      )
      .bind("vencido.d1@teste.local", "d".repeat(64), adminId, "2000-01-01T00:00:00.000Z")
      .run();
    const [invitation] = await admin.listInvitations();
    assert.equal(invitation.status, "expirado");
    assert.equal(invitation.usedByName, null);
  });

  test("revogar acontece uma vez e vira auditoria", async () => {
    const issued = await issue("voz.d1@teste.local", "a".repeat(64));
    assert.equal(issued.ok, true);
    if (!issued.ok) return;

    assert.deepEqual(await admin.revokeInvitation(issued.id, adminId), { ok: true });
    assert.deepEqual(await admin.revokeInvitation(issued.id, adminId), {
      ok: false,
      reason: "invitation_unavailable",
    });

    const audits = await db
      .prepare("SELECT count(*) AS total FROM auditoria_admin WHERE acao = 'convite_revogado'")
      .first<{ total: number }>();
    assert.equal(audits?.total, 1);
  });

  test("convite já usado não pode ser revogado", async () => {
    const issued = await issue("voz.d1@teste.local", "a".repeat(64));
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    await db
      .prepare("UPDATE convites_porta_voz SET usado_em = ?, usado_por = ? WHERE id = ?")
      .bind(new Date().toISOString(), adminId, issued.id)
      .run();

    assert.deepEqual(await admin.revokeInvitation(issued.id, adminId), {
      ok: false,
      reason: "invitation_unavailable",
    });
  });
});
