import assert from "node:assert/strict";
import test from "node:test";

import { migratedMissionAction } from "./mission-actions.ts";

test("aceita revision como alias legado de pedir ajuste", () => {
  assert.equal(migratedMissionAction("revision"), "adjust");
});
