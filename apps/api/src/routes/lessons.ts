import type { UserSession } from "@oficina/auth/session";
import type { D1DatabaseLike } from "@oficina/db/d1/types";
import { LIMITS, limitStr } from "@oficina/domain/limits";
import { getEmbedUrl } from "@oficina/domain/tutorials";
import { Hono, type MiddlewareHandler } from "hono";
import type { Bindings } from "../app.ts";
import { requireCapability, requireEditor } from "../session.ts";

type LessonsEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const STATUSES = ["draft", "published", "archived"] as const;

type LessonFields = {
  moduleId: number;
  title: string;
  description: string;
  category: string;
  level: (typeof LEVELS)[number];
  videoUrl: string;
  durationMinutes: number | null;
  position: number;
  status: (typeof STATUSES)[number];
};

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const withDb: MiddlewareHandler<LessonsEnv> = async (c, next) => {
  if (!c.env.DB) return c.json({ error: "Videoaulas indisponíveis neste ambiente." }, 503);
  c.header("cache-control", "private, no-store");
  await next();
};

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/** Merges the request over `base` and validates the result; `base` is the stored row on edit. */
function readLesson(
  body: Record<string, unknown>,
  base: LessonFields,
): { ok: true; value: LessonFields } | { ok: false; error: string } {
  const value: LessonFields = { ...base };

  if (body.moduleId !== undefined) {
    if (!isId(body.moduleId)) return { ok: false, error: "Escolha o módulo." };
    value.moduleId = body.moduleId;
  }
  if (body.title !== undefined) value.title = limitStr(String(body.title), LIMITS.title);
  if (!value.title) return { ok: false, error: "Escreva um título." };
  if (body.description !== undefined)
    value.description = limitStr(String(body.description), LIMITS.longText);
  if (body.category !== undefined) value.category = limitStr(String(body.category), LIMITS.tag);
  if (body.level !== undefined) {
    if (!LEVELS.includes(body.level as never)) return { ok: false, error: "Escolha o nível." };
    value.level = body.level as LessonFields["level"];
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as never)) return { ok: false, error: "Status inválido." };
    value.status = body.status as LessonFields["status"];
  }
  if (body.videoUrl !== undefined) {
    const embed = getEmbedUrl(String(body.videoUrl));
    if (!embed) return { ok: false, error: "Use um link do YouTube ou do Google Drive." };
    value.videoUrl = embed;
  }
  if (!value.videoUrl) return { ok: false, error: "Informe o link do vídeo." };
  if (body.durationMinutes !== undefined) {
    const minutes = body.durationMinutes === "" ? null : body.durationMinutes;
    if (
      minutes !== null &&
      !(Number.isInteger(minutes) && (minutes as number) >= 1 && (minutes as number) <= 600)
    )
      return { ok: false, error: "A duração deve ficar entre 1 e 600 minutos." };
    value.durationMinutes = minutes as number | null;
  }
  if (body.position !== undefined) {
    if (
      !Number.isInteger(body.position) ||
      (body.position as number) < 0 ||
      (body.position as number) > 9999
    )
      return { ok: false, error: "A posição deve ficar entre 0 e 9999." };
    value.position = body.position as number;
  }
  return { ok: true, value };
}

const CATALOG_SELECT = `SELECT l.id, l.title, l.description, l.category, l.level,
  l.duration_minutes AS durationMinutes, l.published_at AS publishedAt,
  m.id AS moduleId, m.title AS moduleTitle,
  t.id AS trackId, t.title AS trackTitle, t.description AS trackDescription,
  p.completed_at AS completedAt, p.last_opened_at AS lastOpenedAt
  FROM lessons l
  JOIN lesson_modules m ON m.id = l.module_id
  JOIN lesson_tracks t ON t.id = m.track_id
  LEFT JOIN lesson_progress p ON p.lesson_id = l.id AND p.user_id = ?`;

