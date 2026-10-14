import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import type { Role } from "@oficina/domain/roles";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "inspector-journey" },
    r2Buckets: { MEDIA: "inspection-media" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>;
let app: ReturnType<typeof createApp>;
let media: Awaited<ReturnType<typeof mf.getR2Bucket>>;
const cookies: Record<string, string> = {};
const call = (path: string, actor: string, body?: unknown) =>
  app.request(
    `https://inspection.local${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie: cookies[actor] ?? "", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      MEDIA: media,
      PUBLIC_ORIGIN: "https://inspection.local",
      STAGING_INSPECTION_ALL: "true",
      STAGING_EMAIL_SIMULATED: "true",
      BACKGROUND_QUEUE: { async send() {} },
    },
  );
before(async () => {
  process.env.AUTH_SECRET = "isolated-inspector-journey-secret";
  db = await mf.getD1Database("DB");
  media = await mf.getR2Bucket("MEDIA");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "admin"],
    [2, "editor"],
    [3, "spokesperson"],
    [4, "inspector"],
    [5, "inspector"],
  ] as [number, Role][]) {
    await db
      .prepare("INSERT INTO users(id,handle,name,email,role,profile_completed) VALUES(?,?,?,?,?,1)")
      .bind(
        id,
        `actor${id}`,
        `Actor ${id}`,
        `actor${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
      )
      .run();
    cookies[String(id)] =
      `${COOKIE_NAME}=${await createSessionToken({ id, role, handle: `actor${id}`, name: `Actor ${id}` })}`;
  }
});
after(() => mf.dispose());

