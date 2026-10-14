import type { UserSession } from "@oficina/auth/session";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireInspector } from "../session.ts";

export function createInspectionRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<{
    Bindings: Bindings;
    Variables: { session: UserSession; requestId: string };
  }>();
  routes.use("*", requireInspector);
  routes.use("*", async (c, next) => {
    if (!c.env.DB) return c.json({ error: "Fiscalização indisponível neste ambiente." }, 503);
    c.header("cache-control", "private, no-store");
    const key = `inspection:${c.get("session").id}`;
    if ((await dependencies.accounts.isRateLocked(key)).locked)
      return c.json({ error: "Muitas solicitações. Aguarde antes de tentar novamente." }, 429);
    await dependencies.accounts.recordAttempt(key, 120, 1, 1);
    await next();
  });
  routes.get("/", async (c) => {
    const actor = c.get("session");
    const { results } = await (c.env.DB as D1DatabaseLike)
      .prepare(`
      SELECT m.id,m.title,m.status,m.delivery_version AS version,m.inspection_reason AS reason,
        m.desired_deadline AS deadline,d.submitted_at AS submittedAt,u.handle AS submittedBy,
        d.assigned_inspector_id AS assignedInspectorId
      FROM missions m JOIN mission_deliveries d ON d.mission_id=m.id AND d.version=m.delivery_version
      JOIN users u ON u.id=d.editor_id
      WHERE m.status IN ('em_revisao','reedicao','aprovada') AND d.editor_id<>?
        AND (?='admin' OR d.assigned_inspector_id IS NULL OR d.assigned_inspector_id=?)
      ORDER BY d.submitted_at,m.id`)
      .bind(actor.id, actor.role, actor.id)
      .all();
    return c.json(results);
  });
  routes.post("/:id/claim", async (c) => {
    const actor = c.get("session");
    const id = Number(c.req.param("id"));
    const body = await c.req.json().catch(() => null);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(body?.version) || body.version < 1)
      return c.json({ error: "Atualize a fila para conferir a versão." }, 400);
    const claimed = await (c.env.DB as D1DatabaseLike)
      .prepare(`
      UPDATE mission_deliveries SET assigned_inspector_id=?
      WHERE mission_id=? AND version=? AND editor_id<>?
        AND (assigned_inspector_id IS NULL OR assigned_inspector_id=?)
        AND EXISTS(SELECT 1 FROM missions WHERE id=mission_id AND delivery_version=version AND status='em_revisao')
      RETURNING version`)
      .bind(actor.id, id, body.version, actor.id, actor.id)
      .first();
    if (!claimed)
      return c.json(
        { error: "Esta versão já foi assumida ou saiu da fila. Atualize a página." },
        409,
      );
    return c.json({ ok: true });
  });
  routes.get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const actor = c.get("session");
    const db = c.env.DB as D1DatabaseLike;
    const authorized = await db
      .prepare(`SELECT m.id FROM missions m
      JOIN mission_deliveries d ON d.mission_id=m.id AND d.version=m.delivery_version
      WHERE m.id=? AND d.editor_id<>? AND (?='admin' OR d.assigned_inspector_id=?)`)
      .bind(id, actor.id, actor.role, actor.id)
      .first();
    if (!authorized)
      return c.json({ error: "Assuma a versão atual na fila para acessar a inspeção." }, 403);
    const mission = await dependencies.missions.getMissionById(id);
    const { results: history } = await db
      .prepare(`SELECT d.version,d.submitted_at AS submittedAt,d.delivery_link AS link,d.delivery_video_url AS videoUrl,
      i.decision,i.comment,i.inspected_at AS inspectedAt,u.handle AS inspector
      FROM mission_deliveries d LEFT JOIN mission_inspections i ON i.mission_id=d.mission_id AND i.version=d.version
      LEFT JOIN users u ON u.id=i.inspector_id WHERE d.mission_id=? ORDER BY d.version DESC`)
      .bind(id)
      .all();
    // Only the technical brief and current delivery; no contacts, chat or portfolio consent.
    return c.json({
      mission: mission && {
        id: mission.id,
        title: mission.title,
        format: mission.format,
        brief: mission.brief,
        deliveryVersion: mission.deliveryVersion,
        deliveryLink: mission.deliveryLink,
        deliveryVideoUrl: mission.deliveryVideoUrl,
      },
      history,
    });
  });
  return routes;
}
