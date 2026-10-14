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
    d1Databases: { DB: "chat-routes" },
    r2Buckets: { MEDIA: "chat-routes" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>,
  media: Awaited<ReturnType<typeof mf.getR2Bucket>>,
  app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
const request = (path: string, actor?: number, method = "GET", body?: unknown) =>
  app.request(
    `https://staging.local${path}`,
    {
      method,
      headers: {
        cookie: actor ? (cookies[actor] ?? "") : "",
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      MEDIA: media as never,
      BACKGROUND_QUEUE: { async send() {} },
      STAGING_EMAIL_SIMULATED: "true",
    },
  );

before(async () => {
  process.env.AUTH_SECRET = "chat-routes-isolated-secret";
  db = await mf.getD1Database("DB");
  media = await mf.getR2Bucket("MEDIA");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "spokesperson"],
    [2, "editor"],
    [3, "editor"],
    [4, "spokesperson"],
    [5, "spokesperson"],
    [6, "editor"],
    [7, "editor"],
  ] as const) {
    await db
      .prepare("INSERT INTO users(id,handle,name,email,role,profile_completed) VALUES(?,?,?,?,?,1)")
      .bind(
        id,
        `chat${id}`,
        `Chat ${id}`,
        `chat${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
      )
      .run();
    cookies[id] =
      `${COOKIE_NAME}=${await createSessionToken({ id, role, handle: `chat${id}`, name: `Chat ${id}` })}`;
  }
  // Mission 1: voice 1 + editor 2. Mission 2: voice 4 + editor 3, unrelated to the first.
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(1,1,2,'Primeira','short','reservada'),(2,4,3,'Segunda','short','reservada')",
    )
    .run();
});
after(() => mf.dispose());

const seqs = async (res: Response) =>
  ((await res.json()) as { messages: { seq: number }[] }).messages.map((m) => m.seq);

test("read and cursor routes require a session, validate input and isolate missions", async () => {
  // anonymous
  assert.equal((await request("/missions/unread")).status, 401);
  assert.equal((await request("/missions/1?afterId=0")).status, 401);
  assert.equal((await request("/missions/1/read", undefined, "POST", { upTo: 1 })).status, 401);

  for (const text of ["a", "b", "c"]) {
    assert.equal(
      (await request("/missions/1", 2, "POST", { action: "message", text })).status,
      200,
    );
  }
  const all = await seqs(await request("/missions/1?afterId=0", 1));
  assert.equal(all.length, 3);

  // forward and backward cursors, and limits
  assert.deepEqual(await seqs(await request(`/missions/1?afterId=${all[0]}`, 1)), all.slice(1));
  const back = await request(`/missions/1?beforeId=${all[2]}&limit=1`, 1);
  assert.deepEqual(await seqs(back.clone()), [all[1]]);
  assert.equal(((await back.json()) as { hasMore: boolean }).hasMore, true);
  assert.equal((await request("/missions/1?afterId=abc", 1)).status, 400);
  assert.equal((await request("/missions/1?afterId=1&beforeId=9", 1)).status, 400);
  // the `m-12` public id format also works as a cursor
  assert.equal((await request(`/missions/1?afterId=m-${all[2]}`, 1)).status, 200);

  // non-participants cannot read, mark or see counts
  assert.equal((await request("/missions/1?afterId=0", 3)).status, 403);
  assert.equal((await request("/missions/1?afterId=0", 4)).status, 403);
  assert.equal((await request("/missions/1/read", 3, "POST", { upTo: all[2] })).status, 403);
  assert.deepEqual(await (await request("/missions/unread", 3)).json(), { missions: [] });
  assert.equal((await request("/missions/999/read", 1, "POST", { upTo: 1 })).status, 404);
  assert.equal((await request("/missions/1/read", 1, "POST", {})).status, 400);

  // lifecycle events arrive in the same response when requested, and only for participants
  await db
    .prepare(
      "INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version) VALUES('mission:1:accepted:1',1,1,'accepted',0)",
    )
    .run();
  const withEvents = (await (await request("/missions/1?afterId=0&events=1", 2)).json()) as {
    events?: { event: string }[];
  };
  assert.deepEqual(
    withEvents.events?.map((e) => e.event),
    ["accepted"],
  );
  const without = (await (await request("/missions/1?afterId=0", 2)).json()) as {
    events?: unknown;
  };
  assert.equal(without.events, undefined);
  assert.equal((await request("/missions/1?afterId=0&events=1", 3)).status, 403);

  // counts and reads by the spokesperson; the editor, as author, has nothing pending
  const unread = (await (await request("/missions/unread", 1)).json()) as {
    missions: { missionId: number; unread: number }[];
  };
  assert.deepEqual(
    unread.missions.map((m) => [m.missionId, m.unread]),
    [[1, 3]],
  );
  assert.deepEqual(await (await request("/missions/unread", 2)).json(), { missions: [] });
  const read = await request("/missions/1/read", 1, "POST", { upTo: all[1] });
  assert.deepEqual(await read.json(), { ok: true, lastReadId: all[1] });
  assert.deepEqual(await (await request("/missions/1/read", 1, "POST", { upTo: all[0] })).json(), {
    ok: true,
    lastReadId: all[1],
  });
  const left = (await (await request("/missions/unread", 1)).json()) as {
    missions: { unread: number }[];
  };
  assert.equal(left.missions[0]?.unread, 1);

  // a session revoked by role change/ban stops reading immediately
  await db.prepare("UPDATE users SET is_banned = 1 WHERE id = 1").run();
  assert.equal((await request("/missions/unread", 1)).status, 401);
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
const upload = (
  path: string,
  actor: number | undefined,
  file: Blob | null,
  name = "prova.png",
  text?: string,
) => {
  const form = new FormData();
  if (file) form.set("file", file, name);
  if (text !== undefined) form.set("text", text);
  return app.request(
    `https://staging.local${path}`,
    { method: "POST", headers: { cookie: actor ? (cookies[actor] ?? "") : "" }, body: form },
    {
      DB: db,
      MEDIA: media as never,
      BACKGROUND_QUEUE: { async send() {} },
      STAGING_EMAIL_SIMULATED: "true",
    },
  );
};
const objectCount = async () => (await media.list()).objects.length;

test("attachments: authorization before R2, verified type, isolation and transfer", async () => {
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(3,5,6,'Terceira','short','reservada')",
    )
    .run();
  const png = new Blob([new Uint8Array(PNG)], { type: "image/png" });

  // no session or not a participant: nothing is written
  const before = await objectCount();
  assert.equal((await upload("/missions/3/attachments", undefined, png)).status, 401);
  assert.equal((await upload("/missions/3/attachments", 3, png)).status, 403);
  assert.equal((await upload("/missions/3/attachments", 4, png)).status, 403);
  assert.equal(await objectCount(), before);

  // invalid input
  assert.equal((await upload("/missions/3/attachments", 6, null)).status, 400);
  assert.equal(
    (
      await upload(
        "/missions/3/attachments",
        6,
        new Blob(["texto"], { type: "text/plain" }),
        "a.txt",
      )
    ).status,
    415,
  );
  // declares PNG but the content is not
  assert.equal(
    (await upload("/missions/3/attachments", 6, new Blob(["nao sou png"], { type: "image/png" })))
      .status,
    415,
  );
  const big = new Blob([new Uint8Array(10 * 1024 ** 2 + 1)], { type: "application/pdf" });
  assert.equal((await upload("/missions/3/attachments", 6, big, "g.pdf")).status, 413);
  assert.equal(await objectCount(), before);

  // valid send: message + attachment, hash checked, name sanitized
  const sent = await upload("/missions/3/attachments", 6, png, "..\\pasta/prova final.png", "veja");
  assert.equal(sent.status, 200);
  const { message } = (await sent.json()) as {
    message: {
      text: string;
      attachments: { id: number; filename: string; contentType: string; size: number }[];
    };
  };
  assert.equal(message.text, "veja");
  const [attachment] = message.attachments;
  assert.deepEqual(
    [attachment?.filename, attachment?.contentType, attachment?.size],
    ["prova final.png", "image/png", PNG.length],
  );
  const stored = await db
    .prepare("SELECT object_key, sha256 FROM message_attachments WHERE id = ?")
    .bind(attachment?.id)
    .first<{ object_key: string; sha256: string }>();
  const expected = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(PNG)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  assert.equal(stored?.sha256, expected);
  assert.ok(stored?.object_key.startsWith("chat/3/"));
  assert.equal(await objectCount(), before + 1);

  // the messages page already carries the attachment
  const page = (await (await request("/missions/3?afterId=0", 5)).json()) as {
    messages: { attachments?: { id: number }[] }[];
  };
  assert.equal(page.messages[0]?.attachments?.[0]?.id, attachment?.id);

  // download: the other party gets the same bytes, with containment headers
  const path = `/missions/3/attachments/${attachment?.id}`;
  const download = await request(path, 5);
  assert.equal(download.status, 200);
  assert.deepEqual([...new Uint8Array(await download.arrayBuffer())], PNG);
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.equal(download.headers.get("cache-control"), "private, no-store");
  assert.match(download.headers.get("content-security-policy") ?? "", /sandbox/);

  // no session, outside the mission, and another conversation's id does not open through this path
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, 3)).status, 403);
  assert.equal((await request(`/missions/2/attachments/${attachment?.id}`, 4)).status, 404);
  assert.equal((await request("/missions/3/attachments/abc", 5)).status, 400);

  // editor replaced: the previous one loses access at once
  await db.prepare("UPDATE missions SET reserved_by_id = 7 WHERE id = 3").run();
  assert.equal((await request(path, 6)).status, 403);
  assert.equal((await upload("/missions/3/attachments", 6, png)).status, 403);
  assert.equal((await request(path, 7)).status, 200);

  // an attachment is not rewritten after being sent
  await assert.rejects(
    db
      .prepare("UPDATE message_attachments SET filename = 'x' WHERE id = ?")
      .bind(attachment?.id)
      .run(),
    /attachment_immutable/,
  );
});
