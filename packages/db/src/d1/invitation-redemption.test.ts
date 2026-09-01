import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1InvitationRedemption } from "./invitation-redemption.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 do resgate de convite", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-invitation-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  const tokenHash = "b".repeat(64);
  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let redemption: ReturnType<typeof createD1InvitationRedemption>;
  let adminId: number;

  before(async () => {
    db = await miniflare.getD1Database("DB");
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    redemption = createD1InvitationRedemption(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM invitation_redemptions"),
      db.prepare("DELETE FROM spokesperson_invitations"),
      db.prepare("DELETE FROM admin_audit"),
      db.prepare("DELETE FROM users"),
    ]);
    const admin = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("admin.convite.d1", "Admin D1", "admin.convite.d1@teste.local", "admin")
      .first<{ id: number }>();
    adminId = admin?.id as number;
    await db
      .prepare(
        "INSERT INTO spokesperson_invitations (email, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?)",
      )
      .bind("voz.d1@teste.local", tokenHash, adminId, "2099-01-01T00:00:00.000Z")
      .run();
  });

  after(() => miniflare.dispose());

  const input = () => ({
    tokenHash,
    email: "voz.d1@teste.local",
    handle: "voz.convite.d1",
    name: "Voz Convite D1",
    passwordHash: "hash-d1",
  });

  test("duas requisições criam uma conta e uma auditoria", async () => {
    const results = await Promise.all([
      redemption.redeemInvitation(input()),
      redemption.redeemInvitation(input()),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.deepEqual(
      results.find((result) => !result.ok),
      {
        ok: false,
        reason: "invitation_used",
      },
    );
    const state = await db
      .prepare(
        `SELECT
           (SELECT count(*) FROM users WHERE role = 'voz') AS users,
           (SELECT count(*) FROM admin_audit WHERE action = 'convite_consumido') AS audits,
           (SELECT count(*) FROM spokesperson_invitations WHERE used_by IS NOT NULL) AS consumed`,
      )
      .first();
    assert.deepEqual(state, { users: 1, audits: 1, consumed: 1 });
  });

  test("e-mail e revogação preservam os motivos tipados", async () => {
    assert.deepEqual(
      await redemption.redeemInvitation({ ...input(), email: "outra@teste.local" }),
      { ok: false, reason: "email_mismatch" },
    );
    await db
      .prepare("UPDATE spokesperson_invitations SET revoked_at = ? WHERE token_hash = ?")
      .bind(new Date().toISOString(), tokenHash)
      .run();
    assert.deepEqual(await redemption.redeemInvitation(input()), {
      ok: false,
      reason: "invitation_revoked",
    });
  });
});
