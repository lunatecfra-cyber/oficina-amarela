import type { UserSession } from "@oficina/auth/session";
import { createD1MissionQueue } from "@oficina/db/d1/mission-queue";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { OFFER_MINUTES } from "@oficina/db/mission-queue";
import { publishedPortfolioLink } from "@oficina/domain/validators";
import { drainEmailQueueNow } from "@oficina/email/dispatch";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import { requireEditor, requireSpokesperson } from "../session.ts";

// shortcut: timetable SQL uses São Paulo UTC-3, revise if its civil-time rules change.
export const ELIGIBLE = `u.role='editor' AND u.is_banned=0 AND u.profile_completed=1
  AND (json_extract(u.availability, '$[' || CASE WHEN CAST(strftime('%H','now','-3 hours') AS INTEGER) BETWEEN 6 AND 11 THEN 0 WHEN CAST(strftime('%H','now','-3 hours') AS INTEGER) BETWEEN 12 AND 17 THEN 1 ELSE 2 END || '][' || ((CAST(strftime('%w','now','-3 hours') AS INTEGER)+6)%7) || ']') IS NOT 0)
  AND (u.reservations_locked_until IS NULL OR u.reservations_locked_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  AND NOT EXISTS(SELECT 1 FROM missions a WHERE a.reserved_by_id=u.id AND a.status IN ('reservada','em_revisao','reedicao'))
  AND NOT EXISTS(SELECT 1 FROM offers o WHERE o.editor_id=u.id AND o.status='pendente')`;
