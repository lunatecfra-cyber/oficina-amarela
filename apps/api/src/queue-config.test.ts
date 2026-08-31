// A entrega na dead letter queue é responsabilidade da Cloudflare, e depende
// inteiramente da configuração do consumidor. Não dá para provocá-la daqui sem
// publicar uma mensagem inválida de propósito, e não existe caminho para isso
// que não seja abrir uma rota de depuração em código de produção.
//
// O que dá para travar é o contrato: retentativa configurada, DLQ apontada, e
// o consumidor falhando de verdade quando a mensagem não presta — que é o que
// faz a Cloudflare retentar e, esgotado, mandar para a DLQ.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { runBackgroundTask } from "./background.ts";

const dependencies = {
  missionQueue: {
    async expireOffers() {
      return 0;
    },
    async dispatchOffers() {
      return 0;
    },
  },
  async drainEmailQueue() {
    return { sent: 0, failed: 0 };
  },
};

async function wranglerConfig() {
  const raw = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  // jsonc: tira comentários de linha antes de interpretar.
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ""));
}

describe("configuração da fila de manutenção", () => {
  for (const environment of ["staging", "production"]) {
    test(`${environment} declara retentativa e dead letter queue`, async () => {
      const config = await wranglerConfig();
      const [consumer] = config.env[environment].queues.consumers;

      assert.ok(consumer, `${environment} precisa de consumidor`);
      assert.ok(consumer.max_retries >= 1, "sem retentativa a falha some");
      assert.ok(consumer.dead_letter_queue, "sem DLQ a mensagem esgotada some");
      assert.notEqual(
        consumer.dead_letter_queue,
        consumer.queue,
        "a DLQ não pode ser a própria fila: falha reentraria para sempre",
      );

      const [producer] = config.env[environment].queues.producers;
      assert.equal(producer.queue, consumer.queue, "produtor e consumidor na mesma fila");
    });
  }

  test("mensagem desconhecida faz o consumidor falhar", async () => {
    // É esta exceção que a Cloudflare enxerga para retentar e, no fim, mandar
    // para a DLQ. Se virar silêncio, a mensagem some sem rastro.
    await assert.rejects(
      () => runBackgroundTask(dependencies, { type: "tarefa-que-nao-existe" }),
      /Unknown background task/,
    );
    await assert.rejects(() => runBackgroundTask(dependencies, null), /Invalid background task/);
  });
});
