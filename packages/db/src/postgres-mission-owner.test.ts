import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { postgresMissionOwner } from "./postgres-mission-owner.ts";
import { postgresMissionCollaboration } from "./mission-collaboration.ts";

const original = globalThis.__workshopSql;
afterEach(() => {
  globalThis.__workshopSql = original;
});
type Query = { text: string; values: unknown[]; transaction: boolean };
function mockDb(responses: unknown[][], failAt = -1) {
  const calls: Query[] = [];
  let transaction = false;
  let rolledBack = false;
  const client = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ text: strings.join("?").replace(/\s+/g, " "), values, transaction });
      if (calls.length === failAt) throw new Error("outbox unavailable");
      assert.ok(responses.length, "Unexpected query");
      return responses.shift()!;
    },
    {
      begin: async (run: (tx: unknown) => Promise<unknown>) => {
        transaction = true;
        try {
          return await run(client);
        } catch (error) {
          rolledBack = true;
          throw error;
        } finally {
          transaction = false;
        }
      },
    },
  );
  globalThis.__workshopSql = client as unknown as NonNullable<typeof globalThis.__workshopSql>;
  return { calls, rolledBack: () => rolledBack };
}
const input = {
  missionId: 1,
  actorId: 2,
  action: "reassign_mission" as const,
  reason: "Sem entrega ainda",
  requestId: "owner-request-123456",
  version: 4,
};
const mission = {
  porta_voz_id: 2,
  reservada_por_id: 3,
  status: "reservada",
  first_delivered_at: null,
  lifecycle_version: 4,
  elapsed: true,
  titulo: "<Mission>",
};

test("owner checks ownership, first delivery, state, version and 48h eligibility", async () => {
  for (const [row, reason] of [
    [null, "mission_not_found"],
    [{ ...mission, porta_voz_id: 9 }, "forbidden"],
    [{ ...mission, first_delivered_at: "2026-09-01" }, "conflict"],
    [{ ...mission, status: "em_revisao" }, "conflict"],
    [{ ...mission, lifecycle_version: 5 }, "conflict"],
    [{ ...mission, elapsed: false }, "conflict"],
    [{ ...mission, reservada_por_id: null }, "conflict"],
  ] as const) {
    const db = mockDb([[], row ? [row] : [], []]);
    assert.deepEqual(await postgresMissionOwner.act(input), { ok: false, reason });
    assert.ok(db.calls.every((c) => !/^\s*(UPDATE|INSERT)/.test(c.text)));
  }
});

test("same normalized request replays successfully after mission changes; mismatch conflicts", async () => {
  const event = {
    mission_id: 1,
    actor_id: 2,
    action: input.action,
    reason: input.reason,
    expected_version: 4,
  };
  for (const mismatch of [false, true]) {
    const db = mockDb([
      [],
      [{ ...mission, status: "disponivel", lifecycle_version: 5 }],
      [{ ...event, expected_version: mismatch ? 3 : 4 }],
    ]);
    assert.deepEqual(
      await postgresMissionOwner.act({ ...input, reason: ` ${input.reason} ` }),
      mismatch ? { ok: false, reason: "conflict" } : { ok: true },
    );
    assert.equal(db.calls.length, 3);
  }
});

test("owner action, audit, offer invalidation and escaped email share transaction", async () => {
  const db = mockDb([[], [mission], [], [], [], [], []]);
  assert.deepEqual(await postgresMissionOwner.act({ ...input, reason: "<b>Motivo</b>" }), {
    ok: true,
  });
  assert.ok(db.calls.every((c) => c.transaction));
  assert.match(db.calls[0].text, /pg_advisory_xact_lock/);
  assert.match(db.calls[1].text, /FOR UPDATE/);
  assert.match(db.calls[3].text, /reservada_em = NULL/);
  assert.match(db.calls[4].text, /INSERT INTO mission_owner_events/);
  assert.match(db.calls[5].text, /UPDATE ofertas/);
  assert.ok(db.calls[6].values.includes(`mission-owner:${input.requestId}`));
  assert.ok(db.calls[6].values.some((v) => String(v).includes("&lt;b&gt;Motivo")));
});

test("outbox error rejects transaction instead of reporting success", async () => {
  const db = mockDb([[], [mission], [], [], [], []], 7);
  await assert.rejects(postgresMissionOwner.act(input), /outbox unavailable/);
  assert.equal(db.rolledBack(), true);
});

test("invalid reason and request do not query database", async () => {
  const db = mockDb([]);
  assert.deepEqual(await postgresMissionOwner.act({ ...input, reason: " " }), {
    ok: false,
    reason: "invalid_reason",
  });
  assert.deepEqual(await postgresMissionOwner.act({ ...input, requestId: "x" }), {
    ok: false,
    reason: "invalid_request",
  });
  assert.equal(db.calls.length, 0);
});

test("former editor reads only assignment-scoped messages", async () => {
  const db = mockDb([[{ porta_voz_id: 2, reservada_por_id: 4 }], [{ id: 7 }], []]);
  assert.deepEqual(
    await postgresMissionCollaboration.messagesForMission(1, { id: 3, role: "editor" }),
    { ok: true, messages: [] },
  );
  assert.match(db.calls[2].text, /OR a.editor_id =/);
  assert.equal(db.calls[2].values[1], false);
});

test("removed editor and cancelled mission reject chat after obtaining mission lock", async () => {
  for (const row of [
    { ...mission, reservada_por_id: 4 },
    { ...mission, status: "cancelada" },
  ]) {
    const db = mockDb([[row]]);
    assert.deepEqual(
      await postgresMissionCollaboration.sendMessage(
        1,
        { id: 3, role: "editor", name: "Editor" },
        "Hello",
      ),
      { ok: false, reason: "forbidden" },
    );
    assert.equal(db.calls.length, 1);
    assert.equal(db.calls[0].transaction, true);
    assert.match(db.calls[0].text, /FOR UPDATE/);
  }
});

test("controls expose database-computed eligibility and ISO timestamp", async () => {
  mockDb([[{ ...mission, available_at: new Date("2026-09-07T10:00:00Z") }]]);
  assert.deepEqual(await postgresMissionOwner.controls(1, 2), {
    ok: true,
    controls: {
      canCancel: true,
      canReassign: true,
      reassignAvailableAt: "2026-09-07T10:00:00.000Z",
      cancelled: false,
      version: 4,
    },
  });
});

test("cancel available mission needs no editor or 48h wait and does not enqueue email", async () => {
  const db = mockDb([
    [],
    [{ ...mission, status: "disponivel", reservada_por_id: null, elapsed: false }],
    [],
    [],
    [],
    [],
  ]);
  assert.deepEqual(await postgresMissionOwner.act({ ...input, action: "cancel_mission" }), {
    ok: true,
  });
  assert.equal(db.calls[3].values[0], "cancelada");
  assert.equal(db.calls.length, 6);
});

test("notifications are scoped to former editor and serialize timestamps", async () => {
  const db = mockDb([
    [
      {
        request_id: input.requestId,
        mission_id: 1,
        action: input.action,
        reason: input.reason,
        created_at: new Date("2026-09-07T12:00:00Z"),
      },
    ],
  ]);
  assert.deepEqual(await postgresMissionOwner.notifications(3), [
    {
      id: input.requestId,
      missionId: 1,
      action: input.action,
      reason: input.reason,
      createdAt: "2026-09-07T12:00:00.000Z",
    },
  ]);
  assert.match(db.calls[0].text, /WHERE previous_editor_id =/);
  assert.deepEqual(db.calls[0].values, [3]);
});
