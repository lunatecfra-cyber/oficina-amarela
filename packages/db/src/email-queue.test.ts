// A caixa de saída precisa garantir três coisas: não duplicar, não perder, e
// não ficar tentando para sempre.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("caixa de saída de e-mail", { skip }, async () => {
  const { sql } = await import("./client.ts");
  const { MAX_ATTEMPTS, drainEmailQueue, enqueueEmails } = await import("./email-queue.ts");

  const message = (key: string) => ({
    key,
    to: `${key}@teste.local`,
    subject: "Assunto",
    html: "<p>Corpo</p>",
  });

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    await sql`DELETE FROM fila_emails`;
  });

  after(async () => {
    await sql`DELETE FROM fila_emails`;
  });

  test("a mesma chave só entra uma vez", async () => {
    assert.equal(await enqueueEmails([message("teste-a"), message("teste-b")]), 2);
    assert.equal(await enqueueEmails([message("teste-a"), message("teste-c")]), 1);

    const rows = await sql`SELECT chave FROM fila_emails WHERE chave LIKE 'teste-%'`;
    assert.equal(rows.length, 3);
  });

  test("drenar entrega uma vez e marca como enviada", async () => {
    await enqueueEmails([message("teste-a"), message("teste-b")]);

    const delivered: string[] = [];
    const result = await drainEmailQueue(async (email) => {
      delivered.push(email.destinatario);
      return true;
    });

    assert.deepEqual(result, { sent: 2, failed: 0 });
    assert.equal(delivered.length, 2);

    // Segunda drenagem não reenvia nada.
    const again = await drainEmailQueue(async () => true);
    assert.deepEqual(again, { sent: 0, failed: 0 });
  });

  test("falha não perde a mensagem e registra o erro", async () => {
    await enqueueEmails([message("teste-a")]);

    const result = await drainEmailQueue(async () => {
      throw new Error("provedor fora do ar");
    });
    assert.deepEqual(result, { sent: 0, failed: 1 });

    const [row] =
      await sql`SELECT enviado_em, tentativas, erro FROM fila_emails WHERE chave = 'teste-a'`;
    assert.equal(row.enviado_em, null);
    assert.equal(row.tentativas, 1);
    assert.match(row.erro, /provedor fora do ar/);
  });

  test("mensagem em recuo não é reivindicada antes da hora", async () => {
    await enqueueEmails([message("teste-a")]);
    await drainEmailQueue(async () => false);

    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 0, failed: 0 });

    await sql`UPDATE fila_emails SET processar_apos = now() - interval '1 minute' WHERE chave = 'teste-a'`;
    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 1, failed: 0 });
  });

  test("depois do teto de tentativas a mensagem para de ser tentada", async () => {
    await enqueueEmails([message("teste-a")]);
    await sql`
      UPDATE fila_emails SET tentativas = ${MAX_ATTEMPTS}, processar_apos = now() - interval '1 minute'
      WHERE chave = 'teste-a'
    `;

    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 0, failed: 0 });
  });

  test("dois drenadores simultâneos não entregam a mesma mensagem duas vezes", async () => {
    await enqueueEmails(Array.from({ length: 6 }, (_, i) => message(`teste-p${i}`)));

    const delivered: string[] = [];
    const send = async (email: { destinatario: string }) => {
      delivered.push(email.destinatario);
      return true;
    };

    await Promise.all([drainEmailQueue(send), drainEmailQueue(send), drainEmailQueue(send)]);

    assert.equal(new Set(delivered).size, delivered.length, "nenhum destinatário pode repetir");
  });
});
