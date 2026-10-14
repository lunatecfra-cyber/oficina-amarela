import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionCollaboration } from "./mission-collaboration.ts";
import { applyAllD1Migrations } from "./schema.ts";
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
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    collaboration = createD1MissionCollaboration(db as unknown as D1DatabaseLike);
  });

  beforeEach(async () => {
    await db.batch([
      db.prepare("DELETE FROM reports"),
      db.prepare("DELETE FROM message_reads"),
      db.prepare("DELETE FROM messages"),
      db.prepare("DELETE FROM offers"),
      db.prepare("DELETE FROM missions"),
      db.prepare("DELETE FROM users"),
    ]);
    const spokesperson = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("voz.d1.chat", "Voz D1", "voz.d1.chat@teste.local", "voz")
      .first<{ id: number }>();
    const editor = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor.d1.chat", "Editor D1", "editor.d1.chat@teste.local", "editor")
      .first<{ id: number }>();
    const outsider = await db
      .prepare("INSERT INTO users (handle, name, email, role) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("fora.d1.chat", "Fora D1", "fora.d1.chat@teste.local", "editor")
      .first<{ id: number }>();
    spokespersonId = spokesperson?.id as number;
    editorId = editor?.id as number;
    outsiderId = outsider?.id as number;
    const mission = await db
      .prepare(
        "INSERT INTO missions (spokesperson_id, title, format, status, reserved_by_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
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
      .prepare("SELECT reporter_id, reported_id, body FROM reports WHERE mission_id = ?")
      .bind(missionId)
      .first();
    assert.deepEqual(report, {
      reporter_id: spokespersonId,
      reported_id: editorId,
      body: "Problema",
    });
    assert.deepEqual(
      await collaboration.reportMission(missionId, { id: editorId, role: "editor" }, "  "),
      { ok: false, reason: "empty_report" },
    );
    // O fixture encerra sua vida aqui: a retenção impede a limpeza entre casos.
    await db
      .prepare(
        "INSERT INTO users(handle,name,email,role) VALUES('fixture.retention','Fixture','fixture.retention@teste.local','admin')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO admin_capabilities SELECT id,'release_report_retention' FROM users WHERE handle='fixture.retention'",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO report_decisions(report_id,actor_id,actor_name,status,reason) SELECT r.id,u.id,u.name,'resolvida','Encerramento do fixture isolado' FROM reports r,users u WHERE u.handle='fixture.retention'",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO report_retention_releases(report_id,actor_id,actor_name,reason) SELECT r.id,u.id,u.name,'Limpeza do fixture isolado' FROM reports r,users u WHERE u.handle='fixture.retention'",
      )
      .run();
  });

  test("não declara mensagem enviada quando INSERT RETURNING não devolve linha", async () => {
    const emptyReturningDb = {
      prepare(query: string) {
        return {
          bind() {
            return this;
          },
          async first() {
            if (query.startsWith("SELECT spokesperson_id")) {
              return { spokesperson_id: 10, reserved_by_id: 20 };
            }
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            return { meta: { changes: 0 } };
          },
        };
      },
    } as D1DatabaseLike;

    const result = await createD1MissionCollaboration(emptyReturningDb).sendMessage(
      1,
      { id: 20, name: "Editor", role: "editor" },
      "Mensagem que não voltou do banco",
    );

    assert.deepEqual(result, { ok: false, reason: "write_failed" });
  });
  describe("cursor por id e leitura", () => {
    const editor = () => ({ id: editorId, name: "Editor D1", role: "editor" as const });
    const spokesperson = () => ({
      id: spokespersonId,
      name: "Voz D1",
      role: "spokesperson" as const,
    });
    async function insert(author: number, body: string, createdAt = "2026-10-14T12:00:00.000Z") {
      const row = await db
        .prepare(
          "INSERT INTO messages (mission_id, author_id, body, created_at) VALUES (?, ?, ?, ?) RETURNING id",
        )
        .bind(missionId, author, body, createdAt)
        .first<{ id: number }>();
      return row?.id as number;
    }
    const ids = (r: { ok: boolean; messages?: { seq?: number }[] }) =>
      (r.messages ?? []).map((m) => m.seq);

    test("não perde mensagens com o mesmo created_at", async () => {
      const [a, b, c] = [
        await insert(editorId, "um"),
        await insert(editorId, "dois"),
        await insert(spokespersonId, "três"),
      ];
      // O cursor por horário esconde as irmãs do último lido; o por id não.
      const legacy = await collaboration.messagesForMission(
        missionId,
        spokesperson(),
        "2026-10-14T12:00:00.000Z",
      );
      assert.deepEqual(legacy, { ok: true, messages: [] });
      const page = await collaboration.messagePage(missionId, spokesperson(), { afterId: a });
      assert.deepEqual(ids(page), [b, c]);
    });

    test("pagina para frente e para trás sem repetir nem pular", async () => {
      const all: number[] = [];
      for (let i = 0; i < 5; i++) all.push(await insert(editorId, `m${i}`));
      const latest = await collaboration.messagePage(missionId, editor(), { limit: 2 });
      assert.deepEqual([ids(latest), latest.ok && latest.hasMore], [all.slice(3), true]);
      const older = await collaboration.messagePage(missionId, editor(), {
        beforeId: all[3],
        limit: 2,
      });
      assert.deepEqual([ids(older), older.ok && older.hasMore], [all.slice(1, 3), true]);
      const oldest = await collaboration.messagePage(missionId, editor(), {
        beforeId: all[1],
        limit: 2,
      });
      assert.deepEqual([ids(oldest), oldest.ok && oldest.hasMore], [[all[0]], false]);
      const forward = await collaboration.messagePage(missionId, editor(), {
        afterId: all[0],
        limit: 2,
      });
      assert.deepEqual([ids(forward), forward.ok && forward.hasMore], [all.slice(1, 3), true]);
    });

    test("conta só mensagens alheias e o marcador só avança", async () => {
      const first = await insert(editorId, "do editor 1");
      const second = await insert(editorId, "do editor 2");
      await insert(spokespersonId, "do porta-voz");
      const unread = await collaboration.unreadMissions(spokesperson());
      assert.deepEqual(unread, {
        ok: true,
        missions: [{ missionId, title: "Missão D1", unread: 2, lastMessageId: second + 1 }],
      });
      assert.deepEqual(await collaboration.unreadMissions(editor()), {
        ok: true,
        missions: [{ missionId, title: "Missão D1", unread: 1, lastMessageId: second + 1 }],
      });
      assert.deepEqual(await collaboration.markRead(missionId, spokesperson(), first), {
        ok: true,
        lastReadId: first,
      });
      // Repetir e chegar atrasado com um valor menor deixa o marcador onde estava.
      assert.deepEqual(await collaboration.markRead(missionId, spokesperson(), first), {
        ok: true,
        lastReadId: first,
      });
      assert.deepEqual(await collaboration.markRead(missionId, spokesperson(), 0), {
        ok: true,
        lastReadId: first,
      });
      const afterFirst = await collaboration.unreadMissions(spokesperson());
      assert.equal(afterFirst.ok && afterFirst.missions[0]?.unread, 1);
      // Passar do fim é limitado à última mensagem da missão.
      assert.deepEqual(await collaboration.markRead(missionId, spokesperson(), 9_999_999), {
        ok: true,
        lastReadId: second + 1,
      });
      assert.deepEqual(await collaboration.unreadMissions(spokesperson()), {
        ok: true,
        missions: [],
      });
    });

    test("marcações concorrentes terminam no maior valor", async () => {
      const all: number[] = [];
      for (let i = 0; i < 5; i++) all.push(await insert(editorId, `c${i}`));
      await Promise.all(
        [all[2], all[4], all[0], all[3], all[1]].map((id) =>
          collaboration.markRead(missionId, spokesperson(), id),
        ),
      );
      const row = await db
        .prepare("SELECT last_read_message_id AS id FROM message_reads WHERE user_id = ?")
        .bind(spokespersonId)
        .first<{ id: number }>();
      assert.equal(row?.id, all[4]);
    });

    test("isola outras pessoas e outras missões, e acompanha a transferência", async () => {
      const mine = await insert(editorId, "privada");
      const outsider = { id: outsiderId, name: "Fora D1", role: "editor" as const };
      assert.deepEqual(await collaboration.messagePage(missionId, outsider, {}), {
        ok: false,
        reason: "forbidden",
      });
      assert.deepEqual(await collaboration.markRead(missionId, outsider, mine), {
        ok: false,
        reason: "forbidden",
      });
      assert.deepEqual(await collaboration.markRead(999_999, spokesperson(), 1), {
        ok: false,
        reason: "mission_not_found",
      });
      assert.deepEqual(await collaboration.unreadMissions(outsider), { ok: true, missions: [] });
      // Inspetor lê pelo painel próprio e não guarda marcador de conversa.
      assert.deepEqual(
        await collaboration.markRead(missionId, { id: outsiderId, role: "inspector" }, mine),
        { ok: false, reason: "forbidden" },
      );

      await db
        .prepare("UPDATE missions SET reserved_by_id = ? WHERE id = ?")
        .bind(outsiderId, missionId)
        .run();
      // O editor anterior perde acesso na hora; o novo começa com o próprio marcador.
      assert.deepEqual(await collaboration.messagePage(missionId, editor(), {}), {
        ok: false,
        reason: "forbidden",
      });
      assert.deepEqual(await collaboration.unreadMissions(editor()), { ok: true, missions: [] });
      assert.deepEqual(await collaboration.markRead(missionId, editor(), mine), {
        ok: false,
        reason: "forbidden",
      });
      const incoming = await collaboration.messagePage(missionId, outsider, {});
      assert.deepEqual(ids(incoming), [mine]);
    });
  });
});
