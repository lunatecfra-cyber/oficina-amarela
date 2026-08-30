import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

describe("resgate atômico de convite", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("./client.ts");
  const { postgresInvitationRedemption } = await import("./invitation-redemption.ts");
  const tokenHash = "a".repeat(64);
  let adminId: number;

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    await sql`TRUNCATE users RESTART IDENTITY CASCADE`;
    const [admin] = await sql`
        INSERT INTO users (apelido, nome, email, papel)
        VALUES ('admin.convite', 'Admin Convite', 'admin.convite@teste.local', 'admin')
        RETURNING id
      `;
    adminId = admin.id as number;
    await sql`
        INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em)
        VALUES ('voz.convidada@teste.local', ${tokenHash}, ${adminId}, now() + interval '1 day')
      `;
    await Promise.all([sql`SELECT 1`, sql`SELECT 1`, sql`SELECT 1`, sql`SELECT 1`]);
  });

  after(async () => {
    await sql`TRUNCATE users RESTART IDENTITY CASCADE`;
  });

  const input = () => ({
    tokenHash,
    email: "voz.convidada@teste.local",
    handle: "voz.convidada",
    name: "Voz Convidada",
    passwordHash: "hash-seguro",
  });

  test("duas requisições consomem o convite uma única vez", async () => {
    const results = await Promise.all([
      postgresInvitationRedemption.redeemInvitation(input()),
      postgresInvitationRedemption.redeemInvitation(input()),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.deepEqual(
      results.find((result) => !result.ok),
      { ok: false, reason: "invitation_used" },
    );

    const [state] = await sql`
        SELECT
          (SELECT count(*)::int FROM users WHERE papel = 'voz') AS users,
          (SELECT count(*)::int FROM auditoria_admin WHERE acao = 'convite_consumido') AS audits,
          (SELECT count(*)::int FROM convites_porta_voz WHERE usado_por IS NOT NULL) AS consumed
      `;
    assert.deepEqual(state, { users: 1, audits: 1, consumed: 1 });
    const [candidate] = await sql`
        SELECT papel, perfil_completo FROM users WHERE email = 'voz.convidada@teste.local'
      `;
    assert.deepEqual(candidate, { papel: "voz", perfil_completo: false });
  });

  test("e-mail vinculado e revogação são validados dentro da transação", async () => {
    assert.deepEqual(
      await postgresInvitationRedemption.redeemInvitation({
        ...input(),
        email: "outra@teste.local",
      }),
      { ok: false, reason: "email_mismatch" },
    );
    await sql`
        UPDATE convites_porta_voz SET revogado_em = now(), revogado_por = ${adminId}
        WHERE token_hash = ${tokenHash}
      `;
    assert.deepEqual(await postgresInvitationRedemption.redeemInvitation(input()), {
      ok: false,
      reason: "invitation_revoked",
    });
    const [count] = await sql`SELECT count(*)::int AS total FROM users WHERE papel = 'voz'`;
    assert.equal(count.total, 0);
  });
});
