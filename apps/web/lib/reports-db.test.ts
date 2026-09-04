import assert from "node:assert/strict";
import test from "node:test";
import type { Report } from "./reports-db.ts";
import { unwrapReportsResponse } from "./reports-db.ts";

const report = { id: 1 } as Report;

test("extrai denúncias do envelope da API", () => {
  assert.deepEqual(unwrapReportsResponse({ reports: [report] }), [report]);
  assert.deepEqual(unwrapReportsResponse({ denuncias: [report] }), [report]);
  assert.deepEqual(unwrapReportsResponse({ items: [report] }), [report]);
});

test("aceita lista antiga e rejeita resposta inválida", () => {
  assert.deepEqual(unwrapReportsResponse([report]), [report]);
  assert.deepEqual(unwrapReportsResponse(null), []);
  assert.deepEqual(unwrapReportsResponse({ reports: {} }), []);
});
