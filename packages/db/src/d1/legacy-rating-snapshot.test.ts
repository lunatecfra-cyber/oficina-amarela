import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { splitD1Schema } from "./schema.ts";

test("guarda nota legada uma vez sem copiar notas posteriores como legado", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "legacy-ratings" },
      modules: true,
      script: "export default {fetch(){return new Response('ok')}}",
    }),
  );
  try {
    const db = await mf.getD1Database("DB");
    await db.prepare("CREATE TABLE users(id INTEGER PRIMARY KEY, rating REAL)").run();
    await db.prepare("CREATE TABLE reviews(id INTEGER PRIMARY KEY)").run();
    await db.prepare("INSERT INTO users(id,rating) VALUES (1,4.5),(2,NULL)").run();
    const migration = await readFile(
      new URL("../../d1/0012_legacy_rating_snapshot.sql", import.meta.url),
      "utf8",
    );
    const apply = async () => {
      for (const statement of splitD1Schema(migration).tables) await db.prepare(statement).run();
    };
    await apply();
    await db.prepare("UPDATE users SET rating=3 WHERE id=1").run();
    await apply();
    await db.prepare("ALTER TABLE reviews ADD COLUMN source TEXT").run();
    await db.prepare("UPDATE users SET rating=5 WHERE id=2").run();
    await apply();
    const { results } = await db
      .prepare("SELECT user_id,rating,provenance FROM legacy_user_rating_snapshot")
      .all();
    assert.deepEqual(results, [
      { user_id: 1, rating: 4.5, provenance: "legacy_aggregate_unknown_source" },
    ]);
  } finally {
    await mf.dispose();
  }
});
