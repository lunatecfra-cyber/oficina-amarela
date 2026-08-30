// A trava de periodicidade é o que impede a varredura global de rodar uma vez
// por poll de cada editor. Precisa de PostgreSQL real: a garantia está no
// UPSERT condicional, não no código.
//
// A coarsening da presença mora em apps/web/lib/presence.test.ts: depende de
// queue-db, que ainda não faz parte deste pacote.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("trava de periodicidade", { skip }, async () => {
  const { sql } = await import("./client.ts");
  const { claimPeriodicTask } = await import("./scheduler.ts");

  const TASK = "teste_varredura";

  before(async () => {
    await sql`SET client_min_messages TO warning`;
    // Sem conexões abertas o driver serializa e a corrida nunca acontece.
    await Promise.all(Array.from({ length: 4 }, () => sql`SELECT 1`));
  });

  beforeEach(async () => {
    await sql`DELETE FROM tarefas_periodicas WHERE nome = ${TASK}`;
  });

  after(async () => {
    await sql`DELETE FROM tarefas_periodicas WHERE nome = ${TASK}`;
    await sql.end();
  });

  test("a primeira chamada ganha e a seguinte não", async () => {
    assert.equal(await claimPeriodicTask(TASK, 60), true);
    assert.equal(await claimPeriodicTask(TASK, 60), false);
  });

  test("só uma entre várias chamadas simultâneas ganha", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => claimPeriodicTask(TASK, 60)));
    assert.equal(results.filter(Boolean).length, 1);
  });

  test("passada a janela, ganha de novo", async () => {
    assert.equal(await claimPeriodicTask(TASK, 60), true);
    await sql`
      UPDATE tarefas_periodicas SET executada_em = now() - interval '61 seconds'
      WHERE nome = ${TASK}
    `;
    assert.equal(await claimPeriodicTask(TASK, 60), true);
  });
});
