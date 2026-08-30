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

/**
 * A escolha do banco.
 *
 * Ou tudo vem do D1, ou tudo vem do PostgreSQL: users.reputacao tem um dono só.
 */
describe("escolha do conjunto de repositórios", async () => {
  const { dependenciesFor } = await import("./app.ts");
  const { postgresApiDependencies } = await import("./dependencies.ts");

  test("sem binding D1, fica o PostgreSQL", () => {
    assert.equal(dependenciesFor(undefined, postgresApiDependencies), postgresApiDependencies);
    assert.equal(dependenciesFor({}, postgresApiDependencies), postgresApiDependencies);
  });

  // Nem toda dependência fala com o banco: enviar e-mail de recuperação e
  // invalidar o cache de revogação são as mesmas funções nos dois conjuntos.
  // O que precisa trocar é tudo que lê ou escreve dado.
  const STORE_BACKED = [
    "accounts",
    "invitationAdmin",
    "invitationRedemption",
    "missionQueue",
    "missionLifecycle",
    "missionCollaboration",
    "missionApproval",
    "missionContacts",
    "profiles",
    "ranking",
    "rankingAdmin",
    "recordGamificationEvent",
  ] as const;

  test("com binding D1, todo repositório troca de uma vez", () => {
    const chosen = dependenciesFor({ DB: { prepare: () => ({}) } }, postgresApiDependencies);
    assert.notEqual(chosen, postgresApiDependencies);
    for (const name of STORE_BACKED) {
      assert.notEqual(
        chosen[name],
        postgresApiDependencies[name],
        `${name} continuou apontando para o PostgreSQL`,
      );
    }
  });

  test("a lista de repositórios cobre tudo que o conjunto expõe", () => {
    // Se alguém adicionar um repositório novo e esquecer de listá-lo aqui, o
    // teste acima passaria sem conferir nada — este caso é o que impede isso.
    const notStoreBacked = new Set(["sendRecoveryEmail", "invalidateSessionRevocation"]);
    const covered = new Set<string>(STORE_BACKED);
    for (const name of Object.keys(postgresApiDependencies)) {
      assert.ok(
        covered.has(name) || notStoreBacked.has(name),
        `${name} não está classificada: é repositório ou ajudante sem banco?`,
      );
    }
  });
});
