import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApiDependencies } from "../dependencies.ts";
import { createRankingRoutes } from "./ranking.ts";

test("campeonato público retorna apenas agregados e prêmios reais", async () => {
  const routes = createRankingRoutes({ ranking: {
    freezeExpiredCycles: async () => {},
    currentCycle: async () => ({ id: 1, startsAt: "2026-08-01", endsAt: "2026-10-26" }),
    entriesForCycle: async () => [],
    raiseActiveMilestone: async () => 20,
  } } as unknown as ApiDependencies);
  const response = await routes.request("http://test/championship");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    activeEditors: 0,
    awards: ["ingresso_top1", "bandeira_top2"],
  });
});
