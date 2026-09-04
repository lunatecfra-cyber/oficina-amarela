import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readMigration = (name: string) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("R2 migration targets the production Portuguese tables", () => {
  const sql = readMigration("20260818_add_r2_and_compliance_columns.sql");

  assert.match(sql, /ALTER TABLE pautas/i);
  assert.doesNotMatch(sql, /ALTER TABLE missions/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS video_bruto_url/i);
});

test("electoral migration prepares legacy production columns before using them", () => {
  const sql = readMigration("20260829_add_electoral_ranking.sql");
  const functionStart = sql.indexOf("CREATE OR REPLACE FUNCTION oficina_private.aprovar_edicao");
  const scoredColumn = sql.indexOf("ADD COLUMN IF NOT EXISTS pontuada");
  const referralColumn = sql.indexOf("ADD COLUMN IF NOT EXISTS codigo_indicacao");

  assert.ok(scoredColumn >= 0 && scoredColumn < functionStart);
  assert.ok(referralColumn >= 0 && referralColumn < functionStart);
  assert.doesNotMatch(sql, /\b(?:missions|reviews)\b/i);
});

test("gamification migration uses the production table names", () => {
  const sql = readMigration("20260827_add_gamification_events.sql");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS gamificacao_regras/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS gamificacao_eventos/i);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS gamification_/i);
});

test("private electoral functions are not executable through public API roles", () => {
  const sql = readMigration("20260829_add_electoral_ranking.sql");

  assert.match(sql, /FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /SECURITY INVOKER/i);
});

test("candidate number is wired from APIs through persistence and migration", () => {
  const migration = readMigration("20260830_add_candidate_number.sql");
  const profileRoute = readFileSync(new URL("../app/api/spokesperson/profile/route.ts", import.meta.url), "utf8");
  const missionRoute = readFileSync(new URL("../app/api/missions/route.ts", import.meta.url), "utf8");
  const candidateDb = readFileSync(new URL("./candidate-db.ts", import.meta.url), "utf8");
  const missionsDb = readFileSync(new URL("./missions-db.ts", import.meta.url), "utf8");

  assert.match(profileRoute, /candidateNumber:\s*toStringOpt\(body\?\.candidateNumber \?\? body\?\.numeroEleitoral\)/);
  assert.match(candidateDb, /candidate_number\s*=\s*\$\{candidateNumber\}/);
  assert.match(candidateDb, /candidateNumber:\s*l\.candidate_number/);
  assert.match(missionRoute, /body\?\.candidateNumber \?\? body\?\.numeroEleitoral/);
  assert.match(missionsDb, /INSERT INTO missions[\s\S]{0,500}candidate_number/);
  assert.match(missionsDb, /candidateNumber:\s*r\.candidate_number/);
  assert.match(migration, /ALTER TABLE IF EXISTS users[\s\S]{0,100}candidate_number/i);
  assert.match(migration, /ALTER TABLE IF EXISTS missions[\s\S]{0,100}candidate_number/i);
});

test("XP proportions match the approved product rules", () => {
  const gamification = readMigration("20260827_add_gamification_events.sql");
  const electoral = readMigration("20260829_add_electoral_ranking.sql");
  const missionRoute = readFileSync(new URL("../app/api/missions/[id]/route.ts", import.meta.url), "utf8");

  assert.match(gamification, /'entrada_diaria'[^\n]+25/i);
  assert.match(gamification, /'missao_entregue'[^\n]+100/i);
  assert.match(electoral, /DEFAULT 50 CHECK \(pontos = 50\)/i);
  assert.doesNotMatch(electoral, /reputacao = reputacao \+ COALESCE\(\(SELECT xp FROM novo_evento\), 0\)/i);
  assert.match(missionRoute, /action === "deliver"[\s\S]{0,500}recordGamificationEvent\(session\.id, "mission_delivered"/i);
});

test("daily activity panel does not present video XP as a one-time daily reward", () => {
  const panel = readFileSync(new URL("../components/daily-challenges.tsx", import.meta.url), "utf8");

  assert.match(panel, /Cada vídeo entregue soma 100 XP/i);
  assert.doesNotMatch(panel, /XP extra por manter o ritmo\. Independe da missão/i);
});
