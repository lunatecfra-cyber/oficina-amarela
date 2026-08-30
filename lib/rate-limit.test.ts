// A trava de tentativas comparava `row.attempts` com uma consulta que devolve
// `tentativas`: `undefined >= max` é sempre false, então login, recuperação de
// senha e cadastro por IP nunca travavam. Estes testes impedem a volta disso.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("limite de tentativas", { skip }, async () => {
  const { sql } = await import("@/lib/db");
  const { isRateLocked, recordAttempt } = await import("@/lib/accounts");

  const KEY = "teste:limite";

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    await sql`DELETE FROM tentativas_login WHERE chave LIKE 'teste:%'`;
  });

  after(async () => {
    await sql`DELETE FROM tentativas_login WHERE chave LIKE 'teste:%'`;
    await sql.end();
  });

  test("trava ao atingir o máximo, não antes", async () => {
    for (let i = 1; i < 5; i++) {
      assert.equal((await recordAttempt(KEY, 5)).locked, false, `tentativa ${i} não pode travar`);
      assert.equal((await isRateLocked(KEY)).locked, false);
    }

    assert.equal((await recordAttempt(KEY, 5)).locked, true, "a quinta tentativa trava");
    const locked = await isRateLocked(KEY);
    assert.equal(locked.locked, true);
    assert.ok(locked.minutes > 0);
  });

  test("a trava expira", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt(KEY, 5);
    assert.equal((await isRateLocked(KEY)).locked, true);

    await sql`UPDATE tentativas_login SET travado_ate = now() - interval '1 minute' WHERE chave = ${KEY}`;
    assert.equal((await isRateLocked(KEY)).locked, false);
  });

  test("tentativas fora da janela não somam", async () => {
    await recordAttempt(KEY, 5, 15);
    await sql`UPDATE tentativas_login SET primeira_em = now() - interval '16 minutes' WHERE chave = ${KEY}`;

    // A janela virou: o contador reinicia em 1 e a chave não pode travar.
    for (let i = 0; i < 4; i++) {
      assert.equal((await recordAttempt(KEY, 5, 15)).locked, false);
    }
    assert.equal((await isRateLocked(KEY)).locked, false);
  });

  test("cada chave conta separado", async () => {
    for (let i = 0; i < 5; i++) await recordAttempt("teste:um", 5);
    assert.equal((await isRateLocked("teste:um")).locked, true);
    assert.equal((await isRateLocked("teste:dois")).locked, false);
  });

  test("janela e trava configuráveis por chamada", async () => {
    for (let i = 0; i < 9; i++) {
      assert.equal((await recordAttempt(KEY, 10, 60, 60)).locked, false);
    }
    assert.equal((await recordAttempt(KEY, 10, 60, 60)).locked, true);
    assert.ok((await isRateLocked(KEY)).minutes > 15, "a trava deve durar os 60 minutos pedidos");
  });
});
