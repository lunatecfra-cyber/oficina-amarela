import type { UserSession } from "@oficina/auth/session";
import { createD1Profiles } from "@oficina/db/d1/profiles";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { publishedPortfolioLink } from "@oficina/domain/validators";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import { requireEditor, requireSession } from "../session.ts";
import { ELIGIBLE } from "./mission-board.ts";
export function createEditorDirectoryRoutes() {
  const routes = new Hono<{
    Bindings: Bindings;
    Variables: { session: UserSession; requestId: string };
  }>();
  routes.use("*", requireSession);
  routes.use("*", async (c, next) => {
    if (!c.env.DB) return c.json({ error: "Diretório indisponível neste ambiente." }, 503);
    await next();
  });
  routes.get("/visibility", requireEditor, async (c) => {
    const result = await (c.env.DB as unknown as D1DatabaseLike)
      .prepare(
        "SELECT directory_visible AS visible,directory_portfolio_consent AS portfolioConsent FROM users WHERE id=? AND role='editor' AND is_banned=0",
      )
      .bind(c.get("session").id)
      .first();
    return result ? c.json(result) : c.json({ error: "Só editores podem publicar perfil." }, 403);
  });
  routes.post("/visibility", requireEditor, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.visible !== "boolean" || typeof body?.portfolioConsent !== "boolean")
      return c.json({ error: "Confirme as opções de publicação." }, 400);
    const result = await (c.env.DB as unknown as D1DatabaseLike)
      .prepare(
        "UPDATE users SET directory_visible=?,directory_portfolio_consent=? WHERE id=? AND role='editor' AND is_banned=0",
      )
      .bind(Number(body.visible), Number(body.portfolioConsent), c.get("session").id)
      .run();
    return result.meta.changes
      ? c.json({ ok: true })
      : c.json({ error: "Perfil indisponível." }, 403);
  });
  routes.get("/", async (c) => {
    const db = c.env.DB as unknown as D1DatabaseLike;
    const search = (c.req.query("search") || "").trim().slice(0, 100),
      specialty = (c.req.query("specialty") || "").trim().slice(0, 100),
      available = c.req.query("available") === "true";
    const { results } = await db
      .prepare(`SELECT u.handle,u.name,u.location,u.bio,u.editing_styles AS styles,u.niches,u.availability,(${ELIGIBLE}) AS available,
    CASE WHEN u.directory_portfolio_consent=1 THEN u.portfolio_link ELSE NULL END AS portfolioLink,
    (SELECT ROUND(AVG(rating),2) FROM reviews WHERE editor_id=u.id AND source='spokesperson' AND voided_at IS NULL) AS rating,
    (SELECT COUNT(*) FROM reviews WHERE editor_id=u.id AND source='spokesperson' AND voided_at IS NULL) AS ratingCount,
    (SELECT COUNT(*) FROM missions WHERE reserved_by_id=u.id AND status='finalizada') AS completedCount
    FROM users u WHERE u.role='editor' AND u.is_banned=0 AND u.profile_completed=1 AND u.directory_visible=1
    AND (?='' OR instr(lower(u.name||' '||u.handle),lower(?))>0)
    AND (?='' OR instr(lower(COALESCE(u.editing_styles,'')||' '||COALESCE(u.niches,'')),lower(?))>0)
    AND (?=0 OR (${ELIGIBLE})) ORDER BY u.name LIMIT 100`)
      .bind(search, search, specialty, specialty, Number(available))
      .all();
    return c.json(
      results.map((row) => ({
        ...row,
        portfolioLink: publishedPortfolioLink(row.portfolioLink as string | null),
      })),
    );
  });
  routes.get("/:handle", async (c) => {
    const db = c.env.DB as unknown as D1DatabaseLike;
    const row = await db
      .prepare(`SELECT u.id,u.directory_visible,u.directory_portfolio_consent,u.portfolio_link,u.availability FROM users u
    WHERE u.handle=? AND u.role='editor' AND u.is_banned=0 AND u.profile_completed=1
    AND (u.directory_visible=1 OR u.id=? OR EXISTS(SELECT 1 FROM mission_interests i JOIN missions m ON m.id=i.mission_id WHERE i.editor_id=u.id AND m.spokesperson_id=?) OR EXISTS(SELECT 1 FROM offers o JOIN missions m ON m.id=o.mission_id WHERE o.editor_id=u.id AND m.spokesperson_id=? AND o.status IN ('pendente','aceita') AND m.status IN ('oferecida','reservada','em_revisao','reedicao','aprovada')))`)
      .bind(c.req.param("handle"), c.get("session").id, c.get("session").id, c.get("session").id)
      .first<{
        id: number;
        directory_visible: number;
        directory_portfolio_consent: number;
        portfolio_link: string | null;
        availability: string | null;
      }>();
    if (!row) return c.json({ error: "Perfil não publicado ou indisponível." }, 404);
    const p = await createD1Profiles(db).readEditorProfile(row.id);
    if (!p) return c.json({ error: "Perfil indisponível." }, 404);
    // Platform delivery files need separate publication permission; never copy them into this projection.
    return c.json({
      handle: p.handle,
      name: p.name,
      location: p.location,
      bio: p.bio,
      styles: p.styles,
      niche: p.niche,
      rating: p.rating,
      ratingCount: p.ratingCount,
      portfolio: [],
      portfolioLink:
        row.directory_visible && row.directory_portfolio_consent
          ? publishedPortfolioLink(row.portfolio_link)
          : null,
      availability: row.availability,
    });
  });
  return routes;
}
