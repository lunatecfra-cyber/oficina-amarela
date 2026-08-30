import type { UserSession } from "@oficina/auth/session";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireAdmin, requireSession } from "../session.ts";

type ContentEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

export function createContentRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<ContentEnv>();

  // Public news
  routes.get("/news", async (c) => {
    const limit = Number(c.req.query("limit")) || 4;
    const list = await dependencies.news.getPublishedNews(limit);
    return c.json(list);
  });

  // Admin news
  routes.get("/admin/news", requireAdmin, async (c) => {
    const list = await dependencies.news.getAllNews();
    return c.json(list);
  });

  routes.post("/admin/news", requireAdmin, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body?.title ?? body?.titulo ?? "");
    const text = String(body?.text ?? body?.texto ?? "");
    const isPublished = Boolean(body?.isPublished ?? body?.publicada ?? true);

    const result = await dependencies.news.createNews(session.id, title, text, isPublished);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json(result, 201);
  });

  routes.post("/admin/news/:id/toggle", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const result = await dependencies.news.toggleNewsPublication(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json(result);
  });

  routes.delete("/admin/news/:id", requireAdmin, async (c) => {
    const id = Number(c.req.param("id"));
    const result = await dependencies.news.deleteNews(id);
    if (!result.ok) return c.json({ error: result.error, erro: result.error }, 400);
    return c.json({ ok: true });
  });

  // Music tool
  routes.get("/tools/music", requireSession, async (c) => {
    const tag = c.req.query("tag");
    const tracks = await dependencies.music.listMusicTracks(tag);
    return c.json(tracks);
  });

  routes.get("/tools/music/tags", requireSession, async (c) => {
    const tags = await dependencies.music.getAllMusicTags();
    return c.json(tags);
  });

  routes.post("/tools/music", requireAdmin, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body?.name ?? body?.nome ?? "").trim();
    const tags = Array.isArray(body?.tags) ? body.tags.map(String) : [];
    const url = String(body?.url ?? "").trim();
    const size = body?.size !== undefined ? Number(body.size) : null;

    if (!name || !url) {
      return c.json(
        { error: "Nome e URL são obrigatórios.", erro: "Nome e URL são obrigatórios." },
        400,
      );
    }

    await dependencies.music.addMusicTrack(name, tags, url, size, session.id);
    return c.json({ ok: true }, 201);
  });

  return routes;
}
