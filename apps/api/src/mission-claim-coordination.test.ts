import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { MissionQueueFailure, QueueResult } from "@oficina/db/mission-queue";
import { coordinateMissionClaim, type MissionClaimRequest } from "./mission-claim-coordination.ts";

function storage() {
  const values = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async <T>(key: string, value: T) => void values.set(key, value),
  };
}

function request(overrides: Partial<MissionClaimRequest> = {}): MissionClaimRequest {
  return {
    requestId: crypto.randomUUID(),
    missionId: 1,
    editorId: 1,
    requestedAt: 10_000,
    ...overrides,
  };
}

describe("coordenação de reserva por missão", () => {
  test("dois editores disputando a mesma missão têm um vencedor", async () => {
    let owner: number | null = null;
    const queue = {
      reserveMission: async (_missionId: number, editorId: number): Promise<QueueResult> => {
        if (owner !== null) return { ok: false, reason: "mission_unavailable" };
        owner = editorId;
        return { ok: true };
      },
    };
    const state = storage();

    const results = await Promise.all([
      coordinateMissionClaim(state, queue, request({ editorId: 1 }), 10_000),
      coordinateMissionClaim(state, queue, request({ editorId: 2 }), 10_000),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
  });

  test("a invariante do banco barra o mesmo editor em duas missões", async () => {
    const activeEditors = new Set<number>();
    const queue = {
      reserveMission: async (_missionId: number, editorId: number): Promise<QueueResult> => {
        if (activeEditors.has(editorId)) {
          return { ok: false, reason: "already_holds_mission" };
        }
        activeEditors.add(editorId);
        return { ok: true };
      },
    };

    const results = await Promise.all([
      coordinateMissionClaim(storage(), queue, request({ missionId: 1 }), 10_000),
      coordinateMissionClaim(storage(), queue, request({ missionId: 2 }), 10_000),
    ]);
    assert.equal(results.filter((result) => result.ok).length, 1);
  });

  test("nova tentativa pode vencer depois de conflito", async () => {
    let attempts = 0;
    const queue = {
      reserveMission: async (): Promise<QueueResult> => {
        attempts++;
        return attempts === 1
          ? { ok: false, reason: "mission_unavailable" as MissionQueueFailure }
          : { ok: true };
      },
    };
    const state = storage();

    assert.deepEqual(await coordinateMissionClaim(state, queue, request(), 10_000), {
      ok: false,
      reason: "mission_unavailable",
    });
    assert.deepEqual(await coordinateMissionClaim(state, queue, request(), 10_000), { ok: true });
  });

  test("pedido obsoleto não chega ao repositório", async () => {
    let called = false;
    const result = await coordinateMissionClaim(
      storage(),
      {
        reserveMission: async () => {
          called = true;
          return { ok: true };
        },
      },
      request({ requestedAt: 1 }),
      40_001,
    );
    assert.deepEqual(result, { ok: false, reason: "stale_request" });
    assert.equal(called, false);
  });

  test("pedido duplicado devolve o mesmo resultado sem nova escrita", async () => {
    let calls = 0;
    const queue = {
      reserveMission: async (): Promise<QueueResult> => {
        calls++;
        return { ok: true };
      },
    };
    const state = storage();
    const claim = request();

    assert.deepEqual(await coordinateMissionClaim(state, queue, claim, 10_000), { ok: true });
    assert.deepEqual(await coordinateMissionClaim(state, queue, claim, 50_000), { ok: true });
    assert.equal(calls, 1);
  });
});
