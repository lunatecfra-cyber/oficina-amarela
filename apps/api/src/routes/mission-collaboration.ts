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

/** Cursor numérico opcional: `m-12` e `12` valem; `undefined` se ausente, `null` se inválido. */
function cursorOf(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(/^m-/, ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
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
  if (reason === "unsupported") {
    return { status: 501 as const, error: "Recurso indisponível neste banco." };
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

  // Também antes de "/:id", pelo mesmo motivo de "/messages".
  routes.get("/unread", async (c) => {
    const result = await dependencies.missionCollaboration.unreadMissions(c.get("session"));
    if (!result.ok) {
      const response = failure(result.reason);
      return c.json({ error: response.error }, response.status);
    }
    c.header("cache-control", "private, no-store");
    return c.json({ missions: result.missions });
  });

  routes.post("/:id/read", async (c) => {
    const missionId = missionIdOf(c.req.param("id"));
    if (missionId === null) return c.json({ error: "Missão inválida." }, 400);
    const body = await c.req.json().catch(() => null);
    const upTo = cursorOf(body?.upTo);
    if (upTo === null || upTo === undefined) return c.json({ error: "Informe até onde leu." }, 400);
    const result = await dependencies.missionCollaboration.markRead(
      missionId,
      c.get("session"),
      upTo,
    );
    if (!result.ok) {
      const response = failure(result.reason);
      return c.json({ error: response.error }, response.status);
    }
    return c.json({ ok: true, lastReadId: result.lastReadId });
  });

  routes.get("/:id", async (c, next) => {
    const missionId = missionIdOf(c.req.param("id"));
    if (missionId === null) return next();
    // Paginação por id: estável com timestamps iguais. Sem estes parâmetros vale o
    // contrato antigo por horário (`after`), mantido para quem ainda o usa.
    if (["afterId", "beforeId", "limit"].some((name) => c.req.query(name) !== undefined)) {
      const afterId = cursorOf(c.req.query("afterId"));
      const beforeId = cursorOf(c.req.query("beforeId"));
      const limit = cursorOf(c.req.query("limit"));
      if (afterId === null || beforeId === null || limit === null)
        return c.json({ error: "Cursor inválido." }, 400);
      if (afterId !== undefined && beforeId !== undefined)
        return c.json({ error: "Use afterId ou beforeId, não os dois." }, 400);
      const page = await dependencies.missionCollaboration.messagePage(
        missionId,
        c.get("session"),
        {
          afterId,
          beforeId,
          limit,
        },
      );
      if (!page.ok) {
        const response = failure(page.reason);
        return c.json({ error: response.error }, response.status);
      }
      c.header("cache-control", "private, no-store");
      // Marcos do ciclo vêm na mesma resposta (uma consulta a mais, poucas linhas).
      const events =
        c.req.query("events") === "1"
          ? await dependencies.missionCollaboration.missionEvents(missionId, c.get("session"))
          : null;
      return c.json({
        messages: page.messages,
        mensagens: page.messages,
        hasMore: page.hasMore,
        ...(events?.ok ? { events: events.events } : {}),
      });
    }
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
