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
    d1Databases: { DB: "board-tests" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>, app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
const call = (path: string, actor = 2, body?: unknown) =>
  app.request(
    `https://staging.local${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie: cookies[actor] || "", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      BACKGROUND_QUEUE: { async send() {} },
      STAGING_EMAIL_SIMULATED: "true",
      PUBLIC_ORIGIN: "https://staging.local",
    },
  );
before(async () => {
  process.env.AUTH_SECRET = "isolated-board-secret";
  db = await mf.getD1Database("DB");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "spokesperson"],
    [2, "editor"],
    [3, "editor"],
    [4, "spokesperson"],
    [5, "editor"],
  ] as const) {
    await db
      .prepare("INSERT INTO users(id,handle,name,email,role,profile_completed) VALUES(?,?,?,?,?,?)")
      .bind(
        id,
        `synthetic${id}`,
        `Synthetic ${id}`,
        `user${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
        id === 5 ? 0 : 1,
      )
      .run();
    cookies[id] =
      `${COOKIE_NAME}=${await createSessionToken({ id, handle: `synthetic${id}`, name: `Synthetic ${id}`, role })}`;
  }
});
after(() => mf.dispose());
async function mission() {
  const res = await call("/missions", 1, {
    title: "Synthetic board",
    format: "short",
    driveLink: "https://drive.google.com/private-material",
    deadline: "2026-11-01",
    motivation: "Briefing",
  });
  assert.equal(res.status, 201);
  return ((await res.json()) as { id: number }).id;
}
test("publicação manual, mural privado, autenticação e bloqueio de reserva direta", async () => {
  const id = await mission();
  assert.equal(
    await d1ApiDependencies(db as unknown as D1DatabaseLike).missionQueue.dispatchOffers(),
    0,
  );
  assert.equal((await call("/missions/board", 0)).status, 401);
  assert.equal((await call("/missions/board", 1)).status, 403);
  const body = await (await call("/missions/board")).text();
  assert.ok(body.includes("Briefing"));
  assert.ok(!body.includes("private-material"));
  assert.equal((await call(`/missions/${id}`, 2, { action: "reserve" })).status, 409);
  assert.equal(
    ((await (await call("/missions/board", 5)).json()) as { eligible: boolean }).eligible,
    false,
  );
});
test("interesse concorrente idempotente não atribui; suspensão, perfil e capacidade são enforced", async () => {
  const id = await mission();
  assert.equal((await call(`/missions/${id}/interest`, 5, {})).status, 409);
  assert.equal((await call(`/missions/${id}/interest`, 1, {})).status, 403);
  const results = await Promise.all([
    call(`/missions/${id}/interest`, 2, {}),
    call(`/missions/${id}/interest`, 2, {}),
  ]);
  assert.ok(results.every((r) => [200, 201].includes(r.status)));
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM mission_interests WHERE mission_id=?")
        .bind(id)
        .first<{ n: number }>()
    )?.n,
    1,
  );
  assert.deepEqual(
    await db.prepare("SELECT status,reserved_by_id FROM missions WHERE id=?").bind(id).first(),
    { status: "disponivel", reserved_by_id: null },
  );
  for (const change of [
    "is_banned=1",
    "availability='[[false,false,false,false,false,false,false],[false,false,false,false,false,false,false],[false,false,false,false,false,false,false]]'",
    "reservations_locked_until='2099-01-01T00:00:00.000Z'",
  ]) {
    await db.prepare(`UPDATE users SET ${change} WHERE id=3`).run();
    assert.equal((await call(`/missions/${id}/interest`, 3, {})).status, 409);
    await db
      .prepare(
        "UPDATE users SET is_banned=0,reservations_locked_until=NULL,availability=NULL WHERE id=3",
      )
      .run();
  }
});
test("seleção concorrente, posse exclusiva, autorização e retries", async () => {
  const id = await mission();
  await call(`/missions/${id}/interest`, 2, {});
  await call(`/missions/${id}/interest`, 3, {});
  assert.equal(
    (await call(`/missions/${id}/selection`, 4, { editorId: 3, kind: "interest" })).status,
    404,
  );
  assert.equal((await call(`/missions/${id}/selection`, 4)).status, 404);
  const responses = await Promise.all([
    call(`/missions/${id}/selection`, 1, { editorId: 3, kind: "interest" }),
    call(`/missions/${id}/selection`, 1, { editorId: 2, kind: "interest" }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const offer = await db
    .prepare("SELECT editor_id FROM offers WHERE mission_id=? AND status='pendente'")
    .bind(id)
    .first<{ editor_id: number }>();
  assert.ok(offer);
  const winner = offer.editor_id,
    loser = winner === 2 ? 3 : 2;
  assert.equal(
    (await call(`/missions/${id}/selection`, 1, { editorId: winner, kind: "interest" })).status,
    200,
  );
  assert.equal(
    (await call("/editor/queue/next", loser, { action: "accept", missionId: id })).status,
    409,
  );
  assert.equal(
    (await call("/editor/queue/next", winner, { action: "accept", missionId: id })).status,
    200,
  );
  assert.equal(
    (await call("/editor/queue/next", winner, { action: "accept", missionId: id })).status,
    200,
  );
  assert.equal((await call(`/missions/${id}/interest`, 5, {})).status, 409);
  assert.equal((await call(`/missions/${id}`, loser, { action: "reserve" })).status, 409);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) AS n FROM mission_assignments WHERE mission_id=? AND ended_at IS NULL",
        )
        .bind(id)
        .first<{ n: number }>()
    )?.n,
    1,
  );
  await db
    .prepare("UPDATE missions SET status='disponivel',reserved_by_id=NULL WHERE id=?")
    .bind(id)
    .run();
});
test("convite direto compartilha oferta; recusa e expiração reabrem escolha manual", async () => {
  const id = await mission();
  assert.equal(
    (await call(`/missions/${id}/selection`, 1, { editorId: 2, kind: "direct" })).status,
    201,
  );
  assert.equal((await call(`/missions/${id}/interest`, 2, {})).status, 409);
  assert.equal(
    (await call("/editor/queue/next", 2, { missionId: id, action: "decline" })).status,
    200,
  );
  assert.equal(
    (await call(`/missions/${id}/selection`, 1, { editorId: 2, kind: "direct" })).status,
    409,
  );
  assert.equal(
    (await call(`/missions/${id}/selection`, 1, { editorId: 3, kind: "direct" })).status,
    201,
  );
  await db
    .prepare(
      "UPDATE offers SET expires_at='2000-01-01T00:00:00.000Z',offered_at='2000-01-01T00:00:00.000Z' WHERE mission_id=? AND status='pendente'",
    )
    .bind(id)
    .run();
  assert.equal(
    (await call("/editor/queue/next", 3, { missionId: id, action: "accept" })).status,
    409,
  );
  const recovered = await call(`/missions/${id}/selection`, 1);
  assert.equal(((await recovered.json()) as { status: string }).status, "disponivel");
  assert.equal(
    (
      await db
        .prepare("SELECT status FROM missions WHERE id=?")
        .bind(id)
        .first<{ status: string }>()
    )?.status,
    "disponivel",
  );
  assert.equal(
    await d1ApiDependencies(db as unknown as D1DatabaseLike).missionQueue.dispatchOffers(),
    0,
  );
});
test("SQL não contorna seleção; integridade preservada", async () => {
  const id = await mission();
  await assert.rejects(
    db
      .prepare(
        "INSERT INTO offers(mission_id,editor_id,status,offered_at,expires_at) VALUES(?,2,'pendente',?,?)",
      )
      .bind(id, new Date().toISOString(), "2099-01-01T00:00:00.000Z")
      .run(),
  );
  await assert.rejects(
    db.prepare("UPDATE missions SET status='reservada',reserved_by_id=2 WHERE id=?").bind(id).run(),
  );
  assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
});

