import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { expandInspectorRole } from "./roles-migration.ts";
import { applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "roles" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>;
before(async () => {
  process.env.AUTH_SECRET = "isolated-inspector-role-secret";
  db = await mf.getD1Database("DB");
  const directory = new URL("../../d1/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((file) => file.endsWith(".sql") && file < "0019")
    .sort())
    await applyD1Schema(
      db as unknown as D1DatabaseLike,
      await readFile(new URL(file, directory), "utf8"),
    );
  await db
    .prepare(
      "INSERT INTO users(id,handle,name,email,role) VALUES(1,'admin','Admin','admin@example.invalid','admin'),(2,'editor','Editor','editor@example.invalid','editor'),(3,'voice','Voz','voice@example.invalid','voz')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status,delivery_version) VALUES(1,3,2,'Preserved','short','finalizada',1)",
    )
    .run();
  await db
    .prepare("INSERT INTO mission_deliveries(mission_id,version,editor_id) VALUES(1,1,2)")
    .run();
  await db.prepare("CREATE VIEW custom_role_projection AS SELECT id,role FROM users").run();
  await db.prepare("CREATE TABLE consumer_events(count INTEGER)").run();
  await db
    .prepare(
      "CREATE TRIGGER indirect_projection AFTER UPDATE OF name ON users BEGIN INSERT INTO consumer_events SELECT count(*) FROM custom_role_projection; END",
    )
    .run();
});
after(() => mf.dispose());
test("native inspector migration preserves users, deliveries, dependent views and triggers atomically", async () => {
  const triggers = (
    await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all()
  ).results;
  await expandInspectorRole(db as unknown as D1DatabaseLike);
  await expandInspectorRole(db as unknown as D1DatabaseLike);
  assert.equal(await db.prepare("SELECT count(*) FROM users").first("count(*)"), 3);
  assert.equal(await db.prepare("SELECT count(*) FROM mission_deliveries").first("count(*)"), 1);
  assert.equal(
    await db.prepare("SELECT count(*) FROM custom_role_projection").first("count(*)"),
    3,
  );
  assert.deepEqual(
    (await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all())
      .results,
    triggers,
  );
  assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
  await db.prepare("UPDATE users SET name='Preserved administrator' WHERE id=1").run();
  assert.equal(await db.prepare("SELECT count FROM consumer_events").first("count"), 3);
  await db
    .prepare(
      "INSERT INTO users(id,handle,name,email,role) VALUES(4,'inspector','Inspector','inspector@example.invalid','inspector')",
    )
    .run();
  await assert.rejects(db.prepare("UPDATE users SET role='superadmin' WHERE id=4").run());
});
test("inspector is a dedicated authenticated role and cannot reuse an old admin token", async () => {
  const app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  const request = async (role: "inspector" | "admin", id = 4) =>
    app.request(
      "https://staging.local/admin/users",
      {
        headers: {
          cookie: `${COOKIE_NAME}=${await createSessionToken({ id, role, handle: "inspector", name: "Inspector" })}`,
        },
      },
      { DB: db, BACKGROUND_QUEUE: { async send() {} } },
    );
  assert.equal((await request("inspector")).status, 403);
  assert.equal((await request("admin")).status, 401);
  assert.equal((await request("admin", 1)).status, 200);
});
