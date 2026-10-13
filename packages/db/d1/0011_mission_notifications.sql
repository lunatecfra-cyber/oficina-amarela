ALTER TABLE email_queue ADD COLUMN delivery_mode TEXT;
CREATE TABLE mission_notifications (
  key TEXT PRIMARY KEY,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX mission_notification_recipient ON mission_notifications(recipient_id,created_at);

CREATE TRIGGER notify_mission_offer AFTER INSERT ON offers WHEN NEW.status='pendente'
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,created_at)
  VALUES('mission:'||NEW.mission_id||':offer:'||NEW.id,NEW.mission_id,NEW.editor_id,'offer',NEW.offered_at);
END;
CREATE TRIGGER notify_mission_acceptance AFTER UPDATE OF status ON offers
WHEN OLD.status='pendente' AND NEW.status='aceita'
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,created_at)
  SELECT 'mission:'||NEW.mission_id||':accepted:'||NEW.id,NEW.mission_id,spokesperson_id,'accepted',NEW.answered_at FROM missions WHERE id=NEW.mission_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.editor_id,'missao_aceita','mission',CAST(NEW.mission_id AS TEXT),json_object('offerId',NEW.id),NEW.answered_at);
END;
CREATE TRIGGER stop_expired_offer_email AFTER UPDATE OF status ON offers
WHEN OLD.status='pendente' AND NEW.status<>'pendente'
BEGIN
  UPDATE email_queue SET delivery_mode='cancelled',error='offer_unavailable'
  WHERE key='mission:'||NEW.mission_id||':offer:'||NEW.id AND sent_at IS NULL;
END;
CREATE TRIGGER notify_mission_delivery AFTER UPDATE OF status ON missions
WHEN NEW.status='em_revisao' AND OLD.status IN ('reservada','reedicao')
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version)
  VALUES('mission:'||NEW.id||':submitted:'||NEW.delivery_version,NEW.id,NEW.spokesperson_id,'submitted',NEW.delivery_version);
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version)
  SELECT 'mission:'||NEW.id||':inspection_pending:'||NEW.delivery_version||':'||u.id,NEW.id,u.id,'inspection_pending',NEW.delivery_version
  FROM users u WHERE u.role='admin' AND u.is_banned=0 AND u.id<>NEW.reserved_by_id AND NEW.inspection_required=1;
END;
CREATE TRIGGER notify_mission_revision AFTER UPDATE OF status ON missions
WHEN NEW.status='reedicao' AND OLD.status IN ('em_revisao','aprovada')
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version,notes)
  VALUES('mission:'||NEW.id||':revision:'||NEW.delivery_version,NEW.id,NEW.reserved_by_id,'revision',NEW.delivery_version,NEW.inspector_notes);
END;
CREATE TRIGGER notify_mission_inspection AFTER INSERT ON mission_inspections
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version,notes)
  SELECT 'mission:'||NEW.mission_id||':inspection:'||NEW.version,NEW.mission_id,p.spokesperson_id,
    CASE NEW.decision WHEN 'approved' THEN 'inspection_approved' ELSE 'inspection_rejected' END,NEW.version,NEW.comment
  FROM missions p WHERE p.id=NEW.mission_id;
END;
CREATE TRIGGER notify_mission_completion AFTER UPDATE OF status ON missions
WHEN NEW.status='finalizada' AND OLD.status<>'finalizada'
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version)
  VALUES('mission:'||NEW.id||':approved:'||NEW.delivery_version,NEW.id,NEW.reserved_by_id,'approved',NEW.delivery_version);
END;
-- O evento de proprietário já grava seu e-mail atomicamente em 0006.
CREATE TRIGGER notify_mission_owner_action AFTER INSERT ON mission_owner_events
WHEN NEW.previous_editor_id IS NOT NULL
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,notes,created_at)
  VALUES('mission-owner:'||NEW.request_id,NEW.mission_id,NEW.previous_editor_id,NEW.action,NEW.reason,NEW.created_at);
END;
CREATE TRIGGER notify_mission_return AFTER UPDATE OF status,reserved_by_id ON missions
WHEN OLD.reserved_by_id IS NOT NULL AND NEW.reserved_by_id IS NULL AND NEW.status='disponivel'
BEGIN
  INSERT OR IGNORE INTO mission_notifications(key,mission_id,recipient_id,event)
  VALUES('mission:'||NEW.id||':returned:'||OLD.lifecycle_version,NEW.id,NEW.spokesperson_id,'returned');
END;