export function createLessonRoutes() {
  const routes = new Hono<LessonsEnv>();

  // Learner area. The same gate as /aulas in the web proxy: editors, and admins for preview.
  routes.use("/lessons/*", requireEditor, withDb);
  // Management area.
  routes.use("/admin/lessons/*", requireCapability("content.manage"), withDb);

  routes.get("/lessons", async (c) => {
    const { results } = await (c.env.DB as D1DatabaseLike)
      .prepare(
        `${CATALOG_SELECT}
         WHERE l.status = 'published'
         ORDER BY t.position, t.id, m.position, m.id, l.position, l.id`,
      )
      .bind(c.get("session").id)
      .all();
    return c.json({ lessons: results });
  });

  routes.get("/lessons/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const lesson = isId(id)
      ? await (c.env.DB as D1DatabaseLike)
          .prepare(
            `${CATALOG_SELECT.replace("l.title,", "l.title, l.video_url AS videoUrl,")}
             WHERE l.id = ? AND l.status = 'published'`,
          )
          .bind(c.get("session").id, id)
          .first()
      : null;
    if (!lesson) return c.json({ error: "Aula não encontrada." }, 404);
    return c.json(lesson);
  });

  // Opening a lesson and finishing it are the same upsert. Completion is sticky:
  // reopening or repeating the call never clears or moves `completed_at`.
  routes.put("/lessons/:id/progress", async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => ({}))) as { completed?: unknown } | null;
    const completed = body?.completed === true;
    const progress = isId(id)
      ? await (c.env.DB as D1DatabaseLike)
          .prepare(
            `INSERT INTO lesson_progress(user_id, lesson_id, completed_at)
             SELECT ?, id, CASE WHEN ? THEN ${NOW} END FROM lessons WHERE id = ? AND status = 'published'
             ON CONFLICT(user_id, lesson_id) DO UPDATE SET
               last_opened_at = ${NOW},
               completed_at = COALESCE(lesson_progress.completed_at, excluded.completed_at)
             RETURNING last_opened_at AS lastOpenedAt, completed_at AS completedAt`,
          )
          .bind(c.get("session").id, completed ? 1 : 0, id)
          .first()
      : null;
    if (!progress) return c.json({ error: "Aula não encontrada." }, 404);
    return c.json(progress);
  });

  routes.get("/admin/lessons", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const [tracks, modules, lessons] = await Promise.all([
      db
        .prepare("SELECT id, title, description, position FROM lesson_tracks ORDER BY position, id")
        .all(),
      db
        .prepare(
          "SELECT id, track_id AS trackId, title, position FROM lesson_modules ORDER BY position, id",
        )
        .all(),
      db
        .prepare(
          `SELECT l.id, l.module_id AS moduleId, l.title, l.description, l.category, l.level,
             l.video_url AS videoUrl, l.duration_minutes AS durationMinutes, l.position, l.status,
             l.published_at AS publishedAt, l.updated_at AS updatedAt, u.handle AS author
           FROM lessons l LEFT JOIN users u ON u.id = l.author_id
           ORDER BY l.updated_at DESC, l.id DESC`,
        )
        .all(),
    ]);
    return c.json({
      tracks: tracks.results,
      modules: modules.results,
      lessons: lessons.results,
    });
  });

  routes.post("/admin/lessons/tracks", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const title = limitStr(String(body.title ?? ""), LIMITS.title);
    if (!title) return c.json({ error: "Escreva o nome da trilha." }, 400);
    const description = limitStr(String(body.description ?? ""), LIMITS.longText);
    const [created] = await db.batch!<{ results: { id: number }[] }>([
      db
        .prepare("INSERT INTO lesson_tracks(title, description) VALUES(?, ?) RETURNING id")
        .bind(title, description),
      db
        .prepare(
          `INSERT INTO admin_audit(actor_id, action, entity, entity_id, details)
           VALUES(?, 'lesson_track_created', 'lesson_track', CAST(last_insert_rowid() AS TEXT), json_object('title', ?))`,
        )
        .bind(c.get("session").id, title),
    ]);
    return c.json({ id: created.results[0].id }, 201);
  });

  routes.post("/admin/lessons/modules", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const title = limitStr(String(body.title ?? ""), LIMITS.title);
    if (!title) return c.json({ error: "Escreva o nome do módulo." }, 400);
    if (
      !isId(body.trackId) ||
      !(await db
        .prepare("SELECT 1 AS ok FROM lesson_tracks WHERE id = ?")
        .bind(body.trackId)
        .first())
    )
      return c.json({ error: "Escolha a trilha." }, 400);
    const [created] = await db.batch!<{ results: { id: number }[] }>([
      db
        .prepare("INSERT INTO lesson_modules(track_id, title) VALUES(?, ?) RETURNING id")
        .bind(body.trackId, title),
      db
        .prepare(
          `INSERT INTO admin_audit(actor_id, action, entity, entity_id, details)
           VALUES(?, 'lesson_module_created', 'lesson_module', CAST(last_insert_rowid() AS TEXT), json_object('title', ?))`,
        )
        .bind(c.get("session").id, title),
    ]);
    return c.json({ id: created.results[0].id }, 201);
  });

  routes.post("/admin/lessons", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const parsed = readLesson(body, {
      moduleId: 0,
      title: "",
      description: "",
      category: "",
      level: "beginner",
      videoUrl: "",
      durationMinutes: null,
      position: 0,
      status: "draft",
    });
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const lesson = parsed.value;
    if (
      !isId(lesson.moduleId) ||
      !(await db
        .prepare("SELECT 1 AS ok FROM lesson_modules WHERE id = ?")
        .bind(lesson.moduleId)
        .first())
    )
      return c.json({ error: "Escolha o módulo." }, 400);

    const actorId = c.get("session").id;
    const [created] = await db.batch!<{ results: { id: number }[] }>([
      db
        .prepare(
          `INSERT INTO lessons(module_id, title, description, category, level, video_url,
             duration_minutes, position, status, author_id, published_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN ${NOW} END)
           RETURNING id`,
        )
        .bind(
          lesson.moduleId,
          lesson.title,
          lesson.description,
          lesson.category,
          lesson.level,
          lesson.videoUrl,
          lesson.durationMinutes,
          lesson.position,
          lesson.status,
          actorId,
          lesson.status,
        ),
      db
        .prepare(
          `INSERT INTO admin_audit(actor_id, action, entity, entity_id, details)
           VALUES(?, 'lesson_created', 'lesson', CAST(last_insert_rowid() AS TEXT), json_object('status', ?))`,
        )
        .bind(actorId, lesson.status),
    ]);
    return c.json({ id: created.results[0].id }, 201);
  });

  // One endpoint covers edit, publish, unpublish and archive: they are all a status or field change.
  routes.patch("/admin/lessons/:id", async (c) => {
    const db = c.env.DB as D1DatabaseLike;
    const id = Number(c.req.param("id"));
    const current = isId(id)
      ? await db
          .prepare(
            `SELECT module_id AS moduleId, title, description, category, level, video_url AS videoUrl,
               duration_minutes AS durationMinutes, position, status
             FROM lessons WHERE id = ?`,
          )
          .bind(id)
          .first<LessonFields>()
      : null;
    if (!current) return c.json({ error: "Aula não encontrada." }, 404);

    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const parsed = readLesson(body, current);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const lesson = parsed.value;
    if (
      body.moduleId !== undefined &&
      !(await db
        .prepare("SELECT 1 AS ok FROM lesson_modules WHERE id = ?")
        .bind(lesson.moduleId)
        .first())
    )
      return c.json({ error: "Escolha o módulo." }, 400);

    const actorId = c.get("session").id;
    await db.batch!([
      db
        .prepare(
          `UPDATE lessons SET module_id = ?, title = ?, description = ?, category = ?, level = ?,
             video_url = ?, duration_minutes = ?, position = ?, status = ?,
             published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ${NOW}) ELSE published_at END,
             updated_at = ${NOW}
           WHERE id = ?`,
        )
        .bind(
          lesson.moduleId,
          lesson.title,
          lesson.description,
          lesson.category,
          lesson.level,
          lesson.videoUrl,
          lesson.durationMinutes,
          lesson.position,
          lesson.status,
          lesson.status,
          id,
        ),
      db
        .prepare(
          `INSERT INTO admin_audit(actor_id, action, entity, entity_id, details)
           VALUES(?, 'lesson_updated', 'lesson', ?, json_object('from', ?, 'to', ?))`,
        )
        .bind(actorId, String(id), current.status, lesson.status),
    ]);
    return c.json({ id });
  });

  return routes;
}
