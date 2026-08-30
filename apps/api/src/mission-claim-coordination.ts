import type { MissionQueueRepository, QueueResult } from "@oficina/db/mission-queue";

export type MissionClaimResult = QueueResult | { ok: false; reason: "stale_request" };

export type MissionClaimRequest = {
  requestId: string;
  missionId: number;
  editorId: number;
  requestedAt: number;
};

type ClaimStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

type LastClaim = { requestId: string; result: MissionClaimResult };

const MAX_REQUEST_AGE_MS = 30_000;

export async function coordinateMissionClaim(
  storage: ClaimStorage,
  queue: Pick<MissionQueueRepository, "reserveMission">,
  request: MissionClaimRequest,
  now = Date.now(),
): Promise<MissionClaimResult> {
  const last = await storage.get<LastClaim>("lastClaim");
  if (last?.requestId === request.requestId) return last.result;

  if (request.requestedAt < now - MAX_REQUEST_AGE_MS || request.requestedAt > now + 5_000) {
    return { ok: false, reason: "stale_request" };
  }

  const result = await queue.reserveMission(request.missionId, request.editorId);
  // ponytail: one recent idempotency key per mission; use a bounded log if
  // overlapping client retries become observable.
  await storage.put("lastClaim", { requestId: request.requestId, result });
  return result;
}
