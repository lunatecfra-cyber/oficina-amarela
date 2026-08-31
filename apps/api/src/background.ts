import type { DrainResult } from "@oficina/db/email-queue";
import type { MissionQueueRepository } from "@oficina/db/mission-queue";

export type BackgroundTaskMessage = { type: "mission-queue-sweep" } | { type: "email-drain" };

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

  if (message.type === "mission-queue-sweep") {
    const expired = await dependencies.missionQueue.expireOffers();
    const dispatched = await dependencies.missionQueue.dispatchOffers();
    return { expired, dispatched };
  }
  if (message.type === "email-drain") return dependencies.drainEmailQueue();

  throw new Error("Unknown background task message");
}

export const MAINTENANCE_TASKS: BackgroundTaskMessage[] = [
  { type: "mission-queue-sweep" },
  { type: "email-drain" },
];

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
