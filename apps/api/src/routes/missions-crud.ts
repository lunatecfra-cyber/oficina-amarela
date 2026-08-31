import type { UserSession } from "@oficina/auth/session";
import type { CreateMissionInput } from "@oficina/db/missions";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import { requestMissionDispatch } from "../background.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireAdmin, requireEditor, requireSession, requireSpokesperson } from "../session.ts";

type MissionEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

export function createMissionsCrudRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<MissionEnv>();

  routes.post("/missions", requireSpokesperson, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const input: CreateMissionInput = {
      ...body,
      spokespersonId: session.id,
      title: String(body.title ?? body.titulo ?? ""),
      format: (body.format ?? body.formato ?? "short") as any,
    };
    const result = await dependencies.missions.createMission(input);
    if (!result.ok) {
      return c.json({ error: result.error, erro: result.error }, 400);
    }
    // Despacho dirigido por evento: a missão nova sai para um editor agora, sem
    // esperar o próximo tique do Cron.
    await requestMissionDispatch(c.env, dependencies.missionQueue).catch((error) =>
      console.error("[fila] falha ao pedir despacho da missão nova", error),
    );

    return c.json(result, 201);
  });

  routes.get("/missions/spokesperson", requireSpokesperson, async (c) => {
    const session = c.get("session");
    const list = await dependencies.missions.getSpokespersonMissions(session.id);
    return c.json(list);
  });

  routes.get("/missions/spokesperson/:id", requireSpokesperson, async (c) => {
    const session = c.get("session");
    const id = Number(c.req.param("id").replace(/^db-/, ""));
    const mission = await dependencies.missions.getSpokespersonMissionById(id, session.id);
    if (!mission)
      return c.json({ error: "Missão não encontrada.", erro: "Missão não encontrada." }, 404);
    return c.json(mission);
  });

  routes.get("/missions/available", requireSession, async (c) => {
    const list = await dependencies.missions.getAvailableMissions();
    return c.json(list);
  });

  routes.get("/missions/in-review", requireAdmin, async (c) => {
    const list = await dependencies.missions.getMissionsInReview();
    return c.json(list);
  });

  routes.get("/missions/queue-total", async (c) => {
    const total = await dependencies.missions.getTotalInQueue();
    return c.json({ total });
  });

  routes.get("/missions/:id/queue-position", async (c) => {
    const id = Number(c.req.param("id").replace(/^db-/, ""));
    const position = await dependencies.missions.getQueuePosition(id);
    return c.json({ position });
  });

  routes.get("/editor/active-mission", requireEditor, async (c) => {
    const session = c.get("session");
    const mission = await dependencies.missions.getReservedMission(session.id);
    return c.json(mission ?? null);
  });

  routes.get("/editor/deliveries", requireEditor, async (c) => {
    const session = c.get("session");
    const list = await dependencies.missions.getApprovedDeliveries(session.id);
    return c.json(list);
  });

  routes.get("/candidates/:handle/missions", async (c) => {
    const handle = c.req.param("handle");
    const list = await dependencies.missions.getPublicCandidateMissions(handle);
    return c.json(list);
  });

  routes.get("/missions/view/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id").replace(/^db-/, ""));
    const mission = await dependencies.missions.getMissionById(id);
    if (!mission)
      return c.json({ error: "Missão não encontrada.", erro: "Missão não encontrada." }, 404);
    return c.json(mission);
  });

  routes.delete("/missions/:id", requireSession, async (c) => {
    const id = Number(c.req.param("id").replace(/^db-/, ""));
    const result = await dependencies.missions.deleteMission(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  routes.get("/admin/missions", requireAdmin, async (c) => {
    const list = await dependencies.missions.listAllMissions();
    return c.json(list);
  });

  return routes;
}
