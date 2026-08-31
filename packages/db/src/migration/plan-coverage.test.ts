// O plano de migração estava incompleto em silêncio: portfolio, conquistas,
// musicas, novidades e gamificacao_regras existiam nos dois schemas e não eram
// copiadas. A conferência também não pegava, porque só olhava o que o plano
// listava — o dado sumiria sem ninguém ver.
//
// Este teste lê os dois schemas e exige que toda tabela comum esteja no plano
// ou tenha uma exclusão declarada com motivo.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { MIGRATION_EXCLUSIONS, MIGRATION_PLAN } from "./pg-to-d1.ts";

const TABLE = /CREATE TABLE IF NOT EXISTS (\w+)/g;

async function tablesOf(url: URL): Promise<Set<string>> {
  const source = await readFile(url, "utf8");
  return new Set(Array.from(source.matchAll(TABLE), (match) => match[1]));
}

describe("cobertura do plano de migração", () => {
  test("toda tabela comum aos dois schemas é migrada ou excluída com motivo", async () => {
    const postgres = await tablesOf(new URL("../../../../supabase/schema.sql", import.meta.url));
    const d1 = await tablesOf(new URL("../../d1/0001_mission_slice.sql", import.meta.url));

    const planned = new Set(MIGRATION_PLAN.map((entry) => entry.table));
    const excluded = new Set(Object.keys(MIGRATION_EXCLUSIONS));

    const shared = [...postgres].filter((table) => d1.has(table));
    assert.ok(shared.length > 15, "os schemas deveriam compartilhar a maior parte das tabelas");

    const forgotten = shared.filter((table) => !planned.has(table) && !excluded.has(table));
    assert.deepEqual(
      forgotten,
      [],
      `tabelas nos dois schemas mas fora do plano e sem exclusão declarada: ${forgotten.join(", ")}`,
    );
  });

  test("nenhuma exclusão silenciosa: todo motivo é texto de verdade", () => {
    for (const [table, reason] of Object.entries(MIGRATION_EXCLUSIONS)) {
      assert.ok(reason.length > 20, `exclusão de ${table} precisa de um motivo explícito`);
    }
  });

  test("o plano não lista tabela que o destino não tem", async () => {
    const d1 = await tablesOf(new URL("../../d1/0001_mission_slice.sql", import.meta.url));
    const missing = MIGRATION_PLAN.map((entry) => entry.table).filter((table) => !d1.has(table));
    assert.deepEqual(missing, [], `plano aponta para tabela ausente no D1: ${missing.join(", ")}`);
  });
});
