-- Mantém as notas antigas sem inventar autor ou origem; reputação pública exige voto comprovado.
ALTER TABLE reviews ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy' CHECK(source IN ('legacy','spokesperson'));
ALTER TABLE reviews ADD COLUMN reviewer_id INTEGER REFERENCES users(id);
ALTER TABLE reviews ADD COLUMN delivery_version INTEGER;
ALTER TABLE reviews ADD COLUMN voided_at TEXT;
ALTER TABLE reviews ADD COLUMN voided_by INTEGER REFERENCES users(id);
ALTER TABLE reviews ADD COLUMN void_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS one_spokesperson_review_per_mission ON reviews(mission_id) WHERE source='spokesperson';
UPDATE users SET rating=(SELECT round(avg(rating),2) FROM reviews WHERE editor_id=users.id AND source='spokesperson' AND voided_at IS NULL);

-- Fiscalização continua pontuando entregas/XP/ranking, sem criar estrelas públicas.
DROP TRIGGER IF EXISTS apply_mission_approval;
CREATE TRIGGER apply_mission_approval
AFTER INSERT ON mission_approvals
BEGIN
  UPDATE missions
  SET status = NEW.status_final, inspector_notes = NULL,
      revision_requested_by = NULL, is_scored = 1
  WHERE id = NEW.mission_id AND status = 'em_revisao' AND is_scored = 0;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_not_in_review') END;

  UPDATE users
  SET delivered_count = delivered_count + 1, reputation = reputation + 25, streak = streak + 1
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

CREATE TRIGGER IF NOT EXISTS apply_spokesperson_review
AFTER INSERT ON reviews WHEN NEW.source='spokesperson'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions p JOIN users u ON u.id=NEW.reviewer_id
    WHERE p.id=NEW.mission_id AND p.spokesperson_id=NEW.reviewer_id
      AND u.role='voz' AND u.is_banned=0 AND p.status='finalizada' AND p.is_scored=1
      AND p.reserved_by_id=NEW.editor_id AND p.delivery_version=NEW.delivery_version AND NEW.delivery_version>0
      AND typeof(NEW.rating)='integer' AND NEW.rating BETWEEN 1 AND 5
      AND NEW.voided_at IS NULL AND NEW.voided_by IS NULL AND NEW.void_reason IS NULL
      AND (p.inspection_required=0 OR EXISTS (SELECT 1 FROM mission_inspections i
        WHERE i.mission_id=p.id AND i.version=p.delivery_version AND i.decision='approved' AND i.inspector_id<>p.reserved_by_id))
  ) THEN RAISE(ABORT,'review_unavailable') END;
  UPDATE users SET rating=(SELECT round(avg(rating),2) FROM reviews
    WHERE editor_id=NEW.editor_id AND source='spokesperson' AND voided_at IS NULL) WHERE id=NEW.editor_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.reviewer_id,'avaliacao_porta_voz','mission',CAST(NEW.mission_id AS TEXT),
    json_object('version',NEW.delivery_version,'rating',NEW.rating),NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS preserve_spokesperson_review
BEFORE UPDATE ON reviews WHEN OLD.source='spokesperson'
BEGIN
  SELECT CASE WHEN NEW.rating IS NOT OLD.rating OR NEW.comment IS NOT OLD.comment
    OR NEW.source IS NOT OLD.source OR NEW.reviewer_id IS NOT OLD.reviewer_id
    OR NEW.delivery_version IS NOT OLD.delivery_version OR NEW.editor_id IS NOT OLD.editor_id
    OR NEW.mission_id IS NOT OLD.mission_id OR NEW.created_at IS NOT OLD.created_at
    OR OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL OR trim(coalesce(NEW.void_reason,''))=''
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.voided_by AND role='admin' AND is_banned=0)
    THEN RAISE(ABORT,'review_immutable') END;
END;

CREATE TRIGGER IF NOT EXISTS moderate_spokesperson_review
AFTER UPDATE OF voided_at ON reviews WHEN OLD.source='spokesperson' AND OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL
BEGIN
  UPDATE users SET rating=(SELECT round(avg(rating),2) FROM reviews
    WHERE editor_id=NEW.editor_id AND source='spokesperson' AND voided_at IS NULL) WHERE id=NEW.editor_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.voided_by,'avaliacao_anulada','mission',CAST(NEW.mission_id AS TEXT),
    json_object('rating',NEW.rating,'reason',NEW.void_reason),NEW.voided_at);
END;
