-- Preserve legacy routing; new publications explicitly use spokesperson selection.
ALTER TABLE missions ADD COLUMN manual_selection INTEGER NOT NULL DEFAULT 0;
ALTER TABLE offers ADD COLUMN selected_by_id INTEGER REFERENCES users(id);
ALTER TABLE offers ADD COLUMN selection_kind TEXT CHECK(selection_kind IN ('interest','direct'));
CREATE TABLE mission_interests (
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(mission_id,editor_id)
);
CREATE TRIGGER validate_mission_interest BEFORE INSERT ON mission_interests
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions m JOIN users u ON u.id=NEW.editor_id
    WHERE m.id=NEW.mission_id AND m.manual_selection=1 AND m.status='disponivel'
      AND u.role='editor' AND u.is_banned=0 AND u.profile_completed=1
      AND (json_extract(u.availability, '$[' || CASE WHEN CAST(strftime('%H','now','-3 hours') AS INTEGER) BETWEEN 6 AND 11 THEN 0 WHEN CAST(strftime('%H','now','-3 hours') AS INTEGER) BETWEEN 12 AND 17 THEN 1 ELSE 2 END || '][' || ((CAST(strftime('%w','now','-3 hours') AS INTEGER)+6)%7) || ']') IS NOT 0)
      AND (u.reservations_locked_until IS NULL OR u.reservations_locked_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND NOT EXISTS(SELECT 1 FROM missions a WHERE a.reserved_by_id=u.id AND a.status IN ('reservada','em_revisao','reedicao'))
      AND NOT EXISTS(SELECT 1 FROM offers o WHERE o.editor_id=u.id AND o.status='pendente')
  ) THEN RAISE(ABORT,'editor_ineligible') END;
END;
CREATE TRIGGER audit_mission_interest AFTER INSERT ON mission_interests
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.editor_id,'mission_interest','mission',CAST(NEW.mission_id AS TEXT),json_object('editorId',NEW.editor_id));
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event)
  SELECT 'interest:'||NEW.mission_id||':'||NEW.editor_id,NEW.mission_id,spokesperson_id,'interest' FROM missions WHERE id=NEW.mission_id;
END;
CREATE TRIGGER validate_selected_offer BEFORE INSERT ON offers
WHEN (SELECT manual_selection FROM missions WHERE id=NEW.mission_id)=1
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions m JOIN users v ON v.id=NEW.selected_by_id JOIN users u ON u.id=NEW.editor_id
    WHERE m.id=NEW.mission_id AND m.status='disponivel' AND m.spokesperson_id=v.id
      AND v.role IN ('voz','spokesperson') AND v.is_banned=0
      AND NEW.selection_kind IN ('interest','direct')
      AND (NEW.selection_kind='direct' OR EXISTS(SELECT 1 FROM mission_interests i WHERE i.mission_id=m.id AND i.editor_id=u.id))
      AND u.role='editor' AND u.is_banned=0 AND u.profile_completed=1
      AND (json_extract(u.availability, '$[' || CASE WHEN CAST(strftime('%H','now','-3 hours') AS INTEGER) BETWEEN 6 AND 11 THEN 0 WHEN CAST(strftime('%H','now','-3 hours') AS INTEGER) BETWEEN 12 AND 17 THEN 1 ELSE 2 END || '][' || ((CAST(strftime('%w','now','-3 hours') AS INTEGER)+6)%7) || ']') IS NOT 0)
      AND (u.reservations_locked_until IS NULL OR u.reservations_locked_until<=NEW.offered_at)
      AND NOT EXISTS(SELECT 1 FROM missions a WHERE a.reserved_by_id=u.id AND a.status IN ('reservada','em_revisao','reedicao'))
  ) THEN RAISE(ABORT,'selection_invalid') END;
END;
CREATE TRIGGER audit_selected_offer AFTER INSERT ON offers WHEN NEW.selected_by_id IS NOT NULL
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.selected_by_id,'mission_editor_selected','mission',CAST(NEW.mission_id AS TEXT),json_object('editorId',NEW.editor_id,'offerId',NEW.id,'kind',NEW.selection_kind));
END;
CREATE TRIGGER prevent_board_claim BEFORE UPDATE OF status,reserved_by_id ON missions
WHEN OLD.manual_selection=1 AND NEW.status='reservada' AND OLD.status<>'reservada'
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM offers WHERE mission_id=NEW.id AND editor_id=NEW.reserved_by_id AND status='aceita')
    THEN RAISE(ABORT,'offer_invalid') END;
END;
