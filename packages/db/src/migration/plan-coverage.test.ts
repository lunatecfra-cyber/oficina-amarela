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
    // Destino real é 0001+0002+0003 (inglês após a 0003): conferir só o 0001
    // dava falsa cobertura — tabela renomeada sumia do teste e da migração.
    const d1Dir = new URL("../../d1/", import.meta.url);
    const { readdir } = await import("node:fs/promises");
    const d1 = new Set<string>();
    for (const file of (await readdir(d1Dir)).filter((f) => f.endsWith(".sql")).sort()) {
      for (const table of await tablesOf(new URL(file, d1Dir))) d1.add(table);
    }
    // Nomes novos (inglês) voltam para o vocabulário da origem via de-para,
    // senão nenhuma tabela renomeada (missions, offers, ...) conta como comum.
    const { LEGACY_TABLES } = await import("./legacy-names.ts");
    const reverse = new Map(Object.entries(LEGACY_TABLES).map(([pt, en]) => [en, pt]));
    const d1AsLegacy = new Set([...d1].map((t) => reverse.get(t) ?? t));

    const planned = new Set(MIGRATION_PLAN.map((entry) => entry.table));
    const excluded = new Set(Object.keys(MIGRATION_EXCLUSIONS));

    const shared = [...postgres].filter((table) => d1AsLegacy.has(table));
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
    const d1Dir = new URL("../../d1/", import.meta.url);
    const { readdir } = await import("node:fs/promises");
    const d1 = new Set<string>();
    for (const file of (await readdir(d1Dir)).filter((f) => f.endsWith(".sql")).sort()) {
      for (const table of await tablesOf(new URL(file, d1Dir))) d1.add(table);
    }
    const { LEGACY_TABLES } = await import("./legacy-names.ts");
    const reverse = new Map(Object.entries(LEGACY_TABLES).map(([pt, en]) => [en, pt]));
    const d1AsLegacy = new Set([...d1].map((t) => reverse.get(t) ?? t));
    // Tabelas só de evento do D1 (sem origem em PG) não entram no plano.
    const d1Only = new Set(["mission_approvals", "invitation_redemptions"]);
    const missing = MIGRATION_PLAN.map((entry) => entry.table).filter(
      (table) => !d1AsLegacy.has(table) && !d1.has(table) && !d1Only.has(table),
    );
    assert.deepEqual(missing, [], `plano aponta para tabela ausente no D1: ${missing.join(", ")}`);
  });
});
