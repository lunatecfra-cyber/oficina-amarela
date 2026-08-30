import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { countByWeek, cycleWeeks, startOfWeek, weekKey } from "./ranking-cycle.ts";

describe("semanas do ciclo do ranking", () => {
  test("a semana começa na segunda, como o date_trunc do PostgreSQL", () => {
    // 2026-08-30 é um domingo: pertence à semana que começou em 24/08.
    assert.equal(
      startOfWeek(new Date("2026-08-30T23:00:00Z")).toISOString(),
      "2026-08-24T00:00:00.000Z",
    );
    assert.equal(
      startOfWeek(new Date("2026-08-24T00:00:00Z")).toISOString(),
      "2026-08-24T00:00:00.000Z",
    );
    assert.equal(
      startOfWeek(new Date("2026-08-31T00:00:00Z")).toISOString(),
      "2026-08-31T00:00:00.000Z",
    );
  });

  test("semana inteira cobra dois; semana encurtada pelo fim do ciclo cobra um", () => {
    const weeks = cycleWeeks(
      new Date("2026-08-03T00:00:00Z"),
      // Termina numa quarta: a última janela tem 3 dias.
      new Date("2026-08-19T00:00:00Z"),
      new Date("2026-08-20T00:00:00Z"),
    );
    assert.deepEqual(
      weeks.map((week) => [weekKey(week), week.goal]),
      [
        ["2026-08-03", 2],
        ["2026-08-10", 2],
        ["2026-08-17", 1],
      ],
    );
  });

  test("não inventa semanas além de agora", () => {
    const weeks = cycleWeeks(
      new Date("2026-08-03T00:00:00Z"),
      new Date("2026-12-31T00:00:00Z"),
      new Date("2026-08-12T00:00:00Z"),
    );
    assert.deepEqual(weeks.map(weekKey), ["2026-08-03", "2026-08-10"]);
  });

  test("completedOnly deixa de fora a semana ainda em curso", () => {
    const closed = cycleWeeks(
      new Date("2026-08-03T00:00:00Z"),
      new Date("2026-12-31T00:00:00Z"),
      new Date("2026-08-12T00:00:00Z"),
      { completedOnly: true },
    );
    assert.deepEqual(closed.map(weekKey), ["2026-08-03"]);
  });

  test("conta aprovações na semana certa, com a borda fechada no início", () => {
    const weeks = cycleWeeks(
      new Date("2026-08-03T00:00:00Z"),
      new Date("2026-08-24T00:00:00Z"),
      new Date("2026-08-20T00:00:00Z"),
    );
    const counts = countByWeek(weeks, [
      new Date("2026-08-03T00:00:00Z"),
      new Date("2026-08-09T23:59:59Z"),
      new Date("2026-08-10T00:00:00Z"),
      new Date("2026-07-31T00:00:00Z"),
    ]);
    assert.deepEqual(counts, [2, 1, 0]);
  });
});
