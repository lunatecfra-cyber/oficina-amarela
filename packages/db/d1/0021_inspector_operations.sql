DROP TRIGGER IF EXISTS apply_mission_inspection;
CREATE TRIGGER apply_mission_inspection
AFTER INSERT ON mission_inspections
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions p JOIN users u ON u.id=NEW.inspector_id
    WHERE p.id=NEW.mission_id AND p.status='em_revisao' AND p.delivery_version=NEW.version
      AND p.reserved_by_id<>NEW.inspector_id AND u.is_banned=0 AND (u.role='admin' OR (u.role='inspector' AND EXISTS(SELECT 1 FROM mission_deliveries d WHERE d.mission_id=p.id AND d.version=NEW.version AND d.assigned_inspector_id=u.id)))
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


CREATE TRIGGER IF NOT EXISTS audit_inspection_assignment AFTER UPDATE OF assigned_inspector_id ON mission_deliveries
WHEN NEW.assigned_inspector_id IS NOT OLD.assigned_inspector_id
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.assigned_inspector_id AND role IN ('admin','inspector') AND is_banned=0)
    OR NEW.editor_id=NEW.assigned_inspector_id THEN RAISE(ABORT,'inspection_unavailable') END;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.assigned_inspector_id,'inspection_assigned','mission',CAST(NEW.mission_id AS TEXT),json_object('version',NEW.version));
END;
