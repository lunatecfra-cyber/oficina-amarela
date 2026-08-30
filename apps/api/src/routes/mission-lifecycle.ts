import type { UserSession } from "@oficina/auth/session";
import type { MissionActionFailure, MissionActionResult } from "@oficina/db/mission-lifecycle";
import { isLikelyUrl } from "@oficina/domain/validators";
import { drainEmailQueueNow, queueMissionNotification } from "@oficina/email/dispatch";
import {
  buildApprovedDeliveryEmail,
  buildDeliveryReadyEmail,
  buildReEditRequestedEmail,
} from "@oficina/email/messages";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { migratedMissionAction } from "../mission-actions.ts";
import type { MissionClaimResult } from "../mission-claim-coordination.ts";
import { queueMessage } from "../mission-queue-messages.ts";
import { requireSession } from "../session.ts";

type MissionEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

const UPLOADED_VIDEO_HOSTS = ["r2.dev", "amazonaws.com", "storage.googleapis.com"];

function failureMessage(reason: MissionActionFailure): string {
  switch (reason) {
    case "mission_not_found":
      return "Missão não encontrada.";
    case "mission_not_held":
      return "Essa missão não está com você.";
    case "mission_not_in_review":
      return "Essa missão não está em revisão.";
    case "mission_not_awaiting_spokesperson":
      return "Essa missão não está aguardando sua conferência.";
    case "revision_notes_required":
      return "Escreva o que precisa mudar.";
  }
}

function canAct(
  session: UserSession,
  action: NonNullable<ReturnType<typeof migratedMissionAction>>,
) {
  if (action === "reserve" || action === "cancel" || action === "deliver") {
    return session.role === "editor" || session.role === "admin";
  }
  if (action === "re_edit") return session.role === "admin";
  return session.role === "spokesperson" || session.role === "admin";
}

function roleMessage(action: NonNullable<ReturnType<typeof migratedMissionAction>>): string {
  if (action === "reserve") return "Só editores podem reservar missões.";
  if (action === "cancel") return "Só editores podem liberar missões.";
  if (action === "deliver") return "Só editores podem entregar missões.";
  if (action === "re_edit") return "Só inspetores podem pedir reedição.";
  return "Só o porta-voz pode conferir a entrega.";
}

