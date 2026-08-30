import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runBackgroundTask, runScheduledMaintenance } from "./background.ts";
import { maintenanceIsScheduled } from "./routes/editor-queue.ts";

/**
 * A virada entre manutenção por requisição e manutenção agendada.
 *
 * Sem binding de fila (local, teste) a requisição é o gatilho. Com binding
 * (staging, produção) o Cron e o consumidor mandam, e a requisição para de
 * varrer — dois caminhos processando o mesmo trabalho por conta própria é
 * exatamente como se duplica efeito.
 */
describe("interruptor da manutenção", () => {
  test("sem binding, a requisição continua sendo o gatilho", () => {
    assert.equal(maintenanceIsScheduled(undefined), false);
    assert.equal(maintenanceIsScheduled({}), false);
  });

  test("com binding de fila, o agendamento assume", () => {
    assert.equal(maintenanceIsScheduled({ BACKGROUND_QUEUE: { async send() {} } }), true);
  });

  test("o consumidor e o Cron chamam o mesmo trabalho", async () => {
    const calls: string[] = [];
    const dependencies = {
      missionQueue: {
        async expireOffers() {
          calls.push("expire");
          return 1;
        },
        async dispatchOffers() {
          calls.push("dispatch");
          return 2;
        },
      },
      drainEmailQueue: async () => {
        calls.push("drain");
        return { sent: 0, failed: 0 };
      },
    };

    const swept = await runBackgroundTask(dependencies, { type: "mission-queue-sweep" });
    assert.deepEqual(swept, { expired: 1, dispatched: 2 });
    assert.deepEqual(calls, ["expire", "dispatch"]);

    calls.length = 0;
    await runScheduledMaintenance(dependencies);
    assert.deepEqual(calls.sort(), ["dispatch", "drain", "expire"]);
  });

  test("mensagem desconhecida falha alto em vez de virar trabalho silencioso", async () => {
    const dependencies = {
      missionQueue: {
        expireOffers: async () => 0,
        dispatchOffers: async () => 0,
      },
      drainEmailQueue: async () => ({ sent: 0, failed: 0 }),
    };
    await assert.rejects(() => runBackgroundTask(dependencies, { type: "nada" }));
    await assert.rejects(() => runBackgroundTask(dependencies, null));
  });
});
