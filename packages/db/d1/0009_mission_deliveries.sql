ALTER TABLE missions ADD COLUMN delivery_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions ADD COLUMN inspection_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE missions ADD COLUMN inspection_reason TEXT NOT NULL DEFAULT 'parameters_pending';
CREATE TABLE IF NOT EXISTS mission_deliveries (
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  editor_id INTEGER NOT NULL REFERENCES users(id),
  delivery_link TEXT,
  delivery_video_url TEXT,
  submitted_at TEXT,
  inspection_required INTEGER NOT NULL DEFAULT 1,
  inspection_reason TEXT NOT NULL DEFAULT 'parameters_pending',
  PRIMARY KEY (mission_id, version)
);
-- Só a versão atual é conhecida nas missões anteriores a este histórico.
INSERT INTO mission_deliveries (mission_id,version,editor_id,delivery_link,delivery_video_url,submitted_at)
SELECT id,1,reserved_by_id,delivery_link,delivery_video_url,first_delivered_at FROM missions
WHERE reserved_by_id IS NOT NULL AND (delivery_link IS NOT NULL OR delivery_video_url IS NOT NULL)
ON CONFLICT (mission_id,version) DO NOTHING;
UPDATE missions SET delivery_version = 1 WHERE delivery_version = 0 AND id IN (SELECT mission_id FROM mission_deliveries);

CREATE TRIGGER IF NOT EXISTS record_mission_delivery
AFTER UPDATE OF status ON missions
WHEN NEW.status = 'em_revisao' AND OLD.status IN ('reservada','reedicao')
BEGIN
  INSERT INTO mission_deliveries (mission_id,version,editor_id,delivery_link,delivery_video_url,submitted_at,inspection_required,inspection_reason)
  VALUES (NEW.id,NEW.delivery_version,NEW.reserved_by_id,NEW.delivery_link,NEW.delivery_video_url,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.inspection_required,NEW.inspection_reason);
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES (NEW.reserved_by_id,'entrega_submetida','mission',CAST(NEW.id AS TEXT),json_object('version',NEW.delivery_version),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER IF NOT EXISTS record_mission_revision
AFTER UPDATE OF status ON missions
WHEN NEW.status = 'reedicao' AND OLD.status IN ('em_revisao','aprovada')
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES (NULL,'ajuste_solicitado','mission',CAST(NEW.id AS TEXT),json_object('version',NEW.delivery_version,'by',NEW.revision_requested_by,'notes',NEW.inspector_notes),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