export function createMissionLifecycleRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<MissionEnv>();
  routes.use("*", requireSession);

  routes.post("/:id", async (c, next) => {
    const missionId = Number(c.req.param("id").replace(/^db-/, ""));
    if (!Number.isInteger(missionId)) return next();

    const body = await c.req.json().catch(() => null);
    const action = migratedMissionAction(body?.action ?? body?.acao);
    if (!action) return c.json({ error: "Ação desconhecida para a missão." }, 400);

    if (!(await dependencies.missionLifecycle.missionExists(missionId))) {
      return c.json({ error: "Missão não encontrada." }, 404);
    }

    const session = c.get("session");
    if (!canAct(session, action)) return c.json({ error: roleMessage(action) }, 403);

    let result: MissionActionResult = { ok: true };
    if (action === "reserve") {
      const queueResult = await reserveMission(c.env, dependencies, {
        requestId: c.req.header("idempotency-key") ?? c.get("requestId"),
        missionId,
        editorId: session.id,
        requestedAt: Date.now(),
      });
      if (!queueResult.ok && queueResult.reason === "stale_request") {
        return c.json({ error: "Essa solicitação de reserva expirou." }, 409);
      }
      if (!queueResult.ok) return c.json({ error: queueMessage(queueResult.reason) }, 409);
    } else if (action === "cancel") {
      const queueResult = await dependencies.missionQueue.abandonMission(missionId, session.id);
      if (!queueResult.ok) return c.json({ error: queueMessage(queueResult.reason) }, 409);
    } else if (action === "deliver") {
      const link = String(body?.link ?? body?.videoUrl ?? "").trim();
      if (!isLikelyUrl(link)) {
        return c.json({ error: "Cole o link do vídeo editado ou faça o upload." }, 400);
      }
      const uploaded = UPLOADED_VIDEO_HOSTS.some((host) => link.includes(host));
      result = await dependencies.missionLifecycle.submitDelivery(missionId, session.id, {
        link: uploaded ? null : link,
        videoUrl: uploaded ? link : null,
      });
    } else if (action === "re_edit") {
      result = await dependencies.missionLifecycle.requestInspectorRevision(
        missionId,
        String(body?.notes ?? body?.notas ?? ""),
      );
    } else if (action === "accept") {
      result = await dependencies.missionLifecycle.finishMission(missionId, session.id);
    } else if (action === "approve") {
      const rating = body?.rating ?? body?.nota;
      const approval = await dependencies.missionApproval.approveMission({
        missionId,
        actor: session,
        rating: typeof rating === "number" ? rating : undefined,
        comment:
          typeof (body?.feedback ?? body?.comentario) === "string"
            ? String(body?.feedback ?? body?.comentario)
            : undefined,
      });
      if (!approval.ok) {
        const response =
          approval.reason === "mission_not_found"
            ? { status: 404 as const, error: "Missão não encontrada." }
            : approval.reason === "forbidden"
              ? { status: 403 as const, error: "Você não pode aprovar esta missão." }
              : approval.reason === "invalid_rating"
                ? { status: 400 as const, error: "A nota deve ser um número inteiro de 1 a 5." }
                : { status: 409 as const, error: "Essa missão não está em revisão." };
        return c.json({ error: response.error }, response.status);
      }
    } else {
      result = await dependencies.missionLifecycle.requestSpokespersonRevision(
        missionId,
        session.id,
        String(body?.notes ?? body?.notas ?? ""),
      );
    }

    if (!result.ok) {
      const status =
        result.reason === "mission_not_found"
          ? 404
          : result.reason === "revision_notes_required"
            ? 400
            : 409;
      return c.json({ error: failureMessage(result.reason) }, status);
    }

    if (action === "deliver") {
      await dependencies
        .recordGamificationEvent(session.id, "mission_delivered", String(missionId))
        .catch((error) => console.error("[gamification] failed to record delivery", error));
    }

    await dispatchNotifications(
      dependencies,
      action,
      missionId,
      new URL(c.req.url).origin,
      body,
    ).catch((error) => console.error("[notification] failed after action", action, error));
    await drainEmailQueueNow();

    return c.json({ ok: true });
  });

  return routes;
}

async function reserveMission(
  env: Bindings,
  dependencies: ApiDependencies,
  claim: {
    requestId: string;
    missionId: number;
    editorId: number;
    requestedAt: number;
  },
): Promise<MissionClaimResult> {
  if (!env?.MISSION_COORDINATOR) {
    return dependencies.missionQueue.reserveMission(claim.missionId, claim.editorId);
  }

  const namespace = env.MISSION_COORDINATOR;
  const stub = namespace.get(namespace.idFromName(`mission:${claim.missionId}`));
  const response = await stub.fetch("https://mission.internal/reserve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(claim),
  });
  if (!response.ok) throw new Error(`Mission coordinator failed with ${response.status}`);
  return (await response.json()) as MissionClaimResult;
}

async function dispatchNotifications(
  dependencies: ApiDependencies,
  action: NonNullable<ReturnType<typeof migratedMissionAction>>,
  missionId: number,
  origin: string,
  body: Record<string, unknown> | null,
) {
  const contacts = await dependencies.missionContacts(missionId);
  if (!contacts) return;

  if (action === "deliver" && contacts.spokesperson) {
    await queueMissionNotification(
      "entrega",
      missionId,
      contacts.spokesperson.email,
      buildDeliveryReadyEmail(
        contacts.spokesperson.name,
        contacts.title,
        `${origin}/porta-voz/missao/db-${missionId}`,
      ),
    );
  } else if ((action === "re_edit" || action === "adjust") && contacts.editor) {
    await queueMissionNotification(
      "reedicao",
      missionId,
      contacts.editor.email,
      buildReEditRequestedEmail(
        contacts.editor.name,
        contacts.title,
        String(body?.notes ?? body?.notas ?? ""),
        `${origin}/editor`,
      ),
    );
  } else if (action === "approve" && contacts.editor) {
    const rating = body?.rating ?? body?.nota;
    await queueMissionNotification(
      "aprovacao",
      missionId,
      contacts.editor.email,
      buildApprovedDeliveryEmail(
        contacts.editor.name,
        contacts.title,
        typeof rating === "number" ? rating : undefined,
        `${origin}/editor`,
      ),
    );
  }
}
