import assert from "node:assert/strict";
import test from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { createApp } from "../app.ts";
import { postgresApiDependencies } from "../dependencies.ts";
import type { OwnerActionInput, OwnerActionResult } from "@oficina/db/mission-owner";

process.env.AUTH_SECRET ??= "owner-test-secret-at-least-thirty-two-characters";
async function cookie(role: "editor" | "spokesperson") {
  return `${COOKIE_NAME}=${await createSessionToken({ id: 77, handle: "test-owner", name: "Teste", role })}`;
}
function fixture(outcome: OwnerActionResult = { ok: true }) {
  const calls: OwnerActionInput[] = [];
  const app = createApp({
    ...postgresApiDependencies,
    missionLifecycle: {
      ...postgresApiDependencies.missionLifecycle,
      missionExists: async () => true,
    },
    missionOwner: {
      controls: async () => ({
        ok: true,
        controls: {
          canCancel: true,
          canReassign: false,
          reassignAvailableAt: null,
          cancelled: false,
          version: 2,
        },
      }),
      act: async (input) => {
        calls.push(input);
        return outcome;
      },
      notifications: async (id) => [
        {
          id: "test",
          missionId: id,
          action: "cancel_mission",
          reason: "Teste",
          createdAt: "2026-09-07T12:00:00Z",
        },
      ],
    },
    missionQueue: { ...postgresApiDependencies.missionQueue, dispatchOffers: async () => 0 },
    recordGamificationEvent: async () => {
      throw new Error("Owner actions must not award XP");
    },
  });
  return { app, calls };
}
test("owner controls and notifications reach static routes", async () => {
  const { app } = fixture();
  const headers = { cookie: await cookie("spokesperson") };
  const response = await app.request("http://api.local/missions/db-1/owner-controls", { headers });
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { controls: { version: number } }).controls.version, 2);
  const notices = await app.request("http://api.local/missions/owner-notifications", { headers });
  assert.equal(notices.status, 200);
  assert.equal(
    ((await notices.json()) as { notifications: Array<{ missionId: number }> }).notifications[0]
      .missionId,
    77,
  );
});
test("distinct owner actions preserve request key/version and require owner role", async () => {
  for (const action of ["cancel_mission", "reassign_mission"]) {
    const { app, calls } = fixture();
    const requestId = crypto.randomUUID();
    const init = {
      method: "POST",
      headers: {
        cookie: await cookie("spokesperson"),
        "content-type": "application/json",
        "idempotency-key": requestId,
      },
      body: JSON.stringify({ action, reason: "Motivo do teste", version: 2 }),
    };
    assert.equal((await app.request("http://api.local/missions/db-1", init)).status, 200);
    assert.deepEqual(calls[0], {
      missionId: 1,
      actorId: 77,
      action,
      reason: "Motivo do teste",
      version: 2,
      requestId,
    });
    init.headers.cookie = await cookie("editor");
    assert.equal((await app.request("http://api.local/missions/db-1", init)).status, 403);
    assert.equal(calls.length, 1);
  }
});
test("conflict returns 409 JSON and anonymous owner action fails", async () => {
  const { app } = fixture({ ok: false, reason: "conflict" });
  const response = await app.request("http://api.local/missions/1", {
    method: "POST",
    headers: { cookie: await cookie("spokesperson"), "content-type": "application/json" },
    body: JSON.stringify({ action: "cancel_mission" }),
  });
  assert.equal(response.status, 409);
  assert.match(((await response.json()) as { error: string }).error, /missão mudou/);
  assert.equal((await app.request("http://api.local/missions/1", { method: "POST" })).status, 401);
  assert.equal(
    (
      await app.request("http://api.local/missions/1", {
        method: "DELETE",
        headers: { cookie: await cookie("editor") },
      })
    ).status,
    403,
  );
});
