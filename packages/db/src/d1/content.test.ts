import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Music } from "./music.ts";
import { createD1News } from "./news.ts";
import { applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 de novidades e músicas", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-content-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let newsRepo: ReturnType<typeof createD1News>;
  let musicRepo: ReturnType<typeof createD1Music>;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db, schema);
    newsRepo = createD1News(db);
    musicRepo = createD1Music(db);
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM musicas").run();
    await db.prepare("DELETE FROM novidades").run();
    await db.prepare("DELETE FROM users").run();
  });

  after(() => miniflare.dispose());

  test("criação, publicação e remoção de novidades", async () => {
    const u = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("admin1", "Admin Um", "admin1@teste.local", "admin")
      .first<{ id: number }>();
    const adminId = Number(u?.id);

    const created = await newsRepo.createNews(adminId, "Novidade 1", "Texto da novidade 1", true);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const published = await newsRepo.getPublishedNews(5);
    assert.equal(published.length, 1);
    assert.equal(published[0].title, "Novidade 1");

    const toggled = await newsRepo.toggleNewsPublication(created.id);
    assert.equal(toggled.ok, true);
    if (toggled.ok) assert.equal(toggled.isPublished, false);

    const publishedAfterToggle = await newsRepo.getPublishedNews(5);
    assert.equal(publishedAfterToggle.length, 0);

    const deleted = await newsRepo.deleteNews(created.id);
    assert.deepEqual(deleted, { ok: true });
  });

  test("músicas e filtragem por tags", async () => {
    const u = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor1", "Editor Um", "ed1@teste.local", "editor")
      .first<{ id: number }>();
    const userId = Number(u?.id);

    await musicRepo.addMusicTrack(
      "Trilha Épica",
      ["epica", "orquestra"],
      "https://r2.local/epica.mp3",
      1024,
      userId,
    );
    await musicRepo.addMusicTrack(
      "Beat Urbano",
      ["lofi", "urbano"],
      "https://r2.local/beat.mp3",
      2048,
      userId,
    );

    const all = await musicRepo.listMusicTracks();
    assert.equal(all.length, 2);

    const filtered = await musicRepo.listMusicTracks("epica");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].name, "Trilha Épica");

    const tags = await musicRepo.getAllMusicTags();
    assert.ok(tags.includes("epica"));
    assert.ok(tags.includes("urbano"));
  });
});
