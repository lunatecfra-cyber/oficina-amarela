import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1MissionOwner } from "./mission-owner.ts";
import { createD1MissionLifecycle } from "./mission-lifecycle.ts";
import { createD1MissionQueue } from "./mission-queue.ts";
import { createD1MissionCollaboration } from "./mission-collaboration.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("owner cancellation and reassignment", () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "owner-tests" },
      modules: true,
      script: "export default { fetch(){return new Response('ok')} }",
    }),
  );
  let db: D1DatabaseLike;
  let now = new Date("2026-09-07T12:00:00.000Z");
  let n = 0;
  before(async () => {
    db = (await mf.getD1Database("DB")) as unknown as D1DatabaseLike;
    await applyAllD1Migrations(db);
  });
  after(() => mf.dispose());
  async function setup(hours = 48) {
    n++;
    const ids: number[] = [];
    for (const role of ["voz", "editor", "editor"]) {
      const u = await db
        .prepare("INSERT INTO users(handle,name,email,role) VALUES(?,?,?,?) RETURNING id")
        .bind(
          `${n}-${role}-${ids.length}`,
          `Pessoa ${ids.length}`,
          `${n}-${ids.length}@example.test`,
          role,
        )
        .first<{ id: number }>();
      ids.push(u!.id);
    }
    const [owner, editor, other] = ids;
    const m = await db
      .prepare(
        "INSERT INTO missions(spokesperson_id,title,format,status,reserved_by_id,reserved_at) VALUES(?,'Teste','short','reservada',?,?) RETURNING id",
      )
      .bind(owner, editor, new Date(now.getTime() - hours * 3600000).toISOString())
      .first<{ id: number }>();
    const input = {
      missionId: m!.id,
      actorId: owner,
      action: "reassign_mission" as const,
      reason: "Outro editor por favor",
      version: 0,
      requestId: crypto.randomUUID(),
    };
    return { owner, editor, other, id: m!.id, input, repo: createD1MissionOwner(db, () => now) };
  }
  test("48 hours boundary and reset on a new acceptance", async () => {
    const x = await setup(48 - 1 / 3600000);
    assert.deepEqual(await x.repo.act(x.input), { ok: false, reason: "conflict" });
    now = new Date(now.getTime() + 1);
    assert.deepEqual(await x.repo.act(x.input), { ok: true });
    const queue = createD1MissionQueue(db, () => now);
    assert.deepEqual(await queue.reserveMission(x.id, x.editor), {
      ok: false,
      reason: "mission_unavailable",
    });
    assert.deepEqual(await queue.reserveMission(x.id, x.other), { ok: true });
    const controls = await x.repo.controls(x.id, x.owner);
    assert.ok(controls.ok);
    assert.equal(controls.controls.canReassign, false);
    assert.equal(
      controls.controls.reassignAvailableAt,
      new Date(now.getTime() + 48 * 3600000).toISOString(),
    );
  });
  test("owner only, reason validation, idempotency and payload conflict", async () => {
    const x = await setup(49);
    assert.deepEqual(await x.repo.act({ ...x.input, actorId: x.other }), {
      ok: false,
      reason: "forbidden",
    });
    assert.deepEqual(await x.repo.act({ ...x.input, reason: "x" }), {
      ok: false,
      reason: "invalid_reason",
    });
    const results = await Promise.all([x.repo.act(x.input), x.repo.act(x.input)]);
    assert.ok(results.every((r) => r.ok));
    assert.deepEqual(await x.repo.act({ ...x.input, reason: "Changed reason" }), {
      ok: false,
      reason: "conflict",
    });
    assert.equal((await x.repo.notifications(x.editor)).length, 1);
    const count = await db
      .prepare("SELECT count(*) AS n FROM email_queue WHERE key = ?")
      .bind(`mission-owner:${x.input.requestId}`)
      .first<{ n: number }>();
    assert.equal(count!.n, 1);
  });
  test("delivery and cancellation race has exactly one winner; first delivery never unlocks again", async () => {
    const x = await setup();
    const lifecycle = createD1MissionLifecycle(db);
    const results = await Promise.all([
      lifecycle.submitDelivery(x.id, x.editor, {
        link: "https://example.test/video",
        videoUrl: null,
      }),
      x.repo.act({ ...x.input, action: "cancel_mission" }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    if (results[0].ok) {
      await lifecycle.requestInspectorRevision(x.id, "Ajustar audio");
      const controls = await x.repo.controls(x.id, x.owner);
      assert.ok(controls.ok);
      assert.equal(controls.controls.canCancel, false);
      assert.equal(controls.controls.canReassign, false);
    }
  });
  test("old editor keeps only their conversation; removed editor cannot deliver or post", async () => {
    const x = await setup();
    const chat = createD1MissionCollaboration(db);
    const old = { id: x.editor, name: "Antigo", role: "editor" as const };
    const owner = { id: x.owner, name: "Voz", role: "spokesperson" as const };
    assert.ok((await chat.sendMessage(x.id, old, "Mensagem antiga")).ok);
    assert.ok((await x.repo.act(x.input)).ok);
    assert.equal((await chat.sendMessage(x.id, old, "Nao permitido")).ok, false);
    assert.equal(
      (
        await createD1MissionLifecycle(db).submitDelivery(x.id, x.editor, {
          link: "https://example.test/v",
          videoUrl: null,
        })
      ).ok,
      false,
    );
    assert.ok((await createD1MissionQueue(db, () => now).reserveMission(x.id, x.other)).ok);
    assert.ok((await chat.sendMessage(x.id, owner, "Mensagem nova")).ok);
    const past = await chat.messagesForMission(x.id, old);
    const current = await chat.messagesForMission(x.id, { id: x.other, role: "editor" });
    const all = await chat.messagesForMission(x.id, owner);
    assert.ok(past.ok && current.ok && all.ok);
    assert.deepEqual(
      past.messages.map((m) => m.text),
      ["Mensagem antiga"],
    );
    assert.deepEqual(
      current.messages.map((m) => m.text),
      ["Mensagem nova"],
    );
    assert.equal(all.messages.length, 2);
    assert.equal((await chat.messagesForMission(x.id, { id: 999999, role: "editor" })).ok, false);
  });
  test("cancel leaves read-only history and does not change editor availability", async () => {
    const x = await setup(1);
    const chat = createD1MissionCollaboration(db);
    assert.ok((await x.repo.act({ ...x.input, action: "cancel_mission" })).ok);
    assert.equal(
      (
        await chat.sendMessage(
          x.id,
          { id: x.owner, name: "Voz", role: "spokesperson" },
          "Nao enviar",
        )
      ).ok,
      false,
    );
    assert.equal((await createD1MissionQueue(db).reserveMission(x.id, x.other)).ok, false);
    const row = await db
      .prepare("SELECT status,reserved_by_id FROM missions WHERE id=?")
      .bind(x.id)
      .first();
    assert.deepEqual(row, { status: "cancelada", reserved_by_id: null });
  });
  test("without another eligible editor the mission waits; pending offers cannot resurrect cancellation", async () => {
    const x = await setup();
    const queue = createD1MissionQueue(db, () => now);
    await queue.markEditorActive(x.editor);
    assert.ok((await x.repo.act(x.input)).ok);
    await queue.dispatchOffers();
    assert.equal(
      (await db
        .prepare("SELECT status FROM missions WHERE id=?")
        .bind(x.id)
        .first<{ status: string }>())!.status,
      "disponivel",
    );
    assert.equal(
      await db
        .prepare("SELECT id FROM offers WHERE mission_id=? AND status='pendente'")
        .bind(x.id)
        .first(),
      null,
    );
    await db
      .prepare(
        "INSERT INTO offers(mission_id,editor_id,offered_at,expires_at,position) VALUES(?,?,?,?,1)",
      )
      .bind(x.id, x.other, now.toISOString(), new Date(now.getTime() + 300000).toISOString())
      .run();
    const control = await x.repo.controls(x.id, x.owner);
    assert.ok(control.ok);
    assert.ok(
      (
        await x.repo.act({
          ...x.input,
          requestId: crypto.randomUUID(),
          action: "cancel_mission",
          version: control.controls.version,
        })
      ).ok,
    );
    assert.equal((await queue.acceptOffer(x.id, x.other)).ok, false);
    await queue.expireOffers();
    assert.equal(
      (await db
        .prepare("SELECT status FROM missions WHERE id=?")
        .bind(x.id)
        .first<{ status: string }>())!.status,
      "cancelada",
    );
  });
  test("outbox failure rolls back state, audit and owner event", async () => {
    const x = await setup();
    await db
      .prepare(
        "CREATE TRIGGER owner_test_outbox_failure BEFORE INSERT ON email_queue BEGIN SELECT RAISE(ABORT,'test_outbox_failure'); END;",
      )
      .run();
    try {
      await assert.rejects(x.repo.act(x.input), /test_outbox_failure/);
      assert.equal(
        (await db
          .prepare("SELECT status FROM missions WHERE id=?")
          .bind(x.id)
          .first<{ status: string }>())!.status,
        "reservada",
      );
      assert.equal((await x.repo.notifications(x.editor)).length, 0);
      assert.equal(
        await db
          .prepare("SELECT id FROM admin_audit WHERE action='reassign_mission' AND entity_id=?")
          .bind(String(x.id))
          .first(),
        null,
      );
    } finally {
      await db.prepare("DROP TRIGGER owner_test_outbox_failure").run();
    }
  });
});
