import type { UserSession } from "@oficina/auth/session";
import type { MissionCollaborationFailure } from "@oficina/db/mission-collaboration";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { migratedMissionCollaborationAction } from "../mission-actions.ts";
import { requireSession } from "../session.ts";

type MissionEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

function missionIdOf(raw: string): number | null {
  const missionId = Number(raw.replace(/^db-/, ""));
  return Number.isInteger(missionId) ? missionId : null;
}

function failure(reason: MissionCollaborationFailure) {
  if (reason === "mission_not_found")
    return { status: 404 as const, error: "Missão não encontrada." };
  if (reason === "forbidden") {
    return { status: 403 as const, error: "Você não participa desta missão." };
  }
  if (reason === "empty_message") {
    return { status: 400 as const, error: "A mensagem não pode ficar em branco." };
  }
  if (reason === "write_failed") {
    return { status: 500 as const, error: "Não foi possível enviar a mensagem. Tente de novo." };
  }
  return { status: 400 as const, error: "Descreva o problema na denúncia." };
}

export function createMissionCollaborationRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<MissionEnv>();
  routes.use("*", requireSession);

  // Antes de "/:id": o painel do inspetor lê as mensagens de várias missões de
  // uma vez, e em requisição por missão isso vira N+1.
  routes.get("/messages", async (c) => {
    const raw = c.req.query("ids") ?? "";
    const missionIds = raw
      .split(",")
      .map((value) => Number(value.trim().replace(/^db-/, "")))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (raw.trim() !== "" && missionIds.length === 0) {
      return c.json({ error: "Lista de missões inválida." }, 400);
    }

    const result = await dependencies.missionCollaboration.messagesForMissions(
      missionIds,
      c.get("session"),
    );
    if (!result.ok) {
      const response = failure(result.reason);
      return c.json({ error: response.error }, response.status);
    }
    return c.json({ messages: result.messages });
  });

  routes.get("/:id", async (c, next) => {
    const missionId = missionIdOf(c.req.param("id"));
    if (missionId === null) return next();
    const after = c.req.query("after") ?? c.req.query("depois");
    if (after && Number.isNaN(Date.parse(after))) {
      return c.json({ error: "Data de atualização inválida." }, 400);
    }

    const result = await dependencies.missionCollaboration.messagesForMission(
      missionId,
      c.get("session"),
      after,
    );
    if (!result.ok) {
      const response = failure(result.reason);
      return c.json({ error: response.error }, response.status);
    }
    return c.json({ messages: result.messages, mensagens: result.messages });
  });

  routes.post("/:id", async (c, next) => {
    const body = await c.req.json().catch(() => null);
    const action = migratedMissionCollaborationAction(body?.action ?? body?.acao);
    if (!action) return next();

    const missionId = missionIdOf(c.req.param("id"));
    if (missionId === null) return c.json({ error: "Missão inválida." }, 400);
    const text = body?.text ?? body?.texto;
    if (typeof text !== "string") {
      return c.json(
        {
          error:
            action === "message"
              ? "A mensagem não pode ficar em branco."
              : "Descreva o problema na denúncia.",
        },
        400,
      );
    }

    const session = c.get("session");
    if (action === "message") {
      const result = await dependencies.missionCollaboration.sendMessage(missionId, session, text);
      if (!result.ok) {
        const response = failure(result.reason);
        return c.json({ error: response.error }, response.status);
      }
      return c.json({ ok: true, message: result.message });
    }

    const result = await dependencies.missionCollaboration.reportMission(missionId, session, text);
    if (!result.ok) {
      const response = failure(result.reason);
      return c.json({ error: response.error }, response.status);
    }
    return c.json({ ok: true });
  });

  return routes;
}
