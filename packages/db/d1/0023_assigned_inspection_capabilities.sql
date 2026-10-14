-- Reconcile assigned inspections with live capability revocation and party independence.
DROP TRIGGER IF EXISTS audit_inspection_assignment;
DROP TRIGGER IF EXISTS apply_mission_inspection;
CREATE TRIGGER apply_mission_inspection
AFTER INSERT ON mission_inspections
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions p JOIN users u ON u.id=NEW.inspector_id
    WHERE p.id=NEW.mission_id AND p.status='em_revisao' AND p.delivery_version=NEW.version
      AND p.spokesperson_id<>NEW.inspector_id AND p.reserved_by_id<>NEW.inspector_id
      AND NOT EXISTS(SELECT 1 FROM mission_deliveries past WHERE past.mission_id=p.id AND past.editor_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM mission_assignments past WHERE past.mission_id=p.id AND past.editor_id=u.id)
      AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='mission.inspect')
      AND (u.role='admin' OR NEW.rating IS NULL) AND u.is_banned=0 AND (u.role='admin' OR (u.role='inspector' AND EXISTS(SELECT 1 FROM mission_deliveries d WHERE d.mission_id=p.id AND d.version=NEW.version AND (SELECT inspector_id FROM mission_inspection_assignments WHERE mission_id=d.mission_id AND version=d.version)=u.id)))
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


CREATE TRIGGER IF NOT EXISTS audit_inspection_assignment AFTER INSERT ON mission_inspection_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users u JOIN mission_deliveries d ON d.mission_id=NEW.mission_id AND d.version=NEW.version
    JOIN missions m ON m.id=d.mission_id WHERE u.id=NEW.inspector_id AND u.role IN ('admin','inspector') AND u.is_banned=0
    AND d.editor_id<>u.id AND m.spokesperson_id<>u.id
    AND NOT EXISTS(SELECT 1 FROM mission_assignments past WHERE past.mission_id=m.id AND past.editor_id=u.id)
    AND NOT EXISTS(SELECT 1 FROM mission_deliveries past WHERE past.mission_id=m.id AND past.editor_id=u.id)
    AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='mission.inspect')
    AND m.delivery_version=d.version AND m.status='em_revisao') THEN RAISE(ABORT,'inspection_unavailable') END;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.inspector_id,'inspection_assigned','mission',CAST(NEW.mission_id AS TEXT),json_object('version',NEW.version));
END;
