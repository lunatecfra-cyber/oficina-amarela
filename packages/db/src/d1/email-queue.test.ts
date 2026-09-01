// A caixa de saída em D1 não existia: a tabela fila_emails no schema tinha só
// id e chave, e nenhuma implementação lia ou escrevia nela. Com isso o Cron do
// staging quebrava a cada minuto e nenhum e-mail saía do stack Cloudflare.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { configureEmailQueueSource, drainEmailQueue, enqueueEmails } from "../email-queue.ts";
import { createD1EmailQueueSource } from "./email-queue.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 da caixa de saída de e-mail", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-email-queue-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );

  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;

  const message = (key: string) => ({
    key,
    to: `${key}@teste.local`,
    subject: "Assunto",
    html: "<p>Corpo</p>",
  });

  before(async () => {
    db = await miniflare.getD1Database("DB");
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    configureEmailQueueSource(createD1EmailQueueSource(db as unknown as D1DatabaseLike, 5));
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM email_queue").run();
  });

  after(async () => {
    configureEmailQueueSource(null);
    await miniflare.dispose();
  });

  test("a mesma chave só entra uma vez", async () => {
    assert.equal(await enqueueEmails([message("a"), message("b")]), 2);
    assert.equal(await enqueueEmails([message("a"), message("c")]), 1);
  });

  test("drenar entrega uma vez e marca como enviada", async () => {
    await enqueueEmails([message("a"), message("b")]);

    const delivered: string[] = [];
    const result = await drainEmailQueue(async (email) => {
      delivered.push(email.recipient || email.destinatario);
      return true;
    });

    assert.deepEqual(result, { sent: 2, failed: 0 });
    assert.equal(delivered.length, 2);
    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 0, failed: 0 });
  });

  test("falha não perde a mensagem e registra o erro", async () => {
    await enqueueEmails([message("a")]);

    const result = await drainEmailQueue(async () => {
      throw new Error("provedor fora do ar");
    });
    assert.deepEqual(result, { sent: 0, failed: 1 });

    const row = await db
      .prepare("SELECT sent_at, attempts, error FROM email_queue WHERE key = 'a'")
      .first<{ sent_at: string | null; attempts: number; error: string }>();
    assert.equal(row?.sent_at, null);
    assert.equal(row?.attempts, 1);
    assert.match(row?.error ?? "", /provedor fora do ar/);
  });

  test("mensagem em recuo não é reivindicada antes da hora", async () => {
    await enqueueEmails([message("a")]);
    await drainEmailQueue(async () => false);

    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 0, failed: 0 });

    await db
      .prepare("UPDATE email_queue SET process_after = ? WHERE key = 'a'")
      .bind(new Date(Date.now() - 60_000).toISOString())
      .run();
    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 1, failed: 0 });
  });

  test("depois do teto de tentativas a mensagem para de ser tentada", async () => {
    await enqueueEmails([message("a")]);
    await db
      .prepare("UPDATE email_queue SET attempts = 5, process_after = ? WHERE key = 'a'")
      .bind(new Date(Date.now() - 60_000).toISOString())
      .run();

    assert.deepEqual(await drainEmailQueue(async () => true), { sent: 0, failed: 0 });
  });
});