type Env = { Bindings: Bindings; Variables: { session: UserSession; requestId: string } };
export function createMissionBoardRoutes() {
  const routes = new Hono<Env>();
  routes.use("*", async (c, next) => {
    if (!c.env.DB) return c.json({ error: "Mural indisponível neste ambiente." }, 503);
    await next();
  });
  routes.get("/board", requireEditor, async (c) => {
    const db = c.env.DB as unknown as D1DatabaseLike,
      id = c.get("session").id;
    await createD1MissionQueue(db).expireOffers();
    const user = await db
      .prepare(`SELECT (${ELIGIBLE}) AS eligible FROM users u WHERE u.id=?`)
      .bind(id)
      .first<{ eligible: number }>();
    if (c.get("session").role !== "editor")
      return c.json({ error: "Só editores acessam o mural." }, 403);
    const { results } = await db
      .prepare(`SELECT m.id,m.title,m.format,m.status,v.name AS spokesperson,m.desired_deadline AS desiredDeadline,
      m.motivation,m.extras,m.brief_tone AS tone,m.brief_refs AS refs,
      EXISTS(SELECT 1 FROM mission_interests i WHERE i.mission_id=m.id AND i.editor_id=?) AS interested,
      (SELECT status FROM offers WHERE mission_id=m.id AND editor_id=?) AS offerStatus,
      m.reserved_by_id=? AS assignedToMe
      FROM missions m JOIN users v ON v.id=m.spokesperson_id
      WHERE m.manual_selection=1 AND (m.status='disponivel' OR EXISTS(SELECT 1 FROM mission_interests i WHERE i.mission_id=m.id AND i.editor_id=?) OR EXISTS(SELECT 1 FROM offers o WHERE o.mission_id=m.id AND o.editor_id=?))
      ORDER BY m.created_at DESC LIMIT 100`)
      .bind(id, id, id, id, id)
      .all();
    return c.json({ eligible: Boolean(user?.eligible), missions: results });
  });
  routes.post("/:id/interest", requireEditor, async (c) => {
    const db = c.env.DB as unknown as D1DatabaseLike,
      id = Number(c.req.param("id")),
      editor = c.get("session").id;
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: "Missão inválida." }, 400);
    if (c.get("session").role !== "editor")
      return c.json({ error: "Só editores manifestam interesse." }, 403);
    // A retry of a recorded interest is harmless even after selection.
    const old = await db
      .prepare("SELECT 1 FROM mission_interests WHERE mission_id=? AND editor_id=?")
      .bind(id, editor)
      .first();
    if (old) return c.json({ ok: true });
    try {
      await db
        .prepare(
          "INSERT INTO mission_interests(mission_id,editor_id) VALUES (?,?) ON CONFLICT DO NOTHING",
        )
        .bind(id, editor)
        .run();
    } catch (error) {
      if (!(error instanceof Error) || !/editor_ineligible|UNIQUE constraint/.test(error.message))
        throw error;
      return c.json(
        { error: "Missão indisponível ou você não está elegível. Atualize o mural." },
        409,
      );
    }
    await drainEmailQueueNow().catch((error) =>
      console.error("[notification] pending retry", error),
    );
    return c.json({ ok: true }, 201);
  });
  routes.get("/:id/selection", requireSpokesperson, async (c) => {
    const db = c.env.DB as unknown as D1DatabaseLike,
      id = Number(c.req.param("id")),
      actor = c.get("session").id;
    await createD1MissionQueue(db).expireOffers();
    const mission = await db
      .prepare(
        "SELECT status FROM missions WHERE id=? AND spokesperson_id=? AND manual_selection=1",
      )
      .bind(id, actor)
      .first<{ status: string }>();
    if (!mission) return c.json({ error: "Missão não encontrada." }, 404);
    const { results: candidates } = await db
      .prepare(`SELECT u.id,u.handle,u.name,u.headline,CASE WHEN u.directory_visible=1 AND u.directory_portfolio_consent=1 THEN u.portfolio_link ELSE NULL END AS portfolioLink,u.editing_styles AS styles,u.niches,u.availability,
      (SELECT AVG(r.rating) FROM reviews r WHERE r.editor_id=u.id AND r.source='spokesperson' AND r.voided_at IS NULL) AS rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.editor_id=u.id AND r.source='spokesperson' AND r.voided_at IS NULL) AS ratingCount,
      EXISTS(SELECT 1 FROM mission_interests i WHERE i.mission_id=? AND i.editor_id=u.id) AS interested,
      (${ELIGIBLE}) AS eligible,(SELECT status FROM offers WHERE mission_id=? AND editor_id=u.id) AS offerStatus
      FROM users u WHERE u.role='editor' AND u.profile_completed=1 AND u.is_banned=0
      AND (u.directory_visible=1 OR EXISTS(SELECT 1 FROM mission_interests i WHERE i.mission_id=? AND i.editor_id=u.id))
      ORDER BY interested DESC,u.name LIMIT 100`)
      .bind(id, id, id)
      .all();
    const selected = await db
      .prepare(`SELECT o.editor_id AS editorId,u.name,o.status,o.expires_at AS expiresAt FROM offers o JOIN users u ON u.id=o.editor_id
      WHERE o.mission_id=? ORDER BY o.position DESC LIMIT 1`)
      .bind(id)
      .first();
    return c.json({
      ...mission,
      candidates: candidates.map((row) => ({
        ...row,
        portfolioLink: publishedPortfolioLink(row.portfolioLink as string | null),
      })),
      selected,
    });
  });
  routes.post("/:id/selection", requireSpokesperson, async (c) => {
    const db = c.env.DB as unknown as D1DatabaseLike,
      id = Number(c.req.param("id")),
      actor = c.get("session").id;
    const body = await c.req.json().catch(() => null),
      editor = body?.editorId,
      kind = body?.kind;
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !Number.isSafeInteger(editor) ||
      editor <= 0 ||
      !["interest", "direct"].includes(kind)
    )
      return c.json({ error: "Seleção inválida." }, 400);
    await createD1MissionQueue(db).expireOffers();
    const mission = await db
      .prepare(
        "SELECT status FROM missions WHERE id=? AND spokesperson_id=? AND manual_selection=1",
      )
      .bind(id, actor)
      .first();
    if (!mission) return c.json({ error: "Missão não encontrada." }, 404);
    const old = await db
      .prepare(
        "SELECT status,selection_kind FROM offers WHERE mission_id=? AND editor_id=? AND selected_by_id=?",
      )
      .bind(id, editor, actor)
      .first<{ status: string; selection_kind: string }>();
    if (old)
      return old.selection_kind === kind && ["pendente", "aceita"].includes(old.status)
        ? c.json({ ok: true })
        : c.json({ error: "Esse convite já foi encerrado. Selecione outro editor." }, 409);
    const now = new Date();
    try {
      await db
        .prepare(`INSERT INTO offers(mission_id,editor_id,status,offered_at,expires_at,position,selected_by_id,selection_kind)
        VALUES (?,?,'pendente',?,?,(SELECT COALESCE(MAX(position),0)+1 FROM offers WHERE mission_id=?),?,?)`)
        .bind(
          id,
          editor,
          now.toISOString(),
          new Date(now.getTime() + OFFER_MINUTES * 60000).toISOString(),
          id,
          actor,
          kind,
        )
        .run();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/selection_invalid|mission_unavailable|UNIQUE constraint/.test(error.message)
      )
        throw error;
      const retry = await db
        .prepare(
          "SELECT 1 FROM offers WHERE mission_id=? AND editor_id=? AND selected_by_id=? AND selection_kind=? AND status IN ('pendente','aceita')",
        )
        .bind(id, editor, actor, kind)
        .first();
      if (retry) return c.json({ ok: true });
      console.error("[selection] rejected", error);
      return c.json(
        {
          error: "Seleção indisponível: atualize os interessados e confira a capacidade do editor.",
        },
        409,
      );
    }
    await drainEmailQueueNow().catch((error) =>
      console.error("[notification] pending retry", error),
    );
    return c.json({ ok: true }, 201);
  });
  return routes;
}
