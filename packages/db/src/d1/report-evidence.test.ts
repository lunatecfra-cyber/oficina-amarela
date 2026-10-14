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
    d1Databases: { DB: "report-evidence" },
    r2Buckets: { MEDIA: "report-evidence" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>,
  media: Awaited<ReturnType<typeof mf.getR2Bucket>>,
  app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
const request = (path: string, actor = 3, method = "GET", body?: unknown) =>
  app.request(
    `https://staging.local${path}`,
    {
      method,
      headers: { cookie: cookies[actor] ?? "", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      MEDIA: media as never,
      BACKGROUND_QUEUE: { async send() {} },
      STAGING_INSPECTION_ALL: "true",
      STAGING_EMAIL_SIMULATED: "true",
    },
  );
before(async () => {
  process.env.AUTH_SECRET = "report-evidence-isolated-secret";
  db = await mf.getD1Database("DB");
  media = await mf.getR2Bucket("MEDIA");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "spokesperson"],
    [2, "editor"],
    [3, "admin"],
    [4, "admin"],
    [5, "editor"],
    [6, "admin"],
  ] as const) {
    await db
      .prepare("INSERT INTO users(id,handle,name,email,role,profile_completed) VALUES(?,?,?,?,?,1)")
      .bind(
        id,
        `evidence${id}`,
        `Synthetic ${id}`,
        `evidence${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
      )
      .run();
    cookies[id] =
      `${COOKIE_NAME}=${await createSessionToken({ id, role, handle: `evidence${id}`, name: `Synthetic ${id}` })}`;
  }
  await db.prepare("INSERT INTO admin_capabilities VALUES(4,'release_report_retention')").run();
});
after(() => mf.dispose());
async function work() {
  const row = await db
    .prepare(
      "INSERT INTO missions(spokesperson_id,reserved_by_id,title,format,status) VALUES(1,2,'Brief original','short','reservada') RETURNING id",
    )
    .first<{ id: number }>();
  return row!.id;
}
async function report(missionId: number) {
  assert.equal(
    (
      await request(`/missions/${missionId}`, 1, "POST", {
        action: "report",
        text: "Problema sintético na entrega",
      })
    ).status,
    200,
  );
  return (await db
    .prepare("SELECT id FROM reports WHERE mission_id=? ORDER BY id DESC")
    .bind(missionId)
    .first<{ id: number }>())!.id;
}
test("captura atômica, permissões, recuperação e concorrência; retenção sobrevive à decisão", async () => {
  const missionId = await work(),
    key = `missions/${missionId}/2/${crypto.randomUUID()}`;
  await media.put(key, new Uint8Array([1, 2, 3]), {
    httpMetadata: { contentType: "video/mp4" },
    customMetadata: { ownerId: "2", missionId: String(missionId), expectedSize: "3" },
  });
  const videoUrl = `https://staging.local/api/missions/${missionId}/files/2/${key.split("/").at(-1)}`;
  assert.equal(
    (
      await request(`/missions/${missionId}`, 2, "POST", {
        action: "message",
        text: "Mensagem original",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/missions/${missionId}`, 2, "POST", {
        action: "deliver",
        expectedDeliveryVersion: 0,
        videoUrl,
      })
    ).status,
    200,
  );
  const reportId = await report(missionId),
    path = `/admin/reports/${reportId}`;
  for (const actor of [0, 1, 2, 5])
    assert.ok([401, 403].includes((await request(`${path}/evidence`, actor)).status));
  const evidence = await request(`${path}/evidence`);
  assert.equal(evidence.status, 200);
  assert.equal(evidence.headers.get("cache-control"), "private, no-store");
  const snapshot = (await evidence.json()) as {
    capture: { origin: string };
    evidence: { kind: string; payload: string }[];
  };
  assert.equal(snapshot.capture.origin, "opening");
  assert.equal(snapshot.evidence.filter((e) => e.kind === "delivery").length, 1);
  await db.prepare("UPDATE missions SET title='Brief alterado' WHERE id=?").bind(missionId).run();
  await db.prepare("UPDATE users SET name='Nome alterado' WHERE id=1").run();
  const unchanged = await request(`${path}/evidence`);
  assert.deepEqual(await unchanged.json(), snapshot);
  for (const sql of [
    "UPDATE mission_deliveries SET delivery_link='alterado' WHERE mission_id=?",
    "DELETE FROM mission_deliveries WHERE mission_id=?",
    "UPDATE messages SET body='alterado' WHERE mission_id=?",
    "DELETE FROM messages WHERE mission_id=?",
    "DELETE FROM missions WHERE id=?",
    "DELETE FROM reports WHERE mission_id=?",
  ])
    await assert.rejects(
      () => db.prepare(sql).bind(missionId).run(),
      /immutable|evidence_retained/,
    );
  await assert.rejects(
    () => db.prepare("DELETE FROM report_evidence WHERE report_id=?").bind(reportId).run(),
    /evidence_retained/,
  );
  const before = await db
    .prepare("SELECT status,reserved_by_id FROM missions WHERE id=?")
    .bind(missionId)
    .first();
  assert.equal((await request(`/missions/${missionId}`, 3, "DELETE")).status, 400);
  assert.equal((await request("/account", 2, "DELETE", { confirmation: "evidence2" })).status, 409);
  assert.equal((await request("/admin/users/2", 3, "DELETE")).status, 400);
  assert.deepEqual(
    await db
      .prepare("SELECT status,reserved_by_id FROM missions WHERE id=?")
      .bind(missionId)
      .first(),
    before,
  );
  assert.equal((await request(`${path}/resolve`, 3, "POST", { status: "ignored" })).status, 400);
  assert.equal(
    (await request(`${path}/resolve`, 3, "POST", { status: "invalid", reason: "Motivo válido" }))
      .status,
    400,
  );
  assert.equal(
    (await request(`${path}/release-retention`, 3, "POST", { reason: "Motivo de liberação" }))
      .status,
    403,
  );
  assert.equal(
    (await request(`${path}/release-retention`, 4, "POST", { reason: "Motivo de liberação" }))
      .status,
    409,
  );
  await db
    .prepare(
      `CREATE TRIGGER reject_test_decision BEFORE INSERT ON admin_audit WHEN NEW.action='denuncia_decidida' BEGIN SELECT RAISE(ABORT,'synthetic_audit_failure'); END`,
    )
    .run();
  assert.equal(
    (
      await request(`${path}/resolve`, 3, "POST", {
        status: "resolved",
        reason: "Correção conferida",
      })
    ).status,
    500,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM report_decisions WHERE report_id=?")
      .bind(reportId)
      .first("count(*)"),
    0,
  );
  assert.equal(
    await db.prepare("SELECT status FROM reports WHERE id=?").bind(reportId).first("status"),
    "aberta",
  );
  await db.prepare("DROP TRIGGER reject_test_decision").run();
  const responses = await Promise.all([
    request(`${path}/resolve`, 3, "POST", { status: "resolved", reason: "Correção conferida" }),
    request(`${path}/resolve`, 6, "POST", { status: "ignored", reason: "Outra interpretação" }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const decision = await db
    .prepare("SELECT actor_id,status,reason FROM report_decisions WHERE report_id=?")
    .bind(reportId)
    .first<{ actor_id: number; status: string; reason: string }>();
  assert.equal(
    (
      await request(`${path}/resolve`, decision!.actor_id, "POST", {
        status: decision!.status,
        reason: decision!.reason,
      })
    ).status,
    200,
  );
  assert.equal(
    await db
      .prepare("SELECT count(*) FROM admin_audit WHERE action='denuncia_decidida' AND entity_id=?")
      .bind(String(reportId))
      .first("count(*)"),
    1,
  );
  await assert.rejects(
    () =>
      db
        .prepare("UPDATE report_decisions SET reason='Reescrever' WHERE report_id=?")
        .bind(reportId)
        .run(),
    /immutable/,
  );
  assert.equal((await request(`/missions/${missionId}`, 3, "DELETE")).status, 400);
  assert.equal(
    (
      await request(`${path}/release-retention`, 4, "POST", {
        reason: "Caso encerrado, retenção revisada",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`${path}/release-retention`, 4, "POST", {
        reason: "Caso encerrado, retenção revisada",
      })
    ).status,
    200,
  );
  assert.equal(
    await db
      .prepare(
        "SELECT count(*) FROM admin_audit WHERE action='retencao_denuncia_liberada' AND entity_id=?",
      )
      .bind(String(reportId))
      .first("count(*)"),
    1,
  );
  assert.equal((await request(`/missions/${missionId}`, 3, "DELETE")).status, 200);
  assert.equal((await media.head(key)) !== null, true);
});
test("impedimento das partes e do fiscal da entrega; revogação vale com cookie antigo", async () => {
  const missionId = await work();
  const earlyReport = await report(missionId);
  assert.equal((await request("/account", 2, "DELETE", { confirmation: "evidence2" })).status, 409);
  assert.deepEqual(
    await db
      .prepare("SELECT status,reserved_by_id FROM missions WHERE id=?")
      .bind(missionId)
      .first(),
    { status: "reservada", reserved_by_id: 2 },
  );
  assert.equal(
    (
      await request(`/missions/${missionId}`, 2, "POST", {
        action: "deliver",
        expectedDeliveryVersion: 0,
        link: "https://example.invalid/entrega",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/missions/${missionId}`, 3, "POST", {
        action: "approve",
        expectedDeliveryVersion: 1,
      })
    ).status,
    200,
  );
  const reportId = await report(missionId),
    path = `/admin/reports/${reportId}`;
  assert.equal(
    (
      await request(`/admin/reports/${earlyReport}/resolve`, 3, "POST", {
        status: "resolved",
        reason: "Inspeção posterior à abertura também impede decisão",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`${path}/resolve`, 3, "POST", {
        status: "resolved",
        reason: "Fiscal não arbitra sua inspeção",
      })
    ).status,
    409,
  );
  await db.prepare("UPDATE users SET role='admin' WHERE id=1").run();
  cookies[1] = `${COOKIE_NAME}=${await createSessionToken({ id: 1, role: "admin", handle: "evidence1", name: "Nome alterado",sessionVersion:1 })}`;
  assert.equal(
    (
      await request(`${path}/resolve`, 1, "POST", {
        status: "resolved",
        reason: "Parte interessada não decide",
      })
    ).status,
    409,
  );
  await db.prepare("UPDATE users SET role='editor' WHERE id=6").run();
  assert.equal((await request(`${path}/evidence`, 6)).status, 401);
  await db.prepare("DELETE FROM admin_capabilities WHERE user_id=4").run();
  assert.equal(
    (
      await request(`${path}/release-retention`, 4, "POST", {
        reason: "Concessão anterior foi revogada",
      })
    ).status,
    403,
  );
});
