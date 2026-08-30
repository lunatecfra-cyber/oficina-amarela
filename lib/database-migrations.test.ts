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
