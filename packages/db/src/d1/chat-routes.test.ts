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
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>, app: ReturnType<typeof createApp>;
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
    { DB: db, BACKGROUND_QUEUE: { async send() {} }, STAGING_EMAIL_SIMULATED: "true" },
  );

before(async () => {
  process.env.AUTH_SECRET = "chat-routes-isolated-secret";
  db = await mf.getD1Database("DB");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "spokesperson"],
    [2, "editor"],
    [3, "editor"],
    [4, "spokesperson"],
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
  // Missão 1: voz 1 + editor 2. Missão 2: voz 4 + editor 3, sem relação com a primeira.
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(1,1,2,'Primeira','short','reservada'),(2,4,3,'Segunda','short','reservada')",
    )
    .run();
});
after(() => mf.dispose());

const seqs = async (res: Response) =>
  ((await res.json()) as { messages: { seq: number }[] }).messages.map((m) => m.seq);

test("rotas de leitura e cursor exigem sessão, validam entrada e isolam missões", async () => {
  // anônimo
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

  // cursor para frente, para trás e limites
  assert.deepEqual(await seqs(await request(`/missions/1?afterId=${all[0]}`, 1)), all.slice(1));
  const back = await request(`/missions/1?beforeId=${all[2]}&limit=1`, 1);
  assert.deepEqual(await seqs(back.clone()), [all[1]]);
  assert.equal(((await back.json()) as { hasMore: boolean }).hasMore, true);
  assert.equal((await request("/missions/1?afterId=abc", 1)).status, 400);
  assert.equal((await request("/missions/1?afterId=1&beforeId=9", 1)).status, 400);
  // formato `m-12` do id público também vale como cursor
  assert.equal((await request(`/missions/1?afterId=m-${all[2]}`, 1)).status, 200);

  // quem não participa não lê, não marca e não vê contagem
  assert.equal((await request("/missions/1?afterId=0", 3)).status, 403);
  assert.equal((await request("/missions/1?afterId=0", 4)).status, 403);
  assert.equal((await request("/missions/1/read", 3, "POST", { upTo: all[2] })).status, 403);
  assert.deepEqual(await (await request("/missions/unread", 3)).json(), { missions: [] });
  assert.equal((await request("/missions/999/read", 1, "POST", { upTo: 1 })).status, 404);
  assert.equal((await request("/missions/1/read", 1, "POST", {})).status, 400);

  // marcos do ciclo chegam na mesma resposta quando pedidos, e só para participantes
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

  // contagem e leitura pelo porta-voz; o editor, autor, não tem pendência
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

  // sessão revogada pela troca de papel/ban deixa de ler na hora
  await db.prepare("UPDATE users SET is_banned = 1 WHERE id = 1").run();
  assert.equal((await request("/missions/unread", 1)).status, 401);
});
