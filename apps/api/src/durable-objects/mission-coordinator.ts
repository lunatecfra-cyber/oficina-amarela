import { DurableObject } from "cloudflare:workers";
import { configureDatabaseUrl } from "@oficina/db/client";
import { postgresMissionQueue } from "@oficina/db/mission-queue";
import { coordinateMissionClaim, type MissionClaimRequest } from "../mission-claim-coordination.ts";

type CoordinatorEnv = {
  HYPERDRIVE?: { readonly connectionString: string };
};

export class MissionCoordinator extends DurableObject<CoordinatorEnv> {
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

    return Response.json(
      await this.ctx.blockConcurrencyWhile(() =>
        coordinateMissionClaim(this.ctx.storage, postgresMissionQueue, claim),
      ),
    );
  }
}
