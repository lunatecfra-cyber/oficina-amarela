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

/**
 * Regras de produto que as migrações sustentam.
 *
 * Trazido do `lib/database-migrations.test.ts` do trabalho de ranking
 * eleitoral: três migrações já saíram com o vocabulário errado (uma alterava
 * `missions`, que não existe em produção, e parava a fila inteira) e os
 * valores de XP já foram aprovados com proporção fixa — nada disso pode andar
 * em silêncio de novo.
 */

const R2 = "20260818_add_r2_and_compliance_columns.sql";
const TSE = "20260818_add_r2_and_tse_columns.sql";
const GAMIFICATION = "20260827_add_gamification_events.sql";
const ELECTORAL = "20260829_add_electoral_ranking.sql";

function migration(name: string): string {
  return readFileSync(path.join(MIGRATIONS, name), "utf8");
}

describe("regras de produto nas migrações", () => {
  test("R2 mexe nas tabelas de produção, em português", () => {
    for (const name of [R2, TSE]) {
      const sql = migration(name);
      assert.match(sql, /ALTER TABLE pautas/i);
      assert.doesNotMatch(sql, /ALTER TABLE missions/i);
    }
    assert.match(migration(R2), /ADD COLUMN IF NOT EXISTS video_bruto_url/i);
  });

  test("migração eleitoral prepara a coluna legada antes da função usar", () => {
    const sql = migration(ELECTORAL);
    const referralColumn = sql.indexOf("ADD COLUMN IF NOT EXISTS codigo_indicacao");
    const functionStart = sql.indexOf("CREATE OR REPLACE FUNCTION oficina_private.aprovar_edicao");
    assert.ok(referralColumn >= 0 && referralColumn < functionStart);
    assert.doesNotMatch(sql, /\b(?:missions|reviews)\b/i);
  });

  test("gamificação usa os nomes de produção, sem tabela paralela em inglês", () => {
    const sql = migration(GAMIFICATION);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS gamificacao_regras/i);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS gamificacao_eventos/i);
    assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS gamification_/i);
  });

  test("funções eleitorais privadas não abrem para as roles públicas", () => {
    const sql = migration(ELECTORAL);
    assert.match(sql, /SECURITY INVOKER/i);
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION oficina_private\.aprovar_edicao\(INT, INT, TEXT, INT, TEXT\) FROM PUBLIC;/,
    );
  });

  test("proporções de XP seguem a regra aprovada do produto", () => {
    const gamification = migration(GAMIFICATION);
    const electoral = migration(ELECTORAL);
    assert.match(gamification, /'entrada_diaria'[^\n]+25/i);
    assert.match(gamification, /'missao_entregue'[^\n]+100/i);
    assert.match(electoral, /DEFAULT 100 CHECK \(pontos = 100\)/i);
    assert.doesNotMatch(
      electoral,
      /reputacao = reputacao \+ COALESCE\(\(SELECT xp FROM novo_evento\), 0\)/i,
    );
  });

  test("entregar missão registra o evento de gamificação", () => {
    const lifecycle = readFileSync(
      path.join(ROOT, "apps/api/src/routes/mission-lifecycle.ts"),
      "utf8",
    );
    assert.match(
      lifecycle,
      /action === "deliver"[\s\S]{0,500}recordGamificationEvent\(session\.id, "mission_delivered"/,
    );
  });

  test("painel diário não vende XP de vídeo como recompensa única", () => {
    const panel = readFileSync(path.join(ROOT, "apps/web/components/daily-challenges.tsx"), "utf8");
    assert.match(panel, /Cada vídeo entregue soma 100 XP/i);
    assert.doesNotMatch(panel, /XP extra por manter o ritmo\. Independe da missão/i);
  });
});
