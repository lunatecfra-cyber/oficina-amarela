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
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { MAINTENANCE_TASKS, runBackgroundTask } from "./background.ts";

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
  const configPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../wrangler.jsonc",
  );
  const raw = await readFile(configPath, "utf8");
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

  /**
   * O piso de manutenção precisa caber na cota diária da CONTA.
   *
   * Em 2026-09-02 os dois ambientes rodavam "* * * * *" publicando 2 mensagens
   * por tique: 2 × 2 × 1440 × 3 = 17.280 operações/dia contra um limite de
   * 10.000 — 172,8%. A cota é da conta inteira, não de cada ambiente, então
   * staging e produção somam. A conta estourava às ~13h53 UTC todo dia e ficava
   * 10 horas sem manutenção nenhuma.
   *
   * Nenhum painel pega isso: é erro de configuração, visível na revisão. Este
   * teste é o que pega. Ver docs/infra/cloudflare-queues-incident-2026-09-02.md.
   */
  test("o piso de manutenção cabe na cota diária de operações da conta", async () => {
    const DAILY_ALLOWANCE = 10_000; // Workers Free, por conta, zera 00:00 UTC
    const OPERATIONS_PER_MESSAGE = 3; // escrita + leitura + remoção
    const BUDGET = 0.25; // manutenção não passa de 1/4 da cota

    const config = await wranglerConfig();
    let operations = 0;
    const breakdown: string[] = [];

    for (const environment of ["staging", "production"]) {
      for (const cron of config.env[environment].triggers?.crons ?? []) {
        const [minute] = cron.split(" ");
        const match = /^\*\/(\d+)$/.exec(minute);
        const periodMinutes = match ? Number(match[1]) : minute === "*" ? 1 : 0;
        assert.ok(
          periodMinutes > 0,
          `${environment}: "${cron}" não é um período reconhecido — some do cálculo de cota sem ninguém ver`,
        );

        const perDay = (1440 / periodMinutes) * MAINTENANCE_TASKS.length * OPERATIONS_PER_MESSAGE;
        operations += perDay;
        breakdown.push(`${environment} ${cron} → ${perDay}`);
      }
    }

    assert.ok(
      operations <= DAILY_ALLOWANCE * BUDGET,
      `manutenção gasta ${operations} operações/dia (${((operations / DAILY_ALLOWANCE) * 100).toFixed(1)}% da cota); ` +
        `o teto é ${DAILY_ALLOWANCE * BUDGET}. Detalhe: ${breakdown.join(", ")}`,
    );
  });

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
