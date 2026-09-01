import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_COLUMNS, LEGACY_TABLES } from "../packages/db/src/migration/legacy-names.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function generateD1Sql() {
  const schema0001 = readFileSync(path.join(root, "packages/db/d1/0001_mission_slice.sql"), "utf8");
  const blocks = schema0001.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g);
  const d1Cols = new Map();
  for (const [, table, body] of blocks) {
    const cols = new Set();
    for (const line of body.split("\n")) {
      const match = line.match(
        /^\s*(\w+)\s+(TEXT|INT|INTEGER|BIGSERIAL|SERIAL|BOOLEAN|TIMESTAMPTZ|JSONB|NUMERIC|UUID|REAL|DATE)/,
      );
      if (match) cols.add(match[1]);
    }
    d1Cols.set(table, cols);
  }

  const lines = [
    "-- Migração 0003: renomeação do schema para inglês",
    "-- Fonte da verdade: packages/db/src/migration/legacy-names.ts",
    "-- Ver docs/SCHEMA_LANGUAGE.md",
    "",
    "-- 1. Derruba gatilhos legados antes de renomear tabelas e colunas",
    "DROP TRIGGER IF EXISTS apply_invitation_redemption;",
    "DROP TRIGGER IF EXISTS apply_mission_approval;",
    "DROP TRIGGER IF EXISTS claim_mission_on_pending_offer;",
    "DROP TRIGGER IF EXISTS reserve_mission_on_offer_accept;",
    "DROP TRIGGER IF EXISTS release_mission_on_offer_close;",
    "",
    "-- 2. Renomeia colunas (antes de renomear as tabelas)",
  ];

  for (const [legacyTable, cols] of Object.entries(LEGACY_COLUMNS)) {
    if (!d1Cols.has(legacyTable)) continue;
    const inD1 = d1Cols.get(legacyTable);
    lines.push(`-- Colunas de ${legacyTable}`);
    for (const [oldCol, newCol] of Object.entries(cols)) {
      if (oldCol !== newCol && inD1.has(oldCol)) {
        lines.push(`ALTER TABLE ${legacyTable} RENAME COLUMN ${oldCol} TO ${newCol};`);
      }
    }
  }

  lines.push("");
  lines.push("-- 3. Renomeia tabelas");
  for (const [oldTable, newTable] of Object.entries(LEGACY_TABLES)) {
    if (oldTable !== newTable && d1Cols.has(oldTable)) {
      lines.push(`ALTER TABLE ${oldTable} RENAME TO ${newTable};`);
    }
  }

  lines.push("");
  lines.push("-- 4. Recria gatilhos com os nomes novos");
  lines.push(
    `
CREATE TRIGGER IF NOT EXISTS apply_invitation_redemption
AFTER INSERT ON invitation_redemptions
BEGIN
  INSERT INTO users (
    handle, name, email, password_hash, google_id, role, avatar_url, referred_by_id
  ) VALUES (
    NEW.handle, NEW.name, NEW.email, NEW.password_hash, NEW.google_id, 'voz', NEW.avatar_url,
    (SELECT id FROM users WHERE referral_code = NEW.referral_code)
  );
  UPDATE spokesperson_invitations
  SET used_at = NEW.redeemed_at,
      used_by = (SELECT id FROM users WHERE lower(email) = lower(NEW.email))
  WHERE token_hash = NEW.token_hash AND used_at IS NULL AND revoked_at IS NULL;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'invitation_unavailable') END;
  INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
  SELECT created_by, 'convite_consumido', 'spokesperson_invitation', CAST(id AS TEXT),
         json_object('email', NEW.email, 'user_id', used_by), NEW.redeemed_at
  FROM spokesperson_invitations WHERE token_hash = NEW.token_hash;
END;
`.trim(),
  );

  lines.push("");
  lines.push(
    `
CREATE TRIGGER IF NOT EXISTS apply_mission_approval
AFTER INSERT ON mission_approvals
BEGIN
  UPDATE missions
  SET status = NEW.status_final, inspector_notes = NULL,
      revision_requested_by = NULL, is_scored = 1
  WHERE id = NEW.mission_id AND status = 'em_revisao' AND is_scored = 0;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_not_in_review') END;

  INSERT INTO reviews (mission_id, editor_id, rating, comment)
  SELECT NEW.mission_id, NEW.editor_id, NEW.rating, nullif(trim(NEW.comment), '')
  WHERE NEW.rating IS NOT NULL;

  UPDATE users
  SET delivered_count = delivered_count + 1, reputation = reputation + 25, streak = streak + 1
  WHERE id = NEW.editor_id;
  UPDATE users
  SET rating = (SELECT round(avg(rating), 2) FROM reviews WHERE editor_id = NEW.editor_id)
  WHERE id = NEW.editor_id;

  INSERT INTO ranking_approvals (
    mission_id, cycle_id, editor_id, approved_by, approved_at
  )
  SELECT NEW.mission_id, id, NEW.editor_id, NEW.approved_by, NEW.approved_at
  FROM ranking_cycles
  WHERE frozen_at IS NULL
    AND NEW.approved_at BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC LIMIT 1
  ON CONFLICT (mission_id) DO UPDATE SET
    cycle_id = excluded.cycle_id,
    editor_id = excluded.editor_id,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    voided_at = NULL,
    voided_by = NULL,
    void_reason = NULL
  WHERE ranking_approvals.voided_at IS NOT NULL;

  INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
  VALUES (
    NEW.approved_by, 'edicao_aprovada', 'mission', CAST(NEW.mission_id AS TEXT),
    json_object('editorId', NEW.editor_id), NEW.approved_at
  );

  INSERT OR IGNORE INTO referral_rewards (
    invitee_id, inviter_id, awarded_at
  )
  SELECT NEW.editor_id, referred_by_id, NEW.approved_at
  FROM users
  WHERE id = NEW.editor_id AND referred_by_id IS NOT NULL
    AND (SELECT count(*) FROM ranking_approvals
         WHERE editor_id = NEW.editor_id AND voided_at IS NULL) >= 2
    AND (SELECT count(*) FROM referral_rewards
         WHERE inviter_id = users.referred_by_id AND revoked_at IS NULL
           AND awarded_at >= substr(NEW.approved_at, 1, 7) || '-01T00:00:00.000Z') < 5;
  UPDATE users SET reputation = reputation + 100
  WHERE id = (SELECT inviter_id FROM referral_rewards
              WHERE invitee_id = NEW.editor_id)
    AND changes() = 1;
END;
`.trim(),
  );

  lines.push("");
  lines.push(
    `
CREATE TRIGGER IF NOT EXISTS claim_mission_on_pending_offer
AFTER INSERT ON offers
WHEN NEW.status = 'pendente'
BEGIN
  UPDATE missions SET status = 'oferecida'
  WHERE id = NEW.mission_id AND status IN ('disponivel', 'oferecida');
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_unavailable') END;
END;
`.trim(),
  );

  lines.push("");
  lines.push(
    `
CREATE TRIGGER IF NOT EXISTS reserve_mission_on_offer_accept
AFTER UPDATE OF status ON offers
WHEN OLD.status = 'pendente' AND NEW.status = 'aceita'
BEGIN
  UPDATE missions
  SET status = 'reservada', reserved_by_id = NEW.editor_id,
      reserved_at = NEW.answered_at
  WHERE id = NEW.mission_id AND status = 'oferecida';
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'offer_invalid') END;
END;
`.trim(),
  );

  lines.push("");
  lines.push(
    `
CREATE TRIGGER IF NOT EXISTS release_mission_on_offer_close
AFTER UPDATE OF status ON offers
WHEN OLD.status = 'pendente' AND NEW.status IN ('rejeitada', 'expirada')
BEGIN
  UPDATE missions SET status = 'disponivel'
  WHERE id = NEW.mission_id AND status = 'oferecida';
END;
`.trim(),
  );

  lines.push("");
  return lines.join("\n");
}

