import type { UserSession } from "@oficina/auth/session";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { LIMITS } from "@oficina/domain/limits";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import { requireSession } from "../session.ts";

export function createMissionReviewRoutes() {
  const routes = new Hono<{
    Bindings: Bindings;
    Variables: { session: UserSession; requestId: string };
  }>();
  routes.use("*", requireSession);
  routes.use("/:id/review", async (c, next) => {
    if (!c.env.DB) return c.json({ error: "Avaliação indisponível neste ambiente." }, 503);
    const id = Number(c.req.param("id").replace(/^db-/, ""));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Missão inválida." }, 400);
    const mission = await (c.env.DB as D1DatabaseLike)
      .prepare("SELECT spokesperson_id FROM missions WHERE id=?")
      .bind(id)
      .first<{ spokesperson_id: number }>();
    if (!mission) return c.json({ error: "Missão não encontrada." }, 404);
    if (c.get("session").role !== "spokesperson" || mission.spokesperson_id !== c.get("session").id)
      return c.json({ error: "Só o porta-voz responsável pode avaliar." }, 403);
    await next();
  });
  routes.get("/:id/review", async (c) => {
    const review = await (c.env.DB as D1DatabaseLike)
      .prepare(
        "SELECT rating,comment,delivery_version AS version,voided_at AS voidedAt FROM reviews WHERE mission_id=? AND source='spokesperson'",
      )
      .bind(Number(c.req.param("id").replace(/^db-/, "")))
      .first();
    return c.json({ review });
  });
  routes.post("/:id/review", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!Number.isInteger(body?.rating) || body.rating < 1 || body.rating > 5)
      return c.json({ error: "Escolha uma nota inteira de 1 a 5." }, 400);
    if (!Number.isInteger(body?.expectedDeliveryVersion) || body.expectedDeliveryVersion <= 0)
      return c.json({ error: "Atualize a página para conferir a versão." }, 400);
    if (
      body.comment !== undefined &&
      (typeof body.comment !== "string" || body.comment.length > LIMITS.longText)
    )
      return c.json({ error: "Comentário inválido." }, 400);
    const db = c.env.DB as D1DatabaseLike;
    const id = Number(c.req.param("id").replace(/^db-/, ""));
    const comment = body.comment?.trim() || null;
    try {
      const inserted = await db
        .prepare(`INSERT INTO reviews(mission_id,editor_id,rating,comment,source,reviewer_id,delivery_version)
        SELECT id,reserved_by_id,?,?,'spokesperson',?,delivery_version FROM missions
        WHERE id=? AND spokesperson_id=? AND status='finalizada' AND is_scored=1 AND delivery_version=?
        ON CONFLICT DO NOTHING RETURNING id`)
        .bind(
          body.rating,
          comment,
          c.get("session").id,
          id,
          c.get("session").id,
          body.expectedDeliveryVersion,
        )
        .first();
      if (inserted) return c.json({ ok: true });
      const existing = await db
        .prepare(
          "SELECT rating,comment,delivery_version,voided_at FROM reviews WHERE mission_id=? AND source='spokesperson'",
        )
        .bind(id)
        .first<{
          rating: number;
          comment: string | null;
          delivery_version: number;
          voided_at: string | null;
        }>();
      if (
        existing &&
        existing.voided_at === null &&
        existing.rating === body.rating &&
        existing.comment === comment &&
        existing.delivery_version === body.expectedDeliveryVersion
      )
        return c.json({ ok: true });
    } catch (error) {
      if (!/review_unavailable/.test(String(error))) throw error;
    }
    return c.json({ error: "Missão ainda não elegível ou já avaliada. Atualize a página." }, 409);
  });
  return routes;
}
