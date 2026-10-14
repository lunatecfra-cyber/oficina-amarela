-- Troca apenas a coluna de papel; preserva users, ids e todas as FKs.
DROP TRIGGER IF EXISTS apply_invitation_redemption;
DROP TRIGGER IF EXISTS apply_mission_inspection;
DROP TRIGGER IF EXISTS apply_report_decision;
DROP TRIGGER IF EXISTS apply_report_retention_release;
DROP TRIGGER IF EXISTS apply_spokesperson_review;
DROP TRIGGER IF EXISTS mission_message_guard;
DROP TRIGGER IF EXISTS notify_mission_delivery;
DROP TRIGGER IF EXISTS preserve_spokesperson_review;
DROP TRIGGER IF EXISTS validate_editor_verification_insert;
DROP TRIGGER IF EXISTS validate_editor_verification_update;
DROP TRIGGER IF EXISTS validate_mission_interest;
DROP TRIGGER IF EXISTS validate_selected_offer;
DROP VIEW IF EXISTS published_portfolio_samples;
DROP VIEW IF EXISTS report_evidence_participants;
DROP TRIGGER IF EXISTS capture_report_evidence;
ALTER TABLE users ADD COLUMN rbac_role TEXT NOT NULL DEFAULT 'editor' CHECK(rbac_role IN ('voz','editor','inspector','admin'));
UPDATE users SET rbac_role=role;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN rbac_role TO role;
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
CREATE VIEW IF NOT EXISTS published_portfolio_samples AS
SELECT s.id,s.editor_id,s.asset_key,s.title,s.description,s.specialties,s.preview_seconds,s.media_kind
FROM portfolio_samples s
JOIN users u ON u.id=s.editor_id
JOIN missions m ON m.id=s.mission_id
JOIN users owner ON owner.id=m.spokesperson_id
JOIN mission_deliveries d ON d.mission_id=s.mission_id AND d.version=s.delivery_version
WHERE s.editor_visible=1 AND s.owner_authorized=1 AND s.authorized_by=m.spokesperson_id
  AND u.role='editor' AND u.is_banned=0 AND u.profile_completed=1 AND u.directory_visible=1
  AND owner.is_banned=0 AND m.status='finalizada' AND m.delivery_version=s.delivery_version
  AND m.reserved_by_id=s.editor_id AND d.editor_id=s.editor_id
  AND COALESCE(d.delivery_video_url,d.delivery_link)=s.asset_url;
CREATE VIEW IF NOT EXISTS report_evidence_participants AS
SELECT r.id AS report_id,'assignment' AS kind,CAST(a.id AS TEXT) AS source_id,json_object('id',a.id,'editorId',a.editor_id,'acceptedAt',a.accepted_at,'endedAt',a.ended_at,'endReason',a.end_reason) AS payload
FROM reports r JOIN mission_assignments a ON a.mission_id=r.mission_id
UNION ALL
SELECT r.id,'participant',CAST(u.id AS TEXT),json_object('id',u.id,'name',u.name,'handle',u.handle,'role',u.role)
FROM reports r JOIN missions p ON p.id=r.mission_id JOIN users u
ON u.id IN (r.reporter_id,r.reported_id,p.spokesperson_id,p.reserved_by_id)
  OR EXISTS(SELECT 1 FROM messages m WHERE m.mission_id=p.id AND m.author_id=u.id)
  OR EXISTS(SELECT 1 FROM mission_assignments a WHERE a.mission_id=p.id AND a.editor_id=u.id)
  OR EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=p.id AND i.inspector_id=u.id);
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
CREATE TRIGGER IF NOT EXISTS notify_mission_delivery AFTER UPDATE OF status ON missions
WHEN NEW.status='em_revisao' AND OLD.status IN ('reservada','reedicao')
BEGIN
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version)
  VALUES('mission:'||NEW.id||':submitted:'||NEW.delivery_version,NEW.id,NEW.spokesperson_id,'submitted',NEW.delivery_version);
  INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version)
  SELECT 'mission:'||NEW.id||':inspection_pending:'||NEW.delivery_version||':'||u.id,NEW.id,u.id,'inspection_pending',NEW.delivery_version
  FROM users u WHERE u.role='admin' AND u.is_banned=0 AND u.id<>NEW.reserved_by_id AND NEW.inspection_required=1;
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
CREATE TRIGGER IF NOT EXISTS validate_editor_verification_insert BEFORE INSERT ON editor_verifications
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.admin_id AND role='admin' AND is_banned=0)
    OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.editor_id AND role='editor' AND is_banned=0 AND profile_completed=1)
    THEN RAISE(ABORT,'editor_verification_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS validate_editor_verification_update BEFORE UPDATE ON editor_verifications
BEGIN
  SELECT CASE WHEN NEW.editor_id IS NOT OLD.editor_id OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.admin_id AND role='admin' AND is_banned=0)
    THEN RAISE(ABORT,'editor_verification_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS validate_mission_interest BEFORE INSERT ON mission_interests
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
CREATE TRIGGER IF NOT EXISTS validate_selected_offer BEFORE INSERT ON offers
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

CREATE TRIGGER IF NOT EXISTS capture_report_evidence AFTER INSERT ON reports
BEGIN
  INSERT INTO report_evidence_captures(report_id,origin) VALUES(NEW.id,'opening');
  INSERT INTO report_evidence(report_id,kind,source_id,payload) SELECT report_id,kind,source_id,payload FROM report_evidence_source WHERE report_id=NEW.id;
  INSERT INTO report_evidence(report_id,kind,source_id,payload) SELECT report_id,kind,source_id,payload FROM report_evidence_participants WHERE report_id=NEW.id;
END;
