import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "lessons-tests" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>, app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
const ADMIN = 1;
const EDITOR = 2;
const OTHER_EDITOR = 3;
const SPOKESPERSON = 4;
const INSPECTOR = 5;
const VIDEO = "https://youtu.be/abcdefghijk";
let moduleId = 0;

const call = (method: string, path: string, actor: number | null, body?: unknown) =>
  app.request(
    `https://staging.local${path}`,
    {
      method,
      headers: { cookie: (actor && cookies[actor]) || "", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { DB: db, PUBLIC_ORIGIN: "https://staging.local" },
  );

async function createLesson(status: "draft" | "published", extra: Record<string, unknown> = {}) {
  const res = await call("POST", "/admin/lessons", ADMIN, {
    moduleId,
    title: "Ritmo de corte",
    description: "Como cortar no tempo certo",
    category: "Edição",
    level: "beginner",
    videoUrl: VIDEO,
    status,
    ...extra,
  });
  assert.equal(res.status, 201);
  return ((await res.json()) as { id: number }).id;
}

async function catalog(actor: number) {
  const res = await call("GET", "/lessons", actor);
  assert.equal(res.status, 200);
  return ((await res.json()) as { lessons: { id: number; completedAt: string | null }[] }).lessons;
}

before(async () => {
  process.env.AUTH_SECRET = "isolated-lessons-secret";
  db = await mf.getD1Database("DB");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [ADMIN, "admin"],
    [EDITOR, "editor"],
    [OTHER_EDITOR, "editor"],
    [SPOKESPERSON, "spokesperson"],
    [INSPECTOR, "inspector"],
  ] as const) {
    await db
      .prepare("INSERT INTO users(id,handle,name,email,role,profile_completed) VALUES(?,?,?,?,?,1)")
      .bind(
        id,
        `synthetic${id}`,
        `Synthetic ${id}`,
        `user${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
      )
      .run();
    cookies[id] =
      `${COOKIE_NAME}=${await createSessionToken({ id, handle: `synthetic${id}`, name: `Synthetic ${id}`, role })}`;
  }
  const track = await call("POST", "/admin/lessons/tracks", ADMIN, { title: "Fundamentos" });
  assert.equal(track.status, 201);
  const module = await call("POST", "/admin/lessons/modules", ADMIN, {
    trackId: ((await track.json()) as { id: number }).id,
    title: "Corte e ritmo",
  });
  assert.equal(module.status, 201);
  moduleId = ((await module.json()) as { id: number }).id;
});
after(() => mf.dispose());

test("draft lessons stay out of the catalog and out of direct reads", async () => {
  const id = await createLesson("draft");
  assert.ok(!(await catalog(EDITOR)).some((lesson) => lesson.id === id));
  assert.equal((await call("GET", `/lessons/${id}`, EDITOR)).status, 404);
  assert.equal((await call("PUT", `/lessons/${id}/progress`, EDITOR, {})).status, 404);
});

test("publishing makes the lesson visible with its embed url", async () => {
  const id = await createLesson("draft");
  const published = await call("PATCH", `/admin/lessons/${id}`, ADMIN, { status: "published" });
  assert.equal(published.status, 200);
  assert.ok((await catalog(EDITOR)).some((lesson) => lesson.id === id));
  const detail = (await (await call("GET", `/lessons/${id}`, EDITOR)).json()) as {
    videoUrl: string;
  };
  assert.equal(detail.videoUrl, "https://www.youtube-nocookie.com/embed/abcdefghijk");
});

test("only youtube and drive links are accepted as video", async () => {
  for (const videoUrl of [
    "https://evil.example/video.mp4",
    "javascript:alert(1)",
    "http://youtu.be/abcdefghijk",
    "",
  ]) {
    const res = await call("POST", "/admin/lessons", ADMIN, {
      moduleId,
      title: "Invalid video",
      videoUrl,
    });
    assert.equal(res.status, 400, videoUrl);
  }
});

test("management and learning endpoints enforce their own permission", async () => {
  const id = await createLesson("published");
  for (const [method, path, body] of [
    ["GET", "/admin/lessons", undefined],
    ["POST", "/admin/lessons", { moduleId, title: "x", videoUrl: VIDEO }],
    ["PATCH", `/admin/lessons/${id}`, { status: "archived" }],
    ["POST", "/admin/lessons/tracks", { title: "x" }],
  ] as const) {
    assert.equal((await call(method, path, null, body)).status, 401, `${method} ${path} anon`);
    assert.equal((await call(method, path, EDITOR, body)).status, 403, `${method} ${path} editor`);
    assert.equal(
      (await call(method, path, INSPECTOR, body)).status,
      403,
      `${method} ${path} inspector`,
    );
  }
  assert.equal((await call("GET", "/lessons", null)).status, 401);
  assert.equal((await call("GET", "/lessons", SPOKESPERSON)).status, 403);
  assert.equal((await call("GET", "/lessons", ADMIN)).status, 200);
});

test("progress persists across sessions and completion never moves", async () => {
  const id = await createLesson("published");
  const opened = (await (await call("PUT", `/lessons/${id}/progress`, EDITOR, {})).json()) as {
    completedAt: string | null;
  };
  assert.equal(opened.completedAt, null);

  const done = (await (
    await call("PUT", `/lessons/${id}/progress`, EDITOR, { completed: true })
  ).json()) as { completedAt: string };
  assert.ok(done.completedAt);

  // A fresh token stands in for a new login; the state must come from the database.
  cookies[EDITOR] =
    `${COOKIE_NAME}=${await createSessionToken({ id: EDITOR, handle: "synthetic2", name: "Synthetic 2", role: "editor" })}`;
  const again = (await (await call("PUT", `/lessons/${id}/progress`, EDITOR, {})).json()) as {
    completedAt: string;
  };
  assert.equal(again.completedAt, done.completedAt);
  assert.equal(
    (await catalog(EDITOR)).find((lesson) => lesson.id === id)?.completedAt,
    done.completedAt,
  );
});

test("a user cannot change another user's progress", async () => {
  const id = await createLesson("published");
  const res = await call("PUT", `/lessons/${id}/progress`, EDITOR, {
    completed: true,
    userId: OTHER_EDITOR,
    user_id: OTHER_EDITOR,
  });
  assert.equal(res.status, 200);
  assert.equal((await catalog(OTHER_EDITOR)).find((lesson) => lesson.id === id)?.completedAt, null);
  const rows = await db
    .prepare("SELECT user_id FROM lesson_progress WHERE lesson_id = ?")
    .bind(id)
    .all<{ user_id: number }>();
  assert.deepEqual(
    rows.results.map((row) => row.user_id),
    [EDITOR],
  );
});

test("archiving hides the lesson but keeps the learner's progress", async () => {
  const id = await createLesson("published");
  await call("PUT", `/lessons/${id}/progress`, EDITOR, { completed: true });

  const archived = await call("PATCH", `/admin/lessons/${id}`, ADMIN, { status: "archived" });
  assert.equal(archived.status, 200);
  assert.ok(!(await catalog(EDITOR)).some((lesson) => lesson.id === id));
  assert.equal((await call("GET", `/lessons/${id}`, EDITOR)).status, 404);
  assert.equal((await call("PUT", `/lessons/${id}/progress`, EDITOR, {})).status, 404);

  const kept = await db
    .prepare("SELECT completed_at FROM lesson_progress WHERE lesson_id = ? AND user_id = ?")
    .bind(id, EDITOR)
    .first<{ completed_at: string | null }>();
  assert.ok(kept?.completed_at);
});

test("republishing keeps the first publication date", async () => {
  const id = await createLesson("published");
  const first = await db
    .prepare("SELECT published_at FROM lessons WHERE id = ?")
    .bind(id)
    .first<{ published_at: string }>();
  assert.ok(first?.published_at);
  await call("PATCH", `/admin/lessons/${id}`, ADMIN, { status: "draft" });
  await call("PATCH", `/admin/lessons/${id}`, ADMIN, { status: "published" });
  const second = await db
    .prepare("SELECT published_at FROM lessons WHERE id = ?")
    .bind(id)
    .first<{ published_at: string }>();
  assert.equal(second?.published_at, first.published_at);
});

test("every management write leaves an audit row for the actor", async () => {
  const id = await createLesson("draft");
  await call("PATCH", `/admin/lessons/${id}`, ADMIN, { status: "published" });
  const rows = await db
    .prepare(
      "SELECT action, actor_id FROM admin_audit WHERE entity = 'lesson' AND entity_id = ? ORDER BY id",
    )
    .bind(String(id))
    .all<{ action: string; actor_id: number }>();
  assert.deepEqual(rows.results, [
    { action: "lesson_created", actor_id: ADMIN },
    { action: "lesson_updated", actor_id: ADMIN },
  ]);
});
