import assert from "node:assert/strict";
import test from "node:test";
import type { Mission } from "./missions.ts";
import { activeWorkFromMission } from "./schedule.ts";

test("agenda recebe o prazo real da reserva", () => {
  const mission = {
    id: "db-1",
    title: "Corte",
    spokesperson: "Porta-voz",
    format: "short",
    brief: {},
    status: "reserved",
    createdAt: "2026-09-03T10:00:00.000Z",
    reservedAt: "2026-09-03T11:00:00.000Z",
    reservedUntil: "2026-09-03T23:00:00.000Z",
  } satisfies Mission;

  const [task] = activeWorkFromMission(mission);
  assert.equal(task.deadlineIso, mission.reservedUntil);
});
