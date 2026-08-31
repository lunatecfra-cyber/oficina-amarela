import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  type BackgroundDependencies,
  enqueueScheduledMaintenance,
  MAINTENANCE_TASKS,
  runBackgroundTask,
  runScheduledMaintenance,
} from "./background.ts";

function dependencies(calls: string[]): BackgroundDependencies {
  return {
    missionQueue: {
      async expireOffers() {
        calls.push("expire");
        return 2;
      },
      async dispatchOffers() {
        calls.push("dispatch");
        return 1;
      },
    },
    async drainEmailQueue() {
      calls.push("email");
      return { sent: 3, failed: 0 };
    },
  };
}

describe("tarefas de fundo", () => {
  test("cron executa expiração, despacho e e-mail fora da requisição", async () => {
    const calls: string[] = [];
    await runScheduledMaintenance(dependencies(calls));
    assert.deepEqual([...calls].sort(), ["dispatch", "email", "expire"]);
    assert.ok(calls.indexOf("expire") < calls.indexOf("dispatch"));
  });

  test("mensagens de Queue invocam apenas o consumidor pedido", async () => {
    const calls: string[] = [];
    const deps = dependencies(calls);
    assert.deepEqual(await runBackgroundTask(deps, { type: "mission-queue-sweep" }), {
      expired: 2,
      dispatched: 1,
    });
    assert.deepEqual(await runBackgroundTask(deps, { type: "email-drain" }), {
      sent: 3,
      failed: 0,
    });
    assert.deepEqual(calls, ["expire", "dispatch", "email"]);
  });

  test("falha da varredura não impede a tentativa de e-mail", async () => {
    let emailAttempted = false;
    const deps = dependencies([]);
    deps.missionQueue.expireOffers = async () => {
      throw new Error("falha da fila");
    };
    deps.drainEmailQueue = async () => {
      emailAttempted = true;
      return { sent: 0, failed: 0 };
    };

    await assert.rejects(() => runScheduledMaintenance(deps), /falha da fila/);
    assert.equal(emailAttempted, true);
  });

  test("mensagem desconhecida falha antes de tocar dependências", async () => {
    const calls: string[] = [];
    await assert.rejects(
      () => runBackgroundTask(dependencies(calls), { type: "desconhecida" }),
      /Unknown background task message/,
    );
    assert.deepEqual(calls, []);
  });

  test("com fila no ar o cron publica em vez de executar", async () => {
    const sent: unknown[] = [];
    const count = await enqueueScheduledMaintenance({
      async send(message) {
        sent.push(message);
      },
    });

    assert.equal(count, MAINTENANCE_TASKS.length);
    assert.deepEqual(sent, MAINTENANCE_TASKS);
  });

  test("toda tarefa publicada é aceita pelo consumidor", async () => {
    for (const task of MAINTENANCE_TASKS) {
      const calls: string[] = [];
      await runBackgroundTask(dependencies(calls), task);
      assert.ok(calls.length > 0, `tarefa ${task.type} não fez nada`);
    }
  });
});
