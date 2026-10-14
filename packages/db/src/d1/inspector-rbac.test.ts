import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { COOKIE_NAME, createSessionToken, verifySessionToken } from "@oficina/auth/session";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { applyAllD1Migrations, applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "inspector-rbac", MIGRATION: "inspector-migration" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>;
let app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
async function cookie(id: number) {
  const row = await db
    .prepare("SELECT role,session_version FROM users WHERE id=?")
    .bind(id)
    .first<{ role: "editor" | "inspector" | "admin"; session_version: number }>();
  cookies[id] =
    `${COOKIE_NAME}=${await createSessionToken({ id, handle: `rbac${id}`, name: `RBAC ${id}`, role: id === 1 ? "spokesperson" : row!.role, sessionVersion: row!.session_version })}`;
}
const request = (path: string, id = 4, method = "GET", body?: unknown) =>
  app.request(
    `https://staging.local${path}`,
    {
      method,
      headers: { cookie: cookies[id] ?? "", "content-type": "application/json", "x-role": "admin" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    {
      DB: db,
      BACKGROUND_QUEUE: { async send() {} },
      STAGING_INSPECTION_ALL: "true",
      STAGING_EMAIL_SIMULATED: "true",
    },
  );
before(async () => {
  process.env.AUTH_SECRET = "rbac-isolated-synthetic-secret";
  db = await mf.getD1Database("DB");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "voz"],
    [2, "editor"],
    [3, "admin"],
    [4, "inspector"],
    [5, "editor"],
    [6, "editor"],
  ] as const) {
    await db
      .prepare(
        "INSERT INTO users(id,handle,name,email,role,profile_completed,sessions_valid_after) VALUES(?,?,?,?,?,1,'1970-01-01T00:00:00.000Z')",
      )
      .bind(id, `rbac${id}`, `RBAC ${id}`, `rbac${id}@example.invalid`, role)
      .run();
    await cookie(id);
  }
});
after(() => mf.dispose());
async function mission(editor = 2) {
  return (await db
    .prepare(
      "INSERT INTO missions(title,format,spokesperson_id,reserved_by_id,status) VALUES('RBAC','short',1,?,'reservada') RETURNING id",
    )
    .bind(editor)
    .first<{ id: number }>())!.id;
}
async function deliver(id: number, editor = 2) {
  return request(`/missions/${id}`, editor, "POST", {
    action: "deliver",
    link: "https://example.invalid/synthetic",
    expectedDeliveryVersion: 0,
  });
}

