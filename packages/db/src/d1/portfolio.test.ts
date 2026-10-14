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
    d1Databases: { DB: "portfolio" },
    r2Buckets: { MEDIA: "portfolio" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>,
  media: Awaited<ReturnType<typeof mf.getR2Bucket>>,
  app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
const call = (path: string, actor = 2, body?: unknown, headers: Record<string, string> = {}) =>
  app.request(
    `https://staging.local${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie: cookies[actor] || "", "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      MEDIA: media as never,
      BACKGROUND_QUEUE: { async send() {} },
      STAGING_EMAIL_SIMULATED: "true",
      PUBLIC_ORIGIN: "https://staging.local",
    },
  );
before(async () => {
  process.env.AUTH_SECRET = "isolated-portfolio-secret";
  db = await mf.getD1Database("DB");
  media = await mf.getR2Bucket("MEDIA");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "spokesperson"],
    [2, "editor"],
    [3, "admin"],
    [4, "editor"],
    [5, "spokesperson"],
  ] as const) {
    await db
      .prepare(
        "INSERT INTO users(id,handle,name,email,role,profile_completed,directory_visible) VALUES(?,?,?,?,?,1,1)",
      )
      .bind(
        id,
        `portfolio${id}`,
        `Synthetic ${id}`,
        `portfolio${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
      )
      .run();
    cookies[id] =
      `${COOKIE_NAME}=${await createSessionToken({ id, role, handle: `portfolio${id}`, name: `Synthetic ${id}` })}`;
  }
});
after(() => mf.dispose());
async function work(kind = "video", external = false, assetOwner = 2) {
  const mission = await db
    .prepare(
      "INSERT INTO missions(spokesperson_id,reserved_by_id,title,format,status,delivery_version) VALUES(1,2,'Obra sintética','short','finalizada',1) RETURNING id",
    )
    .first<{ id: number }>();
  const missionId = mission!.id,
    fileId = crypto.randomUUID(),
    key = `missions/${missionId}/${assetOwner}/${fileId}`,
    assetUrl = external
      ? "https://drive.google.com/private"
      : `https://staging.local/api/missions/${missionId}/files/${assetOwner}/${fileId}`;
  await media.put(key, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: kind === "image" ? "image/png" : "video/mp4" },
    customMetadata: {
      ownerId: String(assetOwner),
      missionId: String(missionId),
      expectedSize: "3",
    },
  });
  await db
    .prepare(
      "INSERT INTO mission_deliveries(mission_id,version,editor_id,delivery_video_url) VALUES(?,1,2,?)",
    )
    .bind(missionId, assetUrl)
    .run();
  return { missionId, deliveryVersion: 1, key, assetUrl };
}
async function sample() {
  const delivery = await work(),
    res = await call("/portfolio", 2, delivery);
  assert.equal(res.status, 201);
  const { id } = (await res.json()) as { id: string };
  return { ...delivery, id };
}
async function state(id: string) {
  return db.prepare("SELECT * FROM portfolio_samples WHERE id=?").bind(id).first<{
    revision: number;
    editor_visible: number;
    owner_authorized: number;
    authorization_statement: string | null;
  }>();
}
async function action(
  id: string,
  actor: number,
  action: string,
  extra: Record<string, unknown> = {},
) {
  const current = await state(id);
  return call(`/portfolio/${id}`, actor, { action, revision: current!.revision, ...extra });
}
async function published(id: string) {
  return db.prepare("SELECT id FROM published_portfolio_samples WHERE id=?").bind(id).first();
}

