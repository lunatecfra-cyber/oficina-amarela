import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Accounts } from "./accounts.ts";
import { createD1Admin } from "./admin.ts";
import { applyAllD1Migrations, applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

test("cadastro data novas contas em base migrada sem inventar datas antigas", async () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-user-created-at-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  try {
    const db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    await applyAllD1Migrations(db);
    // Reproduz o users.created_at nullable e sem DEFAULT observado em staging.
    await db.prepare("DROP TRIGGER user_created_at_insert").run();
    await db.prepare("ALTER TABLE users RENAME COLUMN created_at TO legacy_created_at").run();
    await db.prepare("ALTER TABLE users ADD COLUMN created_at TEXT").run();
    await db
      .prepare(
        "INSERT INTO users (handle, name, email, role) VALUES ('old', 'Old', 'old@example.invalid', 'editor')",
      )
      .run();
    const patch = await readFile(
      new URL("../../d1/0008_user_created_at.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db, patch);
    await applyD1Schema(db, patch);
    const accounts = createD1Accounts(db);
    const created = await accounts.createAccount({
      handle: "new",
      name: "New",
      email: "new@example.invalid",
      role: "editor",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const admin = createD1Admin(db);
    const details = await admin.viewUserDetails(created.id);
    assert.ok(details);
    assert.ok(Number.isFinite(Date.parse(details.createdAt)));
    assert.equal((await admin.searchUsers("old"))[0].createdAt, "");
    const old = await db
      .prepare("SELECT id, created_at FROM users WHERE handle = 'old'")
      .first<{ id: number; created_at: null }>();
    assert.equal(old?.created_at, null);
    assert.equal((await admin.viewUserDetails(old!.id))?.createdAt, "");
    await db
      .prepare(
        "INSERT INTO users (handle, name, email, role, created_at) VALUES ('dated', 'Dated', 'dated@example.invalid', 'editor', '2020-01-01T00:00:00.000Z')",
      )
      .run();
    assert.equal((await admin.searchUsers("dated"))[0].createdAt, "2020-01-01T00:00:00.000Z");
  } finally {
    await miniflare.dispose();
  }
});