test("inspetor autentica, inspeciona e encaminha com capacidades limitadas; admin mantém acesso", async () => {
  const session = await request("/auth/session");
  assert.equal(session.status, 200);
  const data = (await session.json()) as { role: string; capabilities: string[] };
  assert.equal(data.role, "inspector");
  assert.deepEqual(data.capabilities.sort(), [
    "disputes.read",
    "mission.chat",
    "mission.inspect",
    "mission.read",
    "reports.forward",
    "reports.read",
  ]);
  const id = await mission();
  assert.equal((await deliver(id)).status, 200);
  assert.equal((await request("/missions/in-review")).status, 403);
  assert.equal((await request("/inspections")).status, 200);
  assert.equal((await request(`/inspections/${id}/claim`, 4, "POST", { version: 1 })).status, 200);
  assert.equal(
    (await request(`/missions/${id}`, 4, "POST", { action: "message", text: "Inspeção sintética" }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(`/missions/${id}`, 4, "POST", {
        action: "approve",
        feedback: "Conferência técnica independente",
        expectedDeliveryVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/missions/${id}`, 1, "POST", { action: "accept", expectedDeliveryVersion: 1 }))
      .status,
    200,
  );
  assert.equal(
    (
      await request(`/missions/${id}`, 1, "POST", {
        action: "report",
        text: "Encaminhamento sintético",
      })
    ).status,
    200,
  );
  const report = (await db
    .prepare("SELECT id FROM reports WHERE mission_id=?")
    .bind(id)
    .first<{ id: number }>())!.id;
  assert.equal((await request(`/admin/reports/${report}/evidence`)).status, 200);
  const forward = { reason: "Histórico conferido; administrador deve decidir" };
  assert.equal((await request(`/admin/reports/${report}/forward`, 4, "POST", forward)).status, 200);
  assert.equal((await request(`/admin/reports/${report}/forward`, 4, "POST", forward)).status, 200);
  assert.equal(
    await db
      .prepare("SELECT count(*) AS n FROM admin_audit WHERE action='denuncia_encaminhada'")
      .first("n"),
    1,
  );
  assert.equal(
    await db.prepare("SELECT status FROM reports WHERE id=?").bind(report).first("status"),
    "aberta",
  );
  for (const [path, method, body] of [
    ["/admin/users", "GET", undefined],
    ["/admin/users/2", "GET", undefined],
    ["/admin/users/2/ban", "POST", { reason: "teste" }],
    ["/admin/users/2", "DELETE", undefined],
    ["/admin/users/4/role", "POST", { role: "admin", reason: "Escalada proibida" }],
    ["/admin/invitations", "GET", undefined],
    ["/admin/invitations", "POST", { email: "blocked@example.invalid" }],
    ["/admin/ranking", "GET", undefined],
    ["/admin/ranking", "POST", {}],
    ["/admin/overview", "GET", undefined],
    ["/admin/broadcast", "POST", { type: "editors" }],
    ["/admin/news", "POST", {}],
    ["/tools/music", "POST", {}],
    ["/admin/queue", "POST", { missionId: id, movement: "up" }],
    [`/missions/${id}`, "DELETE", undefined],
    [
      `/admin/reports/${report}/resolve`,
      "POST",
      { status: "resolved", reason: "Não pode decidir" },
    ],
    [`/admin/reports/${report}/release-retention`, "POST", { reason: "Não pode liberar" }],
    ["/missions", "POST", { title: "Indevida", format: "short" }],
  ] as const)
    assert.equal((await request(path, 4, method, body)).status, 403, `${method} ${path}`);
  assert.equal(
    (
      await request(`/admin/reports/${report}/resolve`, 3, "POST", {
        status: "resolved",
        reason: "Evidências conferidas por administrador independente",
      })
    ).status,
    200,
  );
  assert.equal((await request("/admin/users", 3)).status, 200);
  assert.equal((await request("/admin/ranking", 3)).status, 200);
});

test("rotas de denúncia recusam anônimo, porta-voz e editor sem depender do layout da página", async () => {
  const reason = { reason: "Tentativa sem capacidade", status: "resolved" };
  for (const [path, method, body] of [
    ["/admin/reports", "GET", undefined],
    ["/admin/reports/1/evidence", "GET", undefined],
    ["/admin/reports/1/forward", "POST", reason],
    ["/admin/reports/1/resolve", "POST", reason],
    ["/admin/reports/1/release-retention", "POST", reason],
  ] as const) {
    assert.equal((await request(path, 0, method, body)).status, 401, `anônimo ${method} ${path}`);
    for (const id of [1, 2])
      assert.equal((await request(path, id, method, body)).status, 403, `${id} ${method} ${path}`);
  }
});

test("revogação da capacidade, do papel e da sessão vale imediatamente com cookie antigo", async () => {
  await db.prepare("INSERT INTO user_capability_revocations VALUES(4,'mission.inspect')").run();
  const id = await mission();
  assert.equal((await deliver(id)).status, 200);
  assert.equal(
    (
      await request(`/missions/${id}`, 4, "POST", {
        action: "approve",
        feedback: "Conferência técnica independente",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  assert.equal((await request(`/missions/${id}`, 4)).status, 403);
  assert.equal((await request(`/inspections/${id}/claim`, 4, "POST", { version: 1 })).status, 403);
  await db.prepare("DELETE FROM user_capability_revocations WHERE user_id=4").run();
  assert.equal((await request(`/inspections/${id}/claim`, 4, "POST", { version: 1 })).status, 200);
  assert.equal(
    (
      await request(`/missions/${id}`, 4, "POST", {
        action: "approve",
        feedback: "Conferência técnica independente",
        expectedDeliveryVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/admin/users/4/role", 3, "POST", {
        role: "editor",
        reason: "Revogação sintética da fiscalização",
      })
    ).status,
    200,
  );
  assert.equal((await request("/admin/reports", 4)).status, 401);
  await db.prepare("UPDATE users SET role='inspector' WHERE id=4").run();
  assert.equal((await request("/admin/reports", 4)).status, 401);
  await cookie(4);
  assert.equal((await request("/admin/reports", 4)).status, 200);
  await db
    .prepare(
      "UPDATE users SET sessions_valid_after=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=4",
    )
    .run();
  assert.equal((await request("/admin/reports", 4)).status, 401);
  await cookie(4);
  await db.prepare("UPDATE users SET is_banned=1 WHERE id=4").run();
  assert.equal((await request("/admin/reports", 4)).status, 401);
  await db.prepare("UPDATE users SET is_banned=0 WHERE id=4").run();
  await cookie(4);
  const token = cookies[4].split("=")[1];
  assert.equal((await verifySessionToken(token))!.role, "inspector");
});

test("transferência remove o acesso do editor anterior e histórico impede autoinspeção", async () => {
  const id = await mission(6);
  await db
    .prepare("UPDATE missions SET status='disponivel',reserved_by_id=NULL WHERE id=?")
    .bind(id)
    .run();
  await db
    .prepare("UPDATE missions SET status='reservada',reserved_by_id=2 WHERE id=?")
    .bind(id)
    .run();
  assert.equal((await request(`/missions/${id}`, 6)).status, 403);
  assert.equal((await deliver(id)).status, 200);
  await db.prepare("UPDATE users SET role='inspector' WHERE id=6").run();
  await cookie(6);
  assert.equal(
    (
      await request(`/missions/${id}`, 6, "POST", {
        action: "approve",
        feedback: "Conferência técnica independente",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  await db.prepare("UPDATE users SET role='inspector' WHERE id=1").run();
  cookies[1] = `${COOKIE_NAME}=${await createSessionToken({ id: 1, handle: "rbac1", name: "RBAC 1", role: "inspector", sessionVersion: 1 })}`;
  assert.equal(
    (
      await request(`/missions/${id}`, 1, "POST", {
        action: "approve",
        feedback: "Conferência técnica independente",
        expectedDeliveryVersion: 1,
      })
    ).status,
    403,
  );
  assert.equal((await request(`/inspections/${id}/claim`, 6, "POST", { version: 1 })).status, 409);
  assert.equal((await request(`/inspections/${id}/claim`, 4, "POST", { version: 1 })).status, 200);
  assert.equal(
    (
      await request(`/missions/${id}`, 4, "POST", {
        action: "approve",
        feedback: "Conferência técnica independente",
        expectedDeliveryVersion: 1,
      })
    ).status,
    200,
  );
  const broken = {
    prepare() {
      throw Error("synthetic_db_failure");
    },
  };
  assert.equal(
    (
      await app.request(
        "https://staging.local/admin/reports",
        { headers: { cookie: cookies[4] } },
        { DB: broken },
      )
    ).status,
    401,
  );
});

test("migração com dados preserva ids, papéis, vínculos e auditoria; não eleva contas existentes", async () => {
  const migration = await mf.getD1Database("MIGRATION"),
    dir = new URL("../../d1/", import.meta.url);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql") && f < "0019").sort())
    await applyD1Schema(
      migration as unknown as D1DatabaseLike,
      await readFile(new URL(file, dir), "utf8"),
    );
  await migration
    .prepare(
      "INSERT INTO users(id,handle,name,email,role) VALUES(1,'migration.voice','Voice','voice@example.invalid','voz'),(2,'migration.editor','Editor','editor@example.invalid','editor'),(3,'migration.admin','Admin','admin@example.invalid','admin')",
    )
    .run();
  await migration
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,title,format,status,reserved_by_id) VALUES(10,1,'Preservada','short','reservada',2)",
    )
    .run();
  await migration
    .prepare("INSERT INTO messages(mission_id,author_id,body) VALUES(10,2,'Preservada')")
    .run();
  await migration
    .prepare(
      "INSERT INTO reports(mission_id,reporter_id,reported_id,body) VALUES(10,1,2,'Preservada')",
    )
    .run();
  const before = (
    await migration
      .prepare(
        "SELECT report_id,kind,source_id,payload FROM report_evidence ORDER BY kind,source_id",
      )
      .all()
  ).results;
  await applyD1Schema(
    migration as unknown as D1DatabaseLike,
    await readFile(new URL("0019_inspector_rbac.sql", dir), "utf8"),
  );
  assert.deepEqual(
    (await migration.prepare("SELECT id,role,session_version FROM users ORDER BY id").all())
      .results,
    [
      { id: 1, role: "voz", session_version: 0 },
      { id: 2, role: "editor", session_version: 0 },
      { id: 3, role: "admin", session_version: 0 },
    ],
  );
  assert.deepEqual(
    (
      await migration
        .prepare(
          "SELECT report_id,kind,source_id,payload FROM report_evidence ORDER BY kind,source_id",
        )
        .all()
    ).results,
    before,
  );
  assert.deepEqual((await migration.prepare("PRAGMA foreign_key_check").all()).results, []);
  assert.equal(
    (await migration
      .prepare(
        "SELECT count(*) AS n FROM mission_assignments WHERE mission_id=10 AND ended_at IS NULL",
      )
      .first<{ n: number }>())!.n,
    1,
  );
  await migration
    .prepare(
      "INSERT INTO users(handle,name,email,role) VALUES('migration.inspector','Inspector','inspector@example.invalid','inspector')",
    )
    .run();
  await assert.rejects(
    () => migration.prepare("UPDATE users SET role='unknown' WHERE id=2").run(),
    /CHECK/,
  );
});
