import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1InvitationAdmin } from "./invitation-admin.ts";
import { applyAllD1Migrations } from "./schema.ts";
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
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    admin = createD1InvitationAdmin(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM invitation_redemptions"),
      db.prepare("DELETE FROM spokesperson_invitations"),
      db.prepare("DELETE FROM admin_audit"),
      db.prepare("DELETE FROM users"),
    ]);
    const inspector = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
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
      .prepare("SELECT email, token_hash, created_by, expires_at FROM spokesperson_invitations")
      .first<{ email: string; token_hash: string; created_by: number; expires_at: string }>();
    assert.equal(invitation?.email, "voz.d1@teste.local");
    assert.equal(invitation?.token_hash, "a".repeat(64));
    assert.equal(invitation?.created_by, adminId);
    assert.ok(new Date(invitation?.expires_at as string).getTime() > Date.now());

    const audit = await db
      .prepare("SELECT actor_id, action, entity FROM admin_audit")
      .first<{ actor_id: number; action: string; entity: string }>();
    assert.deepEqual(audit, {
      actor_id: adminId,
      action: "convite_criado",
      entity: "convite_porta_voz",
    });
  });

  test("não declara convite emitido quando INSERT RETURNING não devolve linha", async () => {
    const emptyReturningDb = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            return { meta: { changes: 0 } };
          },
        };
      },
    } as D1DatabaseLike;

    const result = await createD1InvitationAdmin(emptyReturningDb).issueInvitation({
      email: "voz@teste.local",
      tokenHash: "a".repeat(64),
      adminId: 1,
      validityDays: 7,
    });

    assert.deepEqual(result, { ok: false, reason: "issue_failed" });
  });

  test("reemitir revoga o convite aberto e mantém um só válido", async () => {
    await issue("voz.d1@teste.local", "a".repeat(64));
    const reissued = await issue("voz.d1@teste.local", "c".repeat(64));
    assert.equal(reissued.ok, true);

    const open = await db
      .prepare(
        "SELECT count(*) AS total FROM spokesperson_invitations WHERE used_at IS NULL AND revoked_at IS NULL",
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
        "INSERT INTO spokesperson_invitations (email, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?)",
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
      .prepare("SELECT count(*) AS total FROM admin_audit WHERE action = 'convite_revogado'")
      .first<{ total: number }>();
    assert.equal(audits?.total, 1);
  });

  test("convite já usado não pode ser revogado", async () => {
    const issued = await issue("voz.d1@teste.local", "a".repeat(64));
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    await db
      .prepare("UPDATE spokesperson_invitations SET used_at = ?, used_by = ? WHERE id = ?")
      .bind(new Date().toISOString(), adminId, issued.id)
      .run();

    assert.deepEqual(await admin.revokeInvitation(issued.id, adminId), {
      ok: false,
      reason: "invitation_unavailable",
    });
  });
});
