import { DurableObject } from "cloudflare:workers";
import { configureDatabaseUrl, withRequestDatabase } from "@oficina/db/client";
import { instrumentD1Database } from "@oficina/db/d1/instrumentation";
import { createD1MissionQueue } from "@oficina/db/d1/mission-queue";
import { postgresMissionQueue } from "@oficina/db/mission-queue";
import { coordinateMissionClaim, type MissionClaimRequest } from "../mission-claim-coordination.ts";

type CoordinatorEnv = {
  HYPERDRIVE?: { readonly connectionString: string };
  DB?: unknown;
};

export class MissionCoordinator extends DurableObject<CoordinatorEnv> {
  private missionQueue() {
    return this.env.DB
      ? createD1MissionQueue(instrumentD1Database(this.env.DB as never))
      : postgresMissionQueue;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (this.env.HYPERDRIVE) configureDatabaseUrl(this.env.HYPERDRIVE.connectionString);

    const claim = (await request.json().catch(() => null)) as MissionClaimRequest | null;
    if (
      !claim?.requestId ||
      !Number.isInteger(claim.missionId) ||
      !Number.isInteger(claim.editorId) ||
      !Number.isFinite(claim.requestedAt)
    ) {
      return Response.json({ error: "Invalid mission claim." }, { status: 400 });
    }

    const start = performance.now();
    const result = await withRequestDatabase(() =>
      this.ctx.blockConcurrencyWhile(() =>
        coordinateMissionClaim(this.ctx.storage, this.missionQueue(), claim),
      ),
    );
    const durationMs = Number((performance.now() - start).toFixed(2));
    console.log(
      JSON.stringify({
        event: "durable-object-mission-claim",
        missionId: claim.missionId,
        editorId: claim.editorId,
        ok: result.ok,
        reason: "reason" in result ? result.reason : undefined,
        durationMs,
      }),
    );
    return Response.json(result);
  }
}
