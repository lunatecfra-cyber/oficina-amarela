// O cache de revogação troca leitura por janela de propagação. Estes testes
// travam os dois lados do trato: enquanto vale, não relê; quem revoga, invalida.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("cache de revogação de sessão", { skip }, async () => {
  const { sql } = await import("@/lib/db");
  const { clearSessionRevocationCache, getSessionRevocationCutoff, invalidateSessionRevocation } =
    await import("@oficina/db/session-revocation");
  const { updatePassword } = await import("@/lib/accounts");

  let userId: number;

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    clearSessionRevocationCache();
    await sql`DELETE FROM users WHERE email = 'revogacao@teste.local'`;
    const [row] = await sql`
      INSERT INTO users (apelido, nome, email, papel, senha_hash)
      VALUES ('revogacao.teste', 'Revogação', 'revogacao@teste.local', 'editor', 'x')
      RETURNING id
    `;
    userId = row.id;
  });

  after(async () => {
    await sql`DELETE FROM users WHERE email = 'revogacao@teste.local'`;
    await sql.end();
  });

  test("dentro da janela não relê o banco", async () => {
    const first = await getSessionRevocationCutoff(userId);
    assert.equal(typeof first, "number");

    // Muda o banco por fora: se houvesse releitura, o valor mudaria.
    await sql`
      UPDATE users SET sessoes_validas_apos = now() + interval '1 day' WHERE id = ${userId}
    `;
    assert.equal(await getSessionRevocationCutoff(userId), first);
  });

  test("invalidar força a releitura", async () => {
    const first = await getSessionRevocationCutoff(userId);
    await sql`
      UPDATE users SET sessoes_validas_apos = now() + interval '1 day' WHERE id = ${userId}
    `;

    invalidateSessionRevocation(userId);

    const second = await getSessionRevocationCutoff(userId);
    assert.notEqual(second, first);
    assert.ok((second as number) > (first as number));
  });

  test("usuário inexistente devolve null", async () => {
    assert.equal(await getSessionRevocationCutoff(-1), null);
  });

  test("trocar a senha invalida o cache na hora", async () => {
    const before = (await getSessionRevocationCutoff(userId)) as number;

    // Espera um segundo para o corte novo ser observavelmente maior: a coluna
    // tem resolução de microssegundo, mas o corte é comparado em segundos.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal((await updatePassword(userId, "senha-nova-123")).ok, true);

    const after = (await getSessionRevocationCutoff(userId)) as number;
    assert.ok(after > before, "sessões emitidas antes da troca precisam cair");
  });
});
