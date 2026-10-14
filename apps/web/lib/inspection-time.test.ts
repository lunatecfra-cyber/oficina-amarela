import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectionDate, inspectionWait } from "./inspection-time.ts";

test("inspection dates preserve unknown timestamps and date-only deadlines", () => {
  for (const value of [null, "", "invalid"]) {
    assert.equal(inspectionDate(value), "Não informado");
    assert.equal(inspectionWait(value), "Tempo de espera não informado");
  }
  assert.equal(inspectionDate("2026-11-01"), "01/11/2026");
  assert.match(inspectionDate("2026-10-14T01:00:00Z"), /13\/10\/2026.*22:00:00/);
});

test("inspection waiting time handles recent and future submissions without negative hours", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  assert.equal(inspectionWait("2026-10-14T10:00:00Z", now), "Há 2 hora(s)");
  assert.equal(inspectionWait("2026-10-14T11:30:00Z", now), "Há menos de uma hora");
  assert.equal(inspectionWait("2026-10-14T13:00:00Z", now), "Há menos de uma hora");
});
