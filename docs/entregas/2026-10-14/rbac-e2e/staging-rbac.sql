-- Patch de staging: coluna role já suporta inspector; mantém os gatilhos de convites remotos.
DROP TRIGGER IF EXISTS apply_mission_inspection;
DROP TRIGGER IF EXISTS apply_report_decision;
DROP TRIGGER IF EXISTS apply_report_retention_release;
DROP TRIGGER IF EXISTS mission_message_guard;
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS role_capabilities(role TEXT NOT NULL CHECK(role IN ('inspector','admin')),capability TEXT NOT NULL,PRIMARY KEY(role,capability));
CREATE TABLE IF NOT EXISTS user_capability_revocations(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,capability TEXT NOT NULL,PRIMARY KEY(user_id,capability));
INSERT OR IGNORE INTO role_capabilities(role,capability) VALUES ('admin','mission.participate'),('admin','mission.read'),('admin','mission.chat'),('admin','mission.inspect'),('admin','mission.delete'),('admin','reports.read'),('admin','reports.forward'),('admin','reports.decide'),('admin','users.manage'),('admin','invitations.manage'),('admin','ranking.manage'),('admin','content.manage'),('admin','queue.manage'),('admin','broadcast.send'),('admin','security.read'),('admin','portfolio.moderate'),('inspector','mission.read'),('inspector','mission.chat'),('inspector','mission.inspect'),('inspector','reports.read'),('inspector','reports.forward');
CREATE VIEW IF NOT EXISTS authorized_user_capabilities AS
SELECT u.id AS user_id,c.capability FROM users u JOIN role_capabilities c ON c.role=u.role
WHERE u.is_banned=0 AND NOT EXISTS(SELECT 1 FROM user_capability_revocations x WHERE x.user_id=u.id AND x.capability=c.capability)
UNION ALL
SELECT u.id,'reports.releaseRetention' FROM users u JOIN admin_capabilities a ON a.user_id=u.id
WHERE u.role='admin' AND u.is_banned=0 AND a.capability='release_report_retention'
AND NOT EXISTS(SELECT 1 FROM user_capability_revocations x WHERE x.user_id=u.id AND x.capability='reports.releaseRetention');
CREATE TRIGGER IF NOT EXISTS revoke_changed_session AFTER UPDATE OF role,is_banned,sessions_valid_after ON users
WHEN NEW.role IS NOT OLD.role OR NEW.is_banned IS NOT OLD.is_banned OR NEW.sessions_valid_after IS NOT OLD.sessions_valid_after
BEGIN
  UPDATE users SET session_version=session_version+1 WHERE id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS apply_mission_inspection
AFTER INSERT ON mission_inspections
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM missions p JOIN users u ON u.id=NEW.inspector_id
    WHERE p.id=NEW.mission_id AND p.status='em_revisao' AND p.delivery_version=NEW.version
      AND p.spokesperson_id<>NEW.inspector_id AND p.reserved_by_id<>NEW.inspector_id
      AND NOT EXISTS(SELECT 1 FROM mission_deliveries d WHERE d.mission_id=p.id AND d.editor_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM mission_assignments a WHERE a.mission_id=p.id AND a.editor_id=u.id) AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='mission.inspect') AND u.is_banned=0
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
CREATE TRIGGER IF NOT EXISTS apply_report_decision AFTER INSERT ON report_decisions
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reports r JOIN users u ON u.id=NEW.actor_id
    WHERE r.id=NEW.report_id AND r.status='aberta' AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='reports.decide') AND u.is_banned=0 AND u.name=NEW.actor_name
      AND u.id<>r.reporter_id AND u.id<>coalesce(r.reported_id,-1)
      AND NOT EXISTS(SELECT 1 FROM missions p WHERE p.id=r.mission_id AND (p.spokesperson_id=u.id OR p.reserved_by_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=r.mission_id AND i.inspector_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM report_evidence e WHERE e.report_id=r.id AND e.kind IN ('mission','assignment','inspection')
        AND (json_extract(e.payload,'$.spokespersonId')=u.id OR json_extract(e.payload,'$.editorId')=u.id OR json_extract(e.payload,'$.inspectorId')=u.id)))
    THEN RAISE(ABORT,'report_decision_unavailable') END;
  UPDATE reports SET status=NEW.status,resolved_at=NEW.created_at WHERE id=NEW.report_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.actor_id,'denuncia_decidida','report',CAST(NEW.report_id AS TEXT),json_object('status',NEW.status,'reason',NEW.reason,'actorName',NEW.actor_name),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS apply_report_retention_release AFTER INSERT ON report_retention_releases
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reports r JOIN users u ON u.id=NEW.actor_id JOIN admin_capabilities a ON a.user_id=u.id
    WHERE r.id=NEW.report_id AND EXISTS(SELECT 1 FROM report_evidence_captures c WHERE c.report_id=r.id) AND r.status<>'aberta' AND u.role='admin' AND u.is_banned=0 AND u.name=NEW.actor_name
      AND a.capability='release_report_retention' AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='reports.releaseRetention') AND u.id<>r.reporter_id AND u.id<>coalesce(r.reported_id,-1)
      AND NOT EXISTS(SELECT 1 FROM missions p WHERE p.id=r.mission_id AND (p.spokesperson_id=u.id OR p.reserved_by_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=r.mission_id AND i.inspector_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM report_evidence e WHERE e.report_id=r.id AND e.kind IN ('mission','assignment','inspection')
        AND (json_extract(e.payload,'$.spokespersonId')=u.id OR json_extract(e.payload,'$.editorId')=u.id OR json_extract(e.payload,'$.inspectorId')=u.id)))
    THEN RAISE(ABORT,'report_release_unavailable') END;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.actor_id,'retencao_denuncia_liberada','report',CAST(NEW.report_id AS TEXT),json_object('reason',NEW.reason,'actorName',NEW.actor_name),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS mission_message_guard BEFORE INSERT ON messages
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM missions p JOIN users u ON u.id = NEW.author_id
    WHERE p.id = NEW.mission_id AND p.status <> 'cancelada' AND u.is_banned=0
    AND (EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='mission.chat') OR u.id = p.spokesperson_id OR u.id = p.reserved_by_id))
    THEN RAISE(ABORT,'mission_chat_forbidden') END;
  SELECT CASE WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mission_assignments a
    WHERE a.id = NEW.assignment_id AND a.mission_id = NEW.mission_id AND a.ended_at IS NULL)
    THEN RAISE(ABORT,'mission_chat_forbidden') END;
END;
CREATE TABLE IF NOT EXISTS report_forwardings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  actor_id INTEGER NOT NULL,
  actor_name TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(report_id,actor_id,reason)
);
CREATE TRIGGER IF NOT EXISTS audit_report_forwarding AFTER INSERT ON report_forwardings
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reports r JOIN authorized_user_capabilities c ON c.user_id=NEW.actor_id WHERE r.id=NEW.report_id AND r.status='aberta' AND c.capability='reports.forward') THEN RAISE(ABORT,'report_forward_unavailable') END;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.actor_id,'denuncia_encaminhada','report',CAST(NEW.report_id AS TEXT),json_object('reason',NEW.reason,'actorName',NEW.actor_name),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_forwarding BEFORE UPDATE ON report_forwardings
BEGIN
  SELECT RAISE(ABORT,'report_forwarding_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_report_forwarding BEFORE DELETE ON report_forwardings
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE report_id=OLD.report_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;

