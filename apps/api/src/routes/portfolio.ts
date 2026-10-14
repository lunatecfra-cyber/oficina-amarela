import type { UserSession } from "@oficina/auth/session";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { PORTFOLIO_AUTHORIZATION_STATEMENT } from "@oficina/domain/portfolio";
import { hasCapability } from "@oficina/domain/roles";
import { validateRawMediaUpload } from "@oficina/domain/uploads";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import { requireSession } from "../session.ts";
import { readMissionMedia } from "./mission-files.ts";

export function createPortfolioRoutes() {
  const routes = new Hono<{
    Bindings: Bindings;
    Variables: { session: UserSession; requestId: string };
  }>();
  routes.use("*", requireSession);
  routes.use("*", async (c, next) => {
    c.header("cache-control", "private, no-store");
    if (!c.env.DB) return c.json({ error: "Portfólio indisponível neste ambiente." }, 503);
    const account = await (c.env.DB as D1DatabaseLike)
      .prepare("SELECT role FROM users WHERE id=? AND is_banned=0")
      .bind(c.get("session").id)
      .first<{ role: string }>();
    if (
      !account ||
      (account.role === "voz" ? "spokesperson" : account.role) !== c.get("session").role
    )
      return c.json({ error: "Sua conta não pode acessar o portfólio." }, 403);
    await next();
  });
  routes.get("/", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const actor = c.get("session");
    const { results: samples } = await db
      .prepare(`SELECT s.id,s.title,s.description,s.specialties,
      s.preview_seconds AS previewSeconds,s.media_kind AS mediaKind,s.editor_visible AS editorVisible,s.owner_authorized AS ownerAuthorized,
      s.authorization_statement AS authorizationStatement,s.revision,s.mission_id AS missionId,s.delivery_version AS deliveryVersion,
      u.name AS editorName,u.handle AS editorHandle,m.title AS missionTitle,
      EXISTS(SELECT 1 FROM published_portfolio_samples p WHERE p.id=s.id) AS published
      FROM portfolio_samples s JOIN missions m ON m.id=s.mission_id JOIN users u ON u.id=s.editor_id
      WHERE s.editor_id=? OR m.spokesperson_id=? OR ?='admin' ORDER BY s.created_at DESC LIMIT 100`)
      .bind(actor.id, actor.id, actor.role)
      .all();
    const { results: eligible } = await db
      .prepare(`SELECT m.id AS missionId,m.title,d.version AS deliveryVersion,
      COALESCE(d.delivery_video_url,d.delivery_link) AS assetUrl
      FROM missions m JOIN mission_deliveries d ON d.mission_id=m.id AND d.version=m.delivery_version
      JOIN users u ON u.id=d.editor_id
      WHERE m.status='finalizada' AND m.reserved_by_id=? AND d.editor_id=? AND u.role='editor' AND u.is_banned=0
      AND NOT EXISTS(SELECT 1 FROM portfolio_samples s WHERE s.mission_id=m.id AND s.delivery_version=d.version)
      ORDER BY d.submitted_at DESC LIMIT 100`)
      .bind(actor.id, actor.id)
      .all();
    return c.json({ samples, eligible, role: actor.role });
  });
  routes.post("/", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const actor = c.get("session");
    const body = await c.req.json().catch(() => null);
    if (
      !body ||
      !Number.isSafeInteger(body.missionId) ||
      body.missionId <= 0 ||
      !Number.isSafeInteger(body.deliveryVersion) ||
      body.deliveryVersion <= 0
    )
      return c.json({ error: "Escolha uma entrega finalizada." }, 400);
    const delivery = await db
      .prepare(`SELECT COALESCE(d.delivery_video_url,d.delivery_link) AS assetUrl,m.title
      FROM missions m JOIN mission_deliveries d ON d.mission_id=m.id AND d.version=m.delivery_version
      JOIN users u ON u.id=d.editor_id
      WHERE m.id=? AND d.version=? AND m.status='finalizada' AND m.reserved_by_id=? AND d.editor_id=? AND u.role='editor' AND u.is_banned=0`)
      .bind(body.missionId, body.deliveryVersion, actor.id, actor.id)
      .first<{ assetUrl: string | null; title: string }>();
    if (!delivery)
      return c.json({ error: "Essa entrega não está disponível para seu portfólio." }, 404);
    let url: URL;
    try {
      url = new URL(delivery.assetUrl!);
    } catch {
      return c.json(
        { error: "Use uma entrega armazenada na Oficina para proteger a autorização." },
        409,
      );
    }
    const match = /^\/api\/missions\/(\d+)\/files\/(\d+)\/([a-f0-9-]{36})$/.exec(url.pathname);
    if (
      !match ||
      url.origin !== c.env.PUBLIC_ORIGIN ||
      url.search ||
      url.hash ||
      Number(match[1]) !== body.missionId ||
      Number(match[2]) !== actor.id
    )
      return c.json(
        { error: "Use uma entrega armazenada na Oficina para proteger a autorização." },
        409,
      );
    const key = `missions/${body.missionId}/${actor.id}/${match[3]}`;
    const media = await c.env.MEDIA?.head(key);
    if (
      !media ||
      media.customMetadata?.ownerId !== String(actor.id) ||
      media.customMetadata?.missionId !== String(body.missionId) ||
      media.size !== Number(media.customMetadata?.expectedSize) ||
      !validateRawMediaUpload(media.httpMetadata?.contentType || "", media.size).ok
    )
      return c.json({ error: "Arquivo indisponível ou incompleto." }, 409);
    const policy = validateRawMediaUpload(media.httpMetadata?.contentType || "", media.size);
    if (!policy.ok) return c.json({ error: policy.error }, policy.status);
    const id = crypto.randomUUID();
    await db
      .prepare(`INSERT INTO portfolio_samples(id,mission_id,delivery_version,editor_id,asset_key,asset_url,media_kind,title,last_actor_id)
      SELECT ?,m.id,d.version,d.editor_id,?,?,?,substr(m.title,1,120),?
      FROM missions m JOIN mission_deliveries d ON d.mission_id=m.id AND d.version=m.delivery_version
      WHERE m.id=? AND d.version=? AND m.status='finalizada' AND m.reserved_by_id=? AND d.editor_id=? AND COALESCE(d.delivery_video_url,d.delivery_link)=?
      ON CONFLICT(mission_id,delivery_version,editor_id) DO NOTHING`)
      .bind(
        id,
        key,
        delivery.assetUrl,
        policy.kind,
        actor.id,
        body.missionId,
        body.deliveryVersion,
        actor.id,
        actor.id,
        delivery.assetUrl,
      )
      .run();
    const sample = await db
      .prepare(
        "SELECT id FROM portfolio_samples WHERE mission_id=? AND delivery_version=? AND editor_id=?",
      )
      .bind(body.missionId, body.deliveryVersion, actor.id)
      .first();
    return sample
      ? c.json(sample, 201)
      : c.json({ error: "A entrega mudou. Atualize e tente novamente." }, 409);
  });
  routes.post("/:id", async (c) => {
    const db = c.env.DB as D1DatabaseLike,
      actor = c.get("session");
    const body = await c.req.json().catch(() => null);
    if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0)
      return c.json({ error: "Atualize a amostra antes de alterar." }, 400);
    const sample = await db
      .prepare(`SELECT s.editor_id,m.spokesperson_id FROM portfolio_samples s
      JOIN missions m ON m.id=s.mission_id WHERE s.id=? AND (s.editor_id=? OR m.spokesperson_id=? OR ?='admin')`)
      .bind(c.req.param("id"), actor.id, actor.id, actor.role)
      .first<{ editor_id: number; spokesperson_id: number }>();
    if (!sample) return c.json({ error: "Amostra indisponível." }, 404);
    let update: string, values: unknown[];
    if (body.action === "edit" && sample.editor_id === actor.id && actor.role === "editor") {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.trim().length > 120 ||
        typeof body.description !== "string" ||
        body.description.length > 1000 ||
        typeof body.specialties !== "string" ||
        body.specialties.length > 200 ||
        !Number.isInteger(body.previewSeconds) ||
        body.previewSeconds < 0 ||
        body.previewSeconds > 3600
      )
        return c.json(
          {
            error:
              "Confira título, descrição, especialidades e instante da prévia (0 a 3600 segundos).",
          },
          400,
        );
      update =
        "title=?,description=?,specialties=?,preview_seconds=?,editor_visible=0,owner_authorized=0,authorization_statement=NULL,authorized_by=NULL";
      values = [
        body.title.trim(),
        body.description.trim(),
        body.specialties.trim(),
        body.previewSeconds,
      ];
    } else if (
      body.action === "request" &&
      sample.editor_id === actor.id &&
      actor.role === "editor"
    ) {
      update = "editor_visible=1";
      values = [];
    } else if (
      body.action === "remove" &&
      sample.editor_id === actor.id &&
      actor.role === "editor"
    ) {
      update =
        "editor_visible=0,owner_authorized=0,authorization_statement=NULL,authorized_by=NULL";
      values = [];
    } else if (
      body.action === "authorize" &&
      sample.spokesperson_id === actor.id &&
      actor.role === "spokesperson"
    ) {
      if (body.rightsConfirmed !== true)
        return c.json(
          { error: "Confirme que tem todas as permissões necessárias para divulgar esta amostra." },
          400,
        );
      update = "owner_authorized=1,authorization_statement=?,authorized_by=?";
      values = [PORTFOLIO_AUTHORIZATION_STATEMENT, actor.id];
    } else if (
      body.action === "revoke" &&
      (sample.spokesperson_id === actor.id || hasCapability(actor, "portfolio.moderate"))
    ) {
      update = "owner_authorized=0,authorization_statement=NULL,authorized_by=NULL";
      values = [];
    } else return c.json({ error: "Você não pode realizar essa ação." }, 403);
    const result = await db
      .prepare(`UPDATE portfolio_samples SET ${update},revision=revision+1,last_actor_id=? WHERE id=? AND revision=?
      AND EXISTS(SELECT 1 FROM users WHERE id=? AND is_banned=0)`)
      .bind(...values, actor.id, c.req.param("id"), body.revision, actor.id)
      .run();
    return result.meta.changes
      ? c.json({ ok: true })
      : c.json({ error: "A amostra foi alterada. Atualize antes de tentar novamente." }, 409);
  });
  routes.get("/:id/media", async (c) => {
    const db = c.env.DB as D1DatabaseLike,
      actor = c.get("session"),
      id = c.req.param("id");
    const access = () =>
      db
        .prepare(`SELECT s.asset_key FROM portfolio_samples s JOIN missions m ON m.id=s.mission_id
      WHERE s.id=? AND (s.editor_id=? OR m.spokesperson_id=? OR ?='admin' OR EXISTS(SELECT 1 FROM published_portfolio_samples p WHERE p.id=s.id))`)
        .bind(id, actor.id, actor.id, actor.role)
        .first<{ asset_key: string }>();
    const sample = await access();
    if (!sample) return c.json({ error: "Amostra não publicada ou autorização revogada." }, 404);
    if (!c.env.MEDIA) return c.json({ error: "Mídia indisponível." }, 503);
    const response = await readMissionMedia(c.env.MEDIA, sample.asset_key, c.req.header("range"));
    if (!(await access())) return c.json({ error: "A autorização foi revogada." }, 404);
    return response;
  });
  return routes;
}
