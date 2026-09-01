import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Toda migração fala o vocabulário do schema.
 *
 * O schema em produção é PT-BR (`pautas`, `gamificacao_eventos`,
 * `marca_dagua`), e parte do código nasceu em inglês. Três migrações saíram
 * com o vocabulário errado e ninguém percebeu, porque nada as executava em
 * ordem: uma alterava `missions`, que não existe, e parava a fila inteira com
 * "relation missions does not exist"; outra criava `gamification_rules` e
 * `gamification_events`, tabelas que consulta nenhuma lê.
 *
 * A conferência é contra `schema.sql`, que é a definição canônica — não contra
 * uma lista escrita aqui, que envelheceria sozinha.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const MIGRATIONS = path.join(ROOT, "supabase/migrations");
const SCHEMA = path.join(ROOT, "supabase/schema.sql");

/** Tabelas que o schema canônico declara. */
function schemaTables(): Set<string> {
  const sql = readFileSync(SCHEMA, "utf8");
  return new Set(
    Array.from(sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi), (m) => m[1].toLowerCase()),
  );
}

/** Tabelas que cada migração toca ou cria. */
function migrationTables(sql: string): { altered: string[]; created: string[]; renamed: string[] } {
  const strip = sql.replace(/^\s*--.*$/gm, "");
  return {
    altered: Array.from(strip.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(\w+)/gi), (m) =>
      m[1].toLowerCase(),
    ),
    created: Array.from(strip.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi), (m) =>
      m[1].toLowerCase(),
    ),
    renamed: Array.from(
      strip.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:ONLY )?\w+\s+RENAME TO\s+(\w+)/gi),
      (m) => m[1].toLowerCase(),
    ),
  };
}

const files = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort();

describe("vocabulário das migrações", () => {
  test("existem migrações para conferir", () => {
    assert.ok(files.length >= 5, `poucas migrações encontradas: ${files.length}`);
  });

  test("nenhuma migração altera tabela que o schema não tem", () => {
    const known = schemaTables();
    const offenders: string[] = [];
    for (const file of files) {
      const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
      const { altered, created, renamed } = migrationTables(sql);
      // uma migração pode alterar o que ela mesma acabou de criar ou renomear
      const available = new Set([...known, ...created, ...renamed]);
      for (const table of altered) {
        if (!available.has(table)) offenders.push(`${file} → ALTER TABLE ${table}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("nenhuma migração cria tabela em inglês paralela à de produção", () => {
    // gamification_events vivia ao lado de gamificacao_eventos, sem ninguém ler
    const known = schemaTables();
    const offenders: string[] = [];
    for (const file of files) {
      const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
      for (const table of migrationTables(sql).created) {
        if (known.has(table)) continue;
        const ptEquivalent = [...known].find(
          (name) => name.replace(/[çãáéíóú_]/g, "") === table.replace(/_/g, ""),
        );
        if (ptEquivalent) offenders.push(`${file} → ${table} duplica ${ptEquivalent}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("coluna nova entra com IF NOT EXISTS, pra migração poder repetir", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const sql = readFileSync(path.join(MIGRATIONS, file), "utf8").replace(/^\s*--.*$/gm, "");
      for (const match of sql.matchAll(/ADD COLUMN (?!IF NOT EXISTS)(\w+)/gi)) {
        offenders.push(`${file} → ADD COLUMN ${match[1]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
