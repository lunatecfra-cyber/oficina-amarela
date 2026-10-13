CREATE TABLE IF NOT EXISTS mission_inspections (
  mission_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  inspector_id INTEGER NOT NULL REFERENCES users(id),
  inspected_at TEXT NOT NULL,
  rating INTEGER,
  comment TEXT,
  decision TEXT NOT NULL DEFAULT 'approved' CHECK(decision IN ('approved','revision_requested')),
  scored INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(mission_id,version),
  FOREIGN KEY(mission_id,version) REFERENCES mission_deliveries(mission_id,version) ON DELETE CASCADE
);
-- Preserva aprovações históricas comprovadas pelo evento existente.
INSERT INTO mission_inspections(mission_id,version,inspector_id,inspected_at,rating,comment,scored)
SELECT a.mission_id,p.delivery_version,a.approved_by,a.approved_at,a.rating,a.comment,1
FROM mission_approvals a JOIN missions p ON p.id=a.mission_id JOIN users u ON u.id=a.approved_by
WHERE u.role='admin' AND a.approved_by<>p.reserved_by_id AND p.delivery_version>0 AND p.status IN ('aprovada','finalizada')
ON CONFLICT(mission_id,version) DO NOTHING;

CREATE TRIGGER IF NOT EXISTS apply_mission_inspection
AFTER INSERT ON mission_inspections
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions p JOIN users u ON u.id=NEW.inspector_id
    WHERE p.id=NEW.mission_id AND p.status='em_revisao' AND p.delivery_version=NEW.version
      AND p.reserved_by_id<>NEW.inspector_id AND u.role='admin' AND u.is_banned=0
  ) THEN RAISE(ABORT,'inspection_unavailable') END;
  UPDATE mission_inspections SET scored=(SELECT CASE WHEN is_scored=0 AND NEW.decision='approved' THEN 1 ELSE 0 END FROM missions WHERE id=NEW.mission_id)
  WHERE mission_id=NEW.mission_id AND version=NEW.version;
  INSERT INTO mission_approvals(mission_id,editor_id,approved_by,status_final,rating,comment,approved_at)
  SELECT id,reserved_by_id,NEW.inspector_id,'aprovada',NEW.rating,NEW.comment,NEW.inspected_at FROM missions
  WHERE id=NEW.mission_id AND is_scored=0 AND NEW.decision='approved'
  ON CONFLICT(mission_id) DO NOTHING;
  UPDATE missions SET status=CASE WHEN NEW.decision='approved' THEN 'aprovada' ELSE 'reedicao' END,
    inspector_notes=CASE WHEN NEW.decision='approved' THEN NULL ELSE NEW.comment END,
    revision_requested_by=CASE WHEN NEW.decision='approved' THEN NULL ELSE 'inspetor' END
  WHERE id=NEW.mission_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.inspector_id,CASE WHEN NEW.decision='approved' THEN 'inspecao_aprovada' ELSE 'inspecao_reprovada' END,'mission',CAST(NEW.mission_id AS TEXT),json_object('version',NEW.version),NEW.inspected_at);
END;

CREATE TRIGGER IF NOT EXISTS require_mission_inspection
BEFORE UPDATE OF status ON missions
WHEN NEW.status IN ('aprovada','finalizada') AND NEW.status<>OLD.status AND NEW.inspection_required=1
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM mission_inspections i
    WHERE i.mission_id=NEW.id AND i.version=NEW.delivery_version AND i.inspector_id<>NEW.reserved_by_id AND i.decision='approved')
    THEN RAISE(ABORT,'inspection_required') END;
END;

CREATE TRIGGER IF NOT EXISTS record_mission_completion
AFTER UPDATE OF status ON missions WHEN NEW.status='finalizada' AND OLD.status<>'finalizada'
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.spokesperson_id,'missao_finalizada','mission',CAST(NEW.id AS TEXT),json_object('version',NEW.delivery_version),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
