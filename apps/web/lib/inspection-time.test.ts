import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inspectionAttention,
  inspectionDate,
  inspectionWait,
  inspectionWaitShort,
  sortInspectionQueue,
} from "./inspection-time.ts";

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

test("inspection waiting time switches to days after two days and has a short form", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  assert.equal(inspectionWait("2026-10-12T11:00:00Z", now), "Há 2 dia(s)");
  assert.equal(inspectionWaitShort("2026-10-14T10:00:00Z", now), "2 h");
  assert.equal(inspectionWaitShort("2026-10-10T12:00:00Z", now), "4 dias");
  assert.equal(inspectionWaitShort(null, now), "—");
});

test("attention flags overdue deadlines and long waits only for deliveries awaiting inspection", () => {
  const now = Date.parse("2026-10-14T15:00:00Z");
  const base = { status: "em_revisao", submittedAt: "2026-10-14T13:00:00Z", deadline: null };
  assert.deepEqual(inspectionAttention(base, now), { level: "none", reasons: [] });
  assert.deepEqual(inspectionAttention({ ...base, deadline: "2026-10-13" }, now), {
    level: "high",
    reasons: ["Prazo vencido"],
  });
  assert.deepEqual(inspectionAttention({ ...base, deadline: "2026-10-14" }, now), {
    level: "medium",
    reasons: ["Prazo vence hoje"],
  });
  assert.deepEqual(inspectionAttention({ ...base, submittedAt: "2026-10-13T09:00:00Z" }, now), {
    level: "medium",
    reasons: ["Aguarda há mais de um dia"],
  });
  assert.equal(
    inspectionAttention({ ...base, status: "aprovada", deadline: "2026-10-01" }, now).level,
    "none",
  );
});

test("queue puts attention first, then oldest waiting; history shows newest first", () => {
  const now = Date.parse("2026-10-14T15:00:00Z");
  const item = (
    id: string,
    status: string,
    submittedAt: string | null,
    deadline: string | null = null,
  ) => ({
    id,
    status,
    submittedAt,
    deadline,
  });
  const waiting = sortInspectionQueue(
    [
      item("recent", "em_revisao", "2026-10-14T14:00:00Z"),
      item("overdue", "em_revisao", "2026-10-14T14:30:00Z", "2026-10-10"),
      item("older", "em_revisao", "2026-10-14T09:00:00Z"),
      item("unknown", "em_revisao", null),
    ],
    now,
  );
  assert.deepEqual(
    waiting.map((i) => i.id),
    ["overdue", "older", "recent", "unknown"],
  );
  const history = sortInspectionQueue(
    [
      item("a", "finalizada", "2026-10-01T10:00:00Z"),
      item("b", "finalizada", "2026-10-05T10:00:00Z"),
    ],
    now,
  );
  assert.deepEqual(
    history.map((i) => i.id),
    ["b", "a"],
  );
});