test("beginner delivery, independent versioned inspection, corrections, final approval and real rating", async () => {
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(1,3,2,'Inspection journey','short','reservada')",
    )
    .run();
  const file = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const url = `https://inspection.local/api/missions/1/files/2/${file}`;
  await media.put(`missions/1/2/${file}`, "test-video", { customMetadata: { expectedSize: "10" } });
  assert.equal(
    (await call("/missions/1", "2", { action: "deliver", link: url, expectedDeliveryVersion: 0 }))
      .status,
    200,
  );
  assert.deepEqual(
    await db
      .prepare("SELECT inspection_required,inspection_reason FROM missions WHERE id=1")
      .first(),
    { inspection_required: 1, inspection_reason: "first_three_deliveries" },
  );
  assert.equal(
    (await call("/missions/1", "3", { action: "approve", expectedDeliveryVersion: 1 })).status,
    409,
  );
  for (const actor of ["2", "3", ""])
    assert.equal((await call("/inspections", actor)).status, actor ? 403 : 401);
  const queue = (await (await call("/inspections", "4")).json()) as {
    id: number;
    version: number;
    reason: string;
  }[];
  assert.equal(queue[0].id, 1);
  assert.equal(queue[0].version, 1);
  assert.equal((await call("/inspections/1", "4")).status, 403);
  assert.equal((await call(`/missions/1/files/2/${file}`, "4")).status, 403);
  const claims = await Promise.all(
    ["4", "5"].map((actor) => call("/inspections/1/claim", actor, { version: 1 })),
  );
  assert.equal(claims.filter((response) => response.status === 200).length, 1);
  const inspector = claims[0].status === 200 ? "4" : "5",
    other = inspector === "4" ? "5" : "4";
  const review = (await (await call("/inspections/1", inspector)).json()) as {
    mission: Record<string, unknown>;
  };
  assert.ok(!("rawFiles" in review.mission));
  assert.ok(!("spokespersonHandle" in review.mission));
  assert.equal((await call(`/missions/1/files/2/${file}`, inspector)).status, 200);
  assert.equal((await call(`/missions/1/files/2/${file}`, other)).status, 403);
  await media.put("missions/1/2/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "private", {
    customMetadata: { expectedSize: "7" },
  });
  assert.equal(
    (await call("/missions/1/files/2/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", inspector)).status,
    403,
  );
  assert.equal(
    (
      await call("/missions/1", other, {
        action: "approve",
        feedback: "Unauthorized",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/missions/1", inspector, {
        action: "approve",
        rating: 5,
        feedback: "Stars forbidden",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/missions/1", inspector, { action: "approve", expectedDeliveryVersion: 1 }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("/missions/1", inspector, {
        action: "re_edit",
        notes: "Corrigir o áudio",
        expectedDeliveryVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/missions/1", "3", { action: "approve", expectedDeliveryVersion: 1 })).status,
    409,
  );
  assert.equal(
    (await call("/missions/1", "2", { action: "deliver", link: url, expectedDeliveryVersion: 1 }))
      .status,
    200,
  );
  assert.equal(
    (
      await call("/missions/1", inspector, {
        action: "approve",
        feedback: "Stale",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  assert.equal((await call("/inspections/1/claim", inspector, { version: 2 })).status, 200);
  assert.equal(
    (
      await call("/missions/1", inspector, {
        action: "approve",
        feedback: "Áudio corrigido",
        expectedDeliveryVersion: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/missions/1", inspector, {
        action: "approve",
        feedback: "Áudio corrigido",
        expectedDeliveryVersion: 2,
      })
    ).status,
    200,
  );
  assert.equal(await db.prepare("SELECT rating FROM users WHERE id=2").first("rating"), null);
  assert.equal(
    (await call("/missions/1", "3", { action: "approve", expectedDeliveryVersion: 2 })).status,
    200,
  );
  assert.equal((await call("/missions/1/review", inspector, { rating: 5 })).status, 403);
  assert.equal(
    (
      await call("/missions/1/review", "3", {
        rating: 4,
        comment: "Boa entrega",
        expectedDeliveryVersion: 2,
      })
    ).status,
    200,
  );
  assert.equal(await db.prepare("SELECT rating FROM users WHERE id=2").first("rating"), 4);
  const completedQueue = (await (await call("/inspections", inspector)).json()) as {
    id: number;
    status: string;
  }[];
  assert.ok(completedQueue.some((item) => item.id === 1 && item.status === "finalizada"));
  assert.equal((await call("/inspections/1", inspector)).status, 200);
  const history = await db
    .prepare(
      "SELECT version,decision,comment,inspector_id FROM mission_inspections WHERE mission_id=1 ORDER BY version",
    )
    .all();
  assert.deepEqual(history.results, [
    {
      version: 1,
      decision: "revision_requested",
      comment: "Corrigir o áudio",
      inspector_id: Number(inspector),
    },
    {
      version: 2,
      decision: "approved",
      comment: "Áudio corrigido",
      inspector_id: Number(inspector),
    },
  ]);
  for (const path of ["/admin/users", "/admin/invitations", "/admin/ranking", "/admin/queue"])
    assert.equal((await call(path, inspector)).status, 403);
  assert.equal(
    (await call("/admin/users/2", inspector, { verified: true, reason: "Unauthorized" })).status,
    403,
  );
  assert.equal((await call("/profile", inspector, { role: "admin" })).status, 200);
  assert.equal(
    await db.prepare("SELECT role FROM users WHERE id=?").bind(Number(inspector)).first("role"),
    "inspector",
  );
  await assert.rejects(
    db
      .prepare(
        "INSERT INTO mission_inspections(mission_id,version,inspector_id,inspected_at) VALUES(1,1,2,'2026-10-14')",
      )
      .run(),
  );
  assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
});

test("administratively invited first delivery and volunteer preference use existing qualification and consent", async () => {
  const email = "experienced@example.invalid";
  const issued = (await (
    await call("/admin/invitations", "1", {
      email,
      kind: "experienced_editor",
      specialties: ["Documentário"],
    })
  ).json()) as { token: string };
  const signup = await call("/auth/signup", "", {
    name: "Experiente",
    email,
    handle: "experienced",
    role: "editor",
    password: "synthetic-password",
    invitation: issued.token,
  });
  assert.equal(signup.status, 200);
  cookies.experienced = (signup.headers.get("set-cookie") ?? "").split(";")[0];
  const account = await db
    .prepare("SELECT id FROM users WHERE email=?")
    .bind(email)
    .first<{ id: number }>();
  assert.equal(
    (
      await call("/editor/profile", "experienced", {
        name: "Experiente",
        editingStyles: ["documentary"],
        availability: [[true]],
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/editors/visibility", "experienced", {
        visible: false,
        portfolioConsent: false,
        workPreference: "volunteer",
      })
    ).status,
    200,
  );
  const preference = (await (await call("/editors/visibility", "experienced")).json()) as {
    workPreference: string;
    visible: boolean;
  };
  assert.equal(preference.workPreference, "volunteer");
  assert.equal(Boolean(preference.visible), false);
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(2,3,?,'Invited journey','short','reservada')",
    )
    .bind(account!.id)
    .run();
  assert.equal(
    (
      await call("/missions/2", "experienced", {
        action: "deliver",
        link: "https://example.invalid/experienced-video",
        expectedDeliveryVersion: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT inspection_reason FROM missions WHERE id=2")
      .first("inspection_reason"),
    "invited_first_delivery",
  );
  assert.equal((await call("/inspections/2/claim", "4", { version: 1 })).status, 200);
  assert.equal(
    (
      await call("/missions/2", "4", {
        action: "approve",
        feedback: "Primeira entrega conferida",
        expectedDeliveryVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/missions/2", "3", { action: "approve", expectedDeliveryVersion: 1 })).status,
    200,
  );
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(3,3,?,'Invited established journey','short','reservada')",
    )
    .bind(account!.id)
    .run();
  assert.equal(
    (
      await call("/missions/3", "experienced", {
        action: "deliver",
        link: "https://example.invalid/experienced-video2",
        expectedDeliveryVersion: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT inspection_reason FROM missions WHERE id=3")
      .first("inspection_reason"),
    "staging_mandatory",
  );
  await db.prepare("UPDATE users SET role='inspector' WHERE id=?").bind(account!.id).run();
  assert.equal((await call("/editor/profile", "experienced")).status, 401);
  cookies.self = `${COOKIE_NAME}=${await createSessionToken({ id: account!.id, handle: "experienced", name: "Experiente", role: "inspector" })}`;
  assert.equal((await call("/inspections/3/claim", "self", { version: 1 })).status, 409);
  assert.equal(
    (
      await call("/missions/3", "self", {
        action: "approve",
        feedback: "Self",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  await assert.rejects(
    db
      .prepare(
        "INSERT INTO mission_inspections(mission_id,version,inspector_id,inspected_at) VALUES(3,1,?,'2026-10-14')",
      )
      .bind(account!.id)
      .run(),
    /inspection_unavailable/,
  );
});