test("privado por padrão; consentimento exige declaração explícita por obra", async () => {
  const s = await sample();
  assert.equal((await state(s.id))!.editor_visible, 0);
  assert.equal(await published(s.id), null);
  assert.equal((await call("/portfolio", 0)).status, 401);
  assert.equal((await call(`/portfolio/${s.id}/media`, 5)).status, 404);
  await action(s.id, 2, "request");
  assert.equal((await action(s.id, 1, "authorize", { rightsAuthorized: 1 })).status, 400);
  assert.equal((await state(s.id))!.owner_authorized, 0);
  assert.equal((await state(s.id))!.authorization_statement, null);
  assert.equal(await published(s.id), null);
  const profile = (await (await call("/editors/portfolio2", 5)).json()) as { portfolio: unknown[] };
  assert.deepEqual(profile.portfolio, []);
  const list = (await (await call("/editors?search=portfolio2", 5)).json()) as {
    portfolioCount: number;
  }[];
  assert.equal(list[0].portfolioCount, 0);
});
test("IDOR, papel, arquivos externos e assets de outro editor são rejeitados", async () => {
  const s = await sample();
  assert.equal((await call("/portfolio", 4, s)).status, 404);
  for (const actor of [4, 5]) {
    assert.equal(
      (await call(`/portfolio/${s.id}`, actor, { action: "edit", revision: 0, title: "Hack" }))
        .status,
      404,
    );
    assert.equal((await call(`/portfolio/${s.id}/media`, actor)).status, 404);
    assert.ok(!(await (await call("/portfolio", actor)).text()).includes(s.id));
  }
  assert.equal((await action(s.id, 2, "authorize")).status, 403);
  assert.equal((await action(s.id, 3, "authorize")).status, 403);
  assert.equal((await call("/portfolio", 2, await work("video", true))).status, 409);
  const other = await work("video", false, 4);
  assert.equal((await call("/portfolio", 2, other)).status, 409);
  await db.prepare("UPDATE missions SET status='cancelada' WHERE id=?").bind(other.missionId).run();
  assert.equal((await call("/portfolio", 2, other)).status, 404);
});
test("publicação sintética autorizada, Range, revogação e URL antiga não contornam o backend", async () => {
  const s = await sample();
  await action(s.id, 2, "edit", {
    title: "Amostra autorizada",
    description: "Descrição sintética",
    specialties: "Documentário",
    previewSeconds: 1,
  });
  await action(s.id, 2, "request");
  await action(s.id, 1, "authorize", { rightsConfirmed: true });

  assert.ok(await published(s.id));
  const profile = await call("/editors/portfolio2", 5),
    profileBody = await profile.text();
  assert.equal(profile.headers.get("cache-control"), "private, no-store");
  assert.ok(profileBody.includes("Amostra autorizada"));
  assert.ok(!profileBody.includes(s.key));
  assert.ok(!profileBody.includes(s.assetUrl));
  const url = `/portfolio/${s.id}/media`,
    access = await call(url, 5, undefined, { range: "bytes=1-2" });
  assert.equal(access.status, 206);
  assert.equal(access.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(new Uint8Array(await access.arrayBuffer()), new Uint8Array([2, 3]));
  assert.equal((await call(new URL(s.assetUrl).pathname.replace("/api", ""), 5)).status, 403);
  const deliveryBefore = await db
    .prepare("SELECT * FROM mission_deliveries WHERE mission_id=?")
    .bind(s.missionId)
    .first();
  assert.equal((await action(s.id, 1, "revoke")).status, 200);
  assert.equal(await published(s.id), null);
  assert.equal(
    (await call(url, 5, undefined, { range: "bytes=0-1", "if-none-match": "old" })).status,
    404,
  );
  assert.equal((await call(`${url}?signature=old&expires=2099`, 5)).status, 404);
  assert.ok(!(await (await call("/editors/portfolio2", 5)).text()).includes("Amostra autorizada"));
  assert.equal((await call(new URL(s.assetUrl).pathname.replace("/api", ""), 1)).status, 200);
  assert.deepEqual(
    await db
      .prepare("SELECT * FROM mission_deliveries WHERE mission_id=?")
      .bind(s.missionId)
      .first(),
    deliveryBefore,
  );
  assert.equal((await media.head(s.key))?.size, 3);
  assert.equal(
    (await db
      .prepare(
        "SELECT count(*) AS n FROM admin_audit WHERE entity='portfolio_sample' AND entity_id=?",
      )
      .bind(s.id)
      .first<{ n: number }>())!.n,
    5,
  );
});
test("remoção pelo editor e revogação administrativa retiram consentimentos; editar exige nova autorização", async () => {
  const s = await sample();
  await action(s.id, 2, "request");
  await action(s.id, 1, "authorize", { rightsConfirmed: true });

  await action(s.id, 2, "remove");
  assert.equal(await published(s.id), null);
  assert.equal((await state(s.id))!.owner_authorized, 0);
  await action(s.id, 2, "request");
  assert.equal(await published(s.id), null);
  await action(s.id, 1, "authorize", { rightsConfirmed: true });

  await action(s.id, 2, "edit", {
    title: "Nova apresentação",
    description: "",
    specialties: "",
    previewSeconds: 0,
  });
  assert.equal(await published(s.id), null);
  assert.equal((await state(s.id))!.authorization_statement, null);
  await action(s.id, 2, "request");
  await action(s.id, 1, "authorize", { rightsConfirmed: true });

  await action(s.id, 3, "revoke");
  assert.equal(await published(s.id), null);
});
test("retry e concorrência não duplicam amostras nem sobrescrevem uma revogação", async () => {
  const delivery = await work();
  const responses = await Promise.all([
    call("/portfolio", 2, delivery),
    call("/portfolio", 2, delivery),
  ]);
  assert.ok(responses.every((r) => r.status === 201));
  const ids = await Promise.all(
    responses.map(async (r) => ((await r.json()) as { id: string }).id),
  );
  assert.equal(ids[0], ids[1]);
  const id = ids[0];
  await action(id, 2, "request");
  const revision = (await state(id))!.revision;
  const writes = await Promise.all([
    call(`/portfolio/${id}`, 1, { action: "authorize", rightsConfirmed: true, revision }),
    call(`/portfolio/${id}`, 1, { action: "revoke", revision }),
  ]);
  assert.deepEqual(writes.map((r) => r.status).sort(), [200, 409]);
  await action(id, 1, "revoke");
  assert.equal(
    (await call(`/portfolio/${id}`, 1, { action: "authorize", rightsConfirmed: true, revision }))
      .status,
    409,
  );
  assert.equal((await state(id))!.owner_authorized, 0);
  await assert.rejects(
    db.prepare("UPDATE portfolio_samples SET asset_key='foreign' WHERE id=?").bind(id).run(),
  );
  assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
});
test("retirada de perfil e bloqueio invalidam publicações; asset histórico é imutável e imagem usa a mesma permissão", async () => {
  const delivery = await work("image"),
    res = await call("/portfolio", 2, delivery),
    { id } = (await res.json()) as { id: string };
  await action(id, 2, "request");
  await action(id, 1, "authorize", { rightsConfirmed: true });

  assert.ok(await published(id));
  assert.equal((await call(`/portfolio/${id}/media`, 5)).headers.get("content-type"), "image/png");
  await db.prepare("UPDATE users SET directory_visible=0 WHERE id=2").run();
  assert.equal((await call(`/portfolio/${id}/media`, 5)).status, 404);
  await db.prepare("UPDATE users SET directory_visible=1,is_banned=1 WHERE id=2").run();
  assert.equal((await call(`/portfolio/${id}/media`, 5)).status, 404);
  await db.prepare("UPDATE users SET is_banned=0 WHERE id=2").run();
  const version = await db
    .prepare("SELECT session_version FROM users WHERE id=2")
    .first<{ session_version: number }>();
  cookies[2] = `${COOKIE_NAME}=${await createSessionToken({ id: 2, role: "editor", handle: "portfolio2", name: "Synthetic 2", sessionVersion: version!.session_version })}`;
  await assert.rejects(
    () =>
      db
        .prepare(
          "UPDATE mission_deliveries SET delivery_video_url='https://staging.local/other' WHERE mission_id=?",
        )
        .bind(delivery.missionId)
        .run(),
    /delivery_immutable/,
  );
  assert.equal((await call(`/portfolio/${id}/media`, 5)).status, 200);
});

test("preferências são validadas, publicadas somente no perfil autorizado e auditadas", async () => {
  assert.equal(
    (
      await call("/editors/visibility", 2, {
        visible: true,
        portfolioConsent: false,
        workPreference: ["paid"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/editors/visibility", 2, {
        visible: true,
        portfolioConsent: false,
        workPreference: "invalid",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/editors/visibility", 2, {
        visible: true,
        portfolioConsent: false,
        workPreference: "both",
      })
    ).status,
    200,
  );
  assert.equal(
    (await db
      .prepare("SELECT work_preference FROM users WHERE id=2")
      .first<{ work_preference: string }>())!.work_preference,
    "both",
  );
  const editors = (await (await call("/editors?search=portfolio2", 5)).json()) as {
    workPreference: string;
  }[];
  assert.equal(editors[0].workPreference, "both");
  assert.equal(
    (await call("/editors/visibility", 2, { visible: true, portfolioConsent: false })).status,
    200,
  );
  assert.equal(
    (await db
      .prepare("SELECT work_preference FROM users WHERE id=2")
      .first<{ work_preference: string }>())!.work_preference,
    "both",
  );
  assert.ok(
    await db
      .prepare("SELECT id FROM admin_audit WHERE actor_id=2 AND action='editor_work_preference'")
      .first(),
  );
});
test("selo deriva da habilitação administrativa, pode ser revogado e não fabrica nota", async () => {
  assert.equal(
    (await call("/admin/users/2", 2, { verified: true, reason: "Forjado" })).status,
    403,
  );
  assert.equal((await call("/admin/users/2", 3, { verified: true, reason: "" })).status, 400);
  assert.equal(
    (await call("/admin/users/1", 3, { verified: true, reason: "Não é editor" })).status,
    409,
  );
  assert.equal(
    (
      await call("/admin/users/2", 3, {
        verified: true,
        reason: "Verificação sintética por inspetor",
      })
    ).status,
    200,
  );
  const profile = (await (await call("/editors/portfolio2", 5)).json()) as {
    verified: number;
    rating: null;
    ratingCount: number;
  };
  assert.equal(profile.verified, 1);
  assert.equal(profile.rating, null);
  assert.equal(profile.ratingCount, 0);
  const beginners = (await (await call("/editors?search=portfolio4", 5)).json()) as {
    verified: number;
    available: number;
  }[];
  assert.equal(beginners[0].verified, 0);
  assert.equal(beginners[0].available, 1);
  assert.equal(
    (await call("/admin/users/2", 3, { verified: false, reason: "Revogação sintética" })).status,
    200,
  );
  assert.equal(
    ((await (await call("/editors/portfolio2", 5)).json()) as { verified: number }).verified,
    0,
  );
  assert.equal(
    (await db
      .prepare(
        "SELECT count(*) AS n FROM admin_audit WHERE action='editor_verification' AND entity_id='2'",
      )
      .first<{ n: number }>())!.n,
    2,
  );
});
test("entregas no prazo usam primeira submissão e calendário de Brasília, preservando desconhecidos", async () => {
  const editor = 4;
  for (const [deadline, date] of [
    ["2026-10-10", "2026-10-11T02:59:00.000Z"],
    ["2026-10-10", "2026-10-11T03:01:00.000Z"],
    [null, "2026-10-10T12:00:00.000Z"],
    ["2026-10-10", null],
  ]) {
    const m = await db
      .prepare(
        "INSERT INTO missions(spokesperson_id,reserved_by_id,title,format,status,delivery_version,desired_deadline) VALUES(1,?,'Sintética prazo','short','finalizada',1,?) RETURNING id",
      )
      .bind(editor, deadline)
      .first<{ id: number }>();
    await db
      .prepare(
        "INSERT INTO mission_deliveries(mission_id,version,editor_id,submitted_at) VALUES(?,1,?,?)",
      )
      .bind(m!.id, editor, date)
      .run();
  }
  const list = (await (await call("/editors?search=portfolio4", 5)).json()) as {
    completedCount: number;
    onTimeCount: number;
    onTimeKnownCount: number;
  }[];
  assert.equal(list[0].completedCount, 4);
  assert.equal(list[0].onTimeKnownCount, 2);
  assert.equal(list[0].onTimeCount, 1);
});

test("oferta expirada não esconde editor disponível enquanto aguarda manutenção", async () => {
  const response = await call("/missions", 1, {
    title: "Convite sintético expirado",
    format: "short",
    deadline: "2026-11-01",
    driveLink: "https://drive.google.com/synthetic",
    motivation: "Ensaio",
  });
  assert.equal(response.status, 201);
  const { id } = (await response.json()) as { id: number };
  assert.equal(
    (await call(`/missions/${id}/selection`, 1, { editorId: 4, kind: "direct" })).status,
    201,
  );
  assert.deepEqual(await (await call("/editors?search=portfolio4&available=true", 5)).json(), []);
  await db
    .prepare("UPDATE offers SET expires_at='2000-01-01T00:00:00.000Z' WHERE mission_id=?")
    .bind(id)
    .run();
  const list = (await (await call("/editors?search=portfolio4&available=true", 5)).json()) as {
    available: number;
  }[];
  assert.equal(list.length, 1);
  assert.equal(list[0].available, 1);
});
