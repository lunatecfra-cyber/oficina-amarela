// O convite emitido pelo inspetor é o portão de legitimidade do porta-voz
// oficial: não existe um segundo estado de aprovação de candidato depois dele.
// Estes testes travam o portão pelos dois caminhos de cadastro que existem —
// senha e Google — para que nenhum deles vire uma porta lateral.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("portão de legitimidade do porta-voz", { skip }, async () => {
  const { sql } = await import("@/lib/db");
  const { createAccount, createGoogleAccount } = await import("@/lib/accounts");
  const { hashInvitation } = await import("@oficina/domain/invitations");

  const EMAIL = "candidato@legitimidade.local";
  let adminId: number;

  async function countOfficials() {
    const [row] = await sql`
      SELECT count(*)::int AS total FROM users
      WHERE papel = 'voz' AND email LIKE '%@legitimidade.local'
    `;
    return Number(row.total);
  }

  async function issueInvitation(token: string, email = EMAIL, expired = false) {
    // A tabela exige expira_em > criado_em: um convite vencido nasce no passado.
    await sql`
      INSERT INTO convites_porta_voz (email, token_hash, criado_por, criado_em, expira_em)
      VALUES (
        ${email}, ${hashInvitation(token)}, ${adminId},
        ${expired ? sql`now() - interval '10 days'` : sql`now()`},
        ${expired ? sql`now() - interval '1 day'` : sql`now() + interval '7 days'`}
      )
    `;
  }

  const signup = (extra: Record<string, unknown> = {}) =>
    createAccount({
      name: "Candidato",
      handle: "candidato.oficial",
      email: EMAIL,
      password: "senha-de-teste",
      role: "spokesperson",
      ...extra,
    } as never);

  async function cleanup() {
    await sql`DELETE FROM convites_porta_voz WHERE email LIKE '%@legitimidade.local'`;
    await sql`DELETE FROM users WHERE email LIKE '%@legitimidade.local'`;
  }

  before(async () => {
    await cleanup();
    await sql`DELETE FROM users WHERE email = 'inspetor@legit-admin.local'`;
    const [admin] = await sql`
      INSERT INTO users (apelido, nome, email, senha_hash, papel)
      VALUES ('inspetor.legit', 'Inspetor', 'inspetor@legit-admin.local', 'x', 'admin')
      RETURNING id
    `;
    adminId = Number(admin.id);
  });

  beforeEach(cleanup);

  after(async () => {
    await cleanup();
    await sql`DELETE FROM users WHERE email = 'inspetor@legit-admin.local'`;
    await sql.end();
  });

  test("cadastro por senha sem convite não cria porta-voz oficial", async () => {
    const result = await signup();
    assert.equal(result.ok, false);
    assert.equal(result.error, "Convite especial obrigatório para porta-voz.");
    assert.equal(await countOfficials(), 0);
  });

  test("cadastro pelo Google sem convite não cria porta-voz oficial", async () => {
    const result = await createGoogleAccount({
      name: "Candidato",
      handle: "candidato.google",
      email: EMAIL,
      googleId: "google-legitimidade",
      role: "spokesperson",
    } as never);
    assert.equal(result.ok, false);
    assert.equal(result.error, "Convite especial obrigatório para porta-voz.");
    assert.equal(await countOfficials(), 0);
  });

  test("apelido de papel não contorna o portão: 'voz' também exige convite", async () => {
    const result = await signup({ role: "voz" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Convite especial obrigatório para porta-voz.");
    assert.equal(await countOfficials(), 0);
  });

  test("convite de outro e-mail não serve", async () => {
    await issueInvitation("token-de-outro", "outro@legitimidade.local");
    const result = await signup({ invitation: "token-de-outro" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Este convite pertence a outro e-mail.");
    assert.equal(await countOfficials(), 0);
  });

  test("convite revogado e convite expirado não criam conta oficial", async () => {
    await issueInvitation("token-revogado");
    await sql`
      UPDATE convites_porta_voz SET revogado_em = now(), revogado_por = ${adminId}
      WHERE email = ${EMAIL}
    `;
    const revoked = await signup({ invitation: "token-revogado" });
    assert.equal(revoked.ok, false);
    assert.equal(revoked.error, "Este convite foi revogado.");

    await cleanup();
    await issueInvitation("token-vencido", EMAIL, true);
    const expired = await signup({ invitation: "token-vencido" });
    assert.equal(expired.ok, false);
    assert.equal(expired.error, "Este convite expirou.");

    assert.equal(await countOfficials(), 0);
  });

  test("convite inventado não vale: só o hash guardado autoriza", async () => {
    await issueInvitation("token-de-verdade");
    const result = await signup({ invitation: "token-inventado" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Convite inválido.");
    assert.equal(await countOfficials(), 0);
  });

  test("convite válido cria a conta oficial, e ele não vale duas vezes", async () => {
    await issueInvitation("token-valido");

    const first = await signup({ invitation: "token-valido" });
    assert.equal(first.ok, true);
    assert.equal(await countOfficials(), 1);

    // O mesmo token não rende uma segunda conta oficial. Quem tenta de novo
    // com o e-mail do convite esbarra na conta que já existe; com outro
    // e-mail, esbarra no vínculo do convite. Nenhum dos dois passa.
    const sameEmail = await signup({ invitation: "token-valido", handle: "outro.apelido" });
    assert.equal(sameEmail.ok, false);

    const otherEmail = await signup({
      invitation: "token-valido",
      handle: "outro.apelido",
      email: "terceiro@legitimidade.local",
    });
    assert.equal(otherEmail.ok, false);
    assert.equal(otherEmail.error, "Este convite pertence a outro e-mail.");
    assert.equal(await countOfficials(), 1);
  });

  test("papel não pedido não vira admin nem porta-voz por conta própria", async () => {
    const result = await createAccount({
      name: "Editor Comum",
      handle: "editor.comum",
      email: "editor@legitimidade.local",
      password: "senha-de-teste",
      role: "admin",
    } as never);
    assert.equal(result.ok, true);
    const [row] = await sql`
      SELECT papel FROM users WHERE email = 'editor@legitimidade.local'
    `;
    assert.equal(row.papel, "editor");
    assert.equal(await countOfficials(), 0);
  });
});
