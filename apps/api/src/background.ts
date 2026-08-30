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

export async function runScheduledMaintenance(dependencies: BackgroundDependencies): Promise<void> {
  await Promise.all([
    runBackgroundTask(dependencies, { type: "mission-queue-sweep" }),
    runBackgroundTask(dependencies, { type: "email-drain" }),
  ]);
}
