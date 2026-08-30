import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionCollaboration } from "./mission-collaboration.ts";
import { applyD1Schema } from "./schema-test-helper.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 da colaboração de missão", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-collaboration-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let collaboration: ReturnType<typeof createD1MissionCollaboration>;
  let missionId: number;
  let spokespersonId: number;
  let editorId: number;
  let outsiderId: number;

  before(async () => {
    db = await miniflare.getD1Database("DB");
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db as unknown as D1DatabaseLike, schema);
    collaboration = createD1MissionCollaboration(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM denuncias"),
      db.prepare("DELETE FROM mensagens"),
      db.prepare("DELETE FROM ofertas"),
      db.prepare("DELETE FROM pautas"),
      db.prepare("DELETE FROM users"),
    ]);
    const spokesperson = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("voz.d1.chat", "Voz D1", "voz.d1.chat@teste.local", "voz")
      .first<{ id: number }>();
    const editor = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor.d1.chat", "Editor D1", "editor.d1.chat@teste.local", "editor")
      .first<{ id: number }>();
    const outsider = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("fora.d1.chat", "Fora D1", "fora.d1.chat@teste.local", "editor")
      .first<{ id: number }>();
    spokespersonId = spokesperson?.id as number;
    editorId = editor?.id as number;
    outsiderId = outsider?.id as number;
    const mission = await db
      .prepare(
        "INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
      )
      .bind(spokespersonId, "Missão D1", "short", "reservada", editorId)
      .first<{ id: number }>();
    missionId = mission?.id as number;
  });

  after(() => miniflare.dispose());

  test("mantém os mesmos motivos tipados e a autorização por participação", async () => {
    assert.deepEqual(
      await collaboration.messagesForMission(999_999, { id: editorId, role: "editor" }),
      { ok: false, reason: "mission_not_found" },
    );
    assert.deepEqual(
      await collaboration.sendMessage(
        missionId,
        { id: outsiderId, name: "Fora D1", role: "editor" },
        "intrusão",
      ),
      { ok: false, reason: "forbidden" },
    );
  });

  test("persiste e pagina mensagens sem repetir o cursor", async () => {
    const sent = await collaboration.sendMessage(
      missionId,
      { id: editorId, name: "Editor D1", role: "editor" },
      "  Olá D1  ",
    );
    assert.equal(sent.ok, true);
    if (!sent.ok) return;
    assert.equal(sent.message.text, "Olá D1");
    assert.deepEqual(
      await collaboration.messagesForMission(
        missionId,
        { id: spokespersonId, role: "spokesperson" },
        sent.message.createdAt,
      ),
      { ok: true, messages: [] },
    );
  });

  test("denúncia aponta para a contraparte e rejeita conteúdo vazio", async () => {
    assert.deepEqual(
      await collaboration.reportMission(
        missionId,
        { id: spokespersonId, role: "spokesperson" },
        "  Problema  ",
      ),
      { ok: true },
    );
    const report = await db
      .prepare("SELECT denunciante_id, denunciado_id, texto FROM denuncias WHERE pauta_id = ?")
      .bind(missionId)
      .first();
    assert.deepEqual(report, {
      denunciante_id: spokespersonId,
      denunciado_id: editorId,
      texto: "Problema",
    });
    assert.deepEqual(
      await collaboration.reportMission(missionId, { id: editorId, role: "editor" }, "  "),
      { ok: false, reason: "empty_report" },
    );
  });
});