function generatePgSql() {
  const schemaSql = readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
  const pgTables = new Set(
    Array.from(schemaSql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi), (m) =>
      m[1].toLowerCase(),
    ),
  );

  const lines = [
    "-- Migração PostgreSQL: renomeação do schema para inglês",
    "-- Fonte da verdade: packages/db/src/migration/legacy-names.ts",
    "-- Ver docs/SCHEMA_LANGUAGE.md",
    "",
  ];

  for (const [legacyTable, cols] of Object.entries(LEGACY_COLUMNS)) {
    if (!pgTables.has(legacyTable.toLowerCase())) continue;
    lines.push(`-- Colunas de ${legacyTable}`);
    for (const [oldCol, newCol] of Object.entries(cols)) {
      if (oldCol !== newCol) {
        lines.push(`ALTER TABLE IF EXISTS ${legacyTable} RENAME COLUMN ${oldCol} TO ${newCol};`);
      }
    }
  }

  lines.push("");
  lines.push("-- Tabelas");
  for (const [oldTable, newTable] of Object.entries(LEGACY_TABLES)) {
    if (!pgTables.has(oldTable.toLowerCase())) continue;
    if (oldTable !== newTable) {
      lines.push(`ALTER TABLE IF EXISTS ${oldTable} RENAME TO ${newTable};`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

const d1Target = path.join(root, "packages/db/d1/0003_rename_to_english.sql");
const pgTarget = path.join(root, "supabase/migrations/20260901_rename_to_english.sql");

writeFileSync(d1Target, generateD1Sql(), "utf8");
console.log(`Gerado: ${d1Target}`);

writeFileSync(pgTarget, generatePgSql(), "utf8");
console.log(`Gerado: ${pgTarget}`);
