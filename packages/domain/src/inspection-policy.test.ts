import assert from "node:assert/strict";
import test from "node:test";
import { inspectionPolicy } from "./inspection-policy.ts";

test("inspeção das primeiras entregas e dos riscos definidos", () => {
  for (const deliveries of [0, 1, 2]) assert.equal(inspectionPolicy({ deliveries }).required, true);
  assert.equal(
    inspectionPolicy({ deliveries: 0, experiencedInvitedByAdmin: true }).reason,
    "invited_first_delivery",
  );
  assert.equal(inspectionPolicy({ deliveries: 1, experiencedInvitedByAdmin: true }).required, null);
  assert.equal(inspectionPolicy({ deliveries: 20, critical: true }).required, true);
  assert.equal(inspectionPolicy({ deliveries: 20, riskRequiresInspection: true }).required, true);
});
test("amostragem pendente não inventa probabilidade e staging exige inspeção", () => {
  assert.equal(inspectionPolicy({ deliveries: 3 }).required, null);
  assert.equal(
    inspectionPolicy({ deliveries: 20, stagingMandatory: true }).reason,
    "staging_mandatory",
  );
  for (const sampled of [true, false])
    assert.equal(
      inspectionPolicy({ deliveries: 20, critical: false, riskRequiresInspection: false, sampled })
        .required,
      sampled,
    );
});