test("diretório é opt-in, não expõe dados privados e consentimento pode ser revogado", async () => {
  const list = async (path = "/editors") =>
    (async () => {
      const r = await call(path, 1);
      assert.equal(r.status, 200);
      return r.json() as Promise<{ handle: string; rating: null; portfolioLink: string | null }[]>;
    })();
  assert.equal((await call("/editors", 0)).status, 401);
  assert.equal((await call("/editor/profile/synthetic2", 0)).status, 401);
  assert.equal((await call("/editor/profile/synthetic2", 4)).status, 403);
  assert.deepEqual(await list(), []);
  assert.equal(
    (await call("/editors/visibility", 1, { visible: true, portfolioConsent: true })).status,
    403,
  );
  await db
    .prepare(
      "UPDATE users SET portfolio_link='https://example.invalid/portfolio',whatsapp='+5511999999999',editing_styles='[\"Documentário\"]' WHERE id=2",
    )
    .run();
  assert.equal(
    (await call("/editors/visibility", 2, { visible: true, portfolioConsent: false })).status,
    200,
  );
  const published = await list();
  assert.equal(published.length, 1);
  assert.equal(published[0].rating, null);
  assert.equal(published[0].portfolioLink, null);
  assert.ok(!JSON.stringify(published).includes("whatsapp"));
  assert.deepEqual(await list("/editors?search=nonexistent"), []);
  assert.equal((await list("/editors?specialty=Document")).length, 1);
  assert.deepEqual(await list("/editors?specialty=Animation"), []);
  await call("/editors/visibility", 2, { visible: true, portfolioConsent: true });
  assert.equal((await list())[0].portfolioLink, "https://example.invalid/portfolio");
  await db
    .prepare(
      "UPDATE users SET portfolio_link='https://staging.local/api/missions/39/files/private' WHERE id=2",
    )
    .run();
  assert.equal((await list())[0].portfolioLink, null);
  await db.prepare("UPDATE users SET is_banned=1 WHERE id=2").run();
  assert.deepEqual(await list(), []);
  await db.prepare("UPDATE users SET is_banned=0 WHERE id=2").run();
  await call("/editors/visibility", 2, { visible: false, portfolioConsent: false });
  assert.deepEqual(await list(), []);
  assert.equal((await call("/editors/synthetic2", 4)).status, 404);
  const directId = await mission();
  assert.equal(
    (await call(`/missions/${directId}/selection`, 1, { editorId: 2, kind: "direct" })).status,
    201,
  );
  await db.prepare("UPDATE users SET last_seen_at='2000-01-01T00:00:00.000Z' WHERE id=2").run();
  assert.equal(
    ((await (await call(`/missions/${directId}/selection`, 1)).json()) as { status: string })
      .status,
    "oferecida",
  );
  assert.equal((await call("/editors/synthetic2", 1)).status, 200);
  assert.equal((await call("/editors/synthetic2", 4)).status, 404);
  assert.deepEqual(await list("/editors?available=true"), []);
});
