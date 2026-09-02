import type { DrainResult } from "@oficina/db/email-queue";
import type { MissionQueueRepository } from "@oficina/db/mission-queue";

/**
 * `maintenance` faz varredura e caixa de saída na mesma mensagem.
 *
 * A Cloudflare cobra por mensagem, não por lote: publicar as duas tarefas
 * separadas custava o dobro (3 operações cada) para fazer um tique só de
 * manutenção, sempre produzidas juntas e consumidas no mesmo lote.
 *
 * `mission-queue-sweep` e `email-drain` continuam aceitos: a retenção da fila é
 * de 24h, então mensagem publicada no formato antigo ainda chega ao consumidor
 * novo. `mission-queue-sweep` também é o que requestMissionDispatch publica —
 * esse não pode virar `maintenance`, porque despacho de missão não deve arrastar
 * a drenagem de e-mail junto.
 */
export type BackgroundTaskMessage =
  | { type: "maintenance" }
  | { type: "mission-queue-sweep" }
  | { type: "email-drain" };

export type BackgroundDependencies = {
  missionQueue: Pick<MissionQueueRepository, "expireOffers" | "dispatchOffers">;
  drainEmailQueue: () => Promise<DrainResult>;
};

export async function runBackgroundTask(
  dependencies: BackgroundDependencies,
  message: unknown,
): Promise<DrainResult | { expired: number; dispatched: number }> {
  if (!message || typeof message !== "object" || !("type" in message)) {
    throw new Error("Invalid background task message");
  }

  if (message.type === "maintenance") {
    // Varredura e caixa de saída são independentes: fila de ofertas quebrada não
    // pode segurar e-mail que já está pronto para sair. Por isso allSettled em
    // vez de await em sequência — as duas são tentadas sempre, e só depois a
    // falha sobe para a mensagem ser retentada.
    const [sweep, email] = await Promise.allSettled([
      (async () => {
        const expired = await dependencies.missionQueue.expireOffers();
        const dispatched = await dependencies.missionQueue.dispatchOffers();
        return { expired, dispatched };
      })(),
      dependencies.drainEmailQueue(),
    ]);

    const failure = [sweep, email].find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;

    return {
      ...(sweep as PromiseFulfilledResult<{ expired: number; dispatched: number }>).value,
      ...(email as PromiseFulfilledResult<DrainResult>).value,
    };
  }
  if (message.type === "mission-queue-sweep") {
    const expired = await dependencies.missionQueue.expireOffers();
    const dispatched = await dependencies.missionQueue.dispatchOffers();
    return { expired, dispatched };
  }
  if (message.type === "email-drain") return dependencies.drainEmailQueue();

  throw new Error("Unknown background task message");
}

/**
 * Um tique de manutenção é uma mensagem só.
 *
 * Custo por tique: 1 mensagem × 3 operações (escrita + leitura + remoção). Eram
 * duas mensagens, 6 operações. Ver
 * docs/infra/cloudflare-queues-incident-2026-09-02.md.
 */
export const MAINTENANCE_TASKS: BackgroundTaskMessage[] = [{ type: "maintenance" }];

export async function runScheduledMaintenance(dependencies: BackgroundDependencies): Promise<void> {
  await Promise.all(MAINTENANCE_TASKS.map((task) => runBackgroundTask(dependencies, task)));
}

/**
 * Publica a manutenção na fila em vez de executá-la no Cron.
 *
 * O Cron tem orçamento de CPU próprio e uma tentativa só. Na fila, cada tarefa
 * tem retentativa e, esgotada, cai na dead letter queue em vez de sumir. Se a
 * publicação falhar, o tique seguinte tenta de novo — por isso o Cron não
 * precisa de fallback aqui.
 */
/**
 * Pede uma rodada de despacho agora, sem esperar o Cron.
 *
 * Missão nova precisa sair para um editor na hora — esperar o próximo tique
 * seria até um minuto de silêncio depois de criar a pauta. Com fila no ar,
 * publica; sem fila, despacha inline.
 */
export async function requestMissionDispatch(
  env: { BACKGROUND_QUEUE?: { send(message: unknown): Promise<void> } } | undefined,
  missionQueue: BackgroundDependencies["missionQueue"],
): Promise<void> {
  if (env?.BACKGROUND_QUEUE) {
    await env.BACKGROUND_QUEUE.send({ type: "mission-queue-sweep" });
    return;
  }
  await missionQueue.dispatchOffers();
}

export async function enqueueScheduledMaintenance(queue: {
  send(message: unknown): Promise<void>;
}): Promise<number> {
  await Promise.all(MAINTENANCE_TASKS.map((task) => queue.send(task)));
  return MAINTENANCE_TASKS.length;
}
