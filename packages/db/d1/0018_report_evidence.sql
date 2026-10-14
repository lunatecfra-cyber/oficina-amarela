-- Decisão e liberação são eventos distintos: encerrar não descarta evidência.
CREATE TABLE IF NOT EXISTS admin_capabilities (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK(capability='release_report_retention'),
  PRIMARY KEY(user_id,capability)
);
CREATE TABLE IF NOT EXISTS report_decisions (
  report_id INTEGER PRIMARY KEY,
  actor_id INTEGER NOT NULL,
  actor_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('resolvida','ignorada')),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS report_retention_releases (
  report_id INTEGER PRIMARY KEY,
  actor_id INTEGER NOT NULL,
  actor_name TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS report_evidence_captures (
  report_id INTEGER PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  origin TEXT NOT NULL CHECK(origin IN ('opening','migration')),
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS report_evidence (
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(report_id,kind,source_id)
);
CREATE VIEW IF NOT EXISTS retained_report_missions AS
SELECT r.id AS report_id,r.mission_id FROM reports r JOIN report_evidence_captures c ON c.report_id=r.id
WHERE NOT EXISTS(SELECT 1 FROM report_retention_releases x WHERE x.report_id=r.id);

-- Uma linha por fonte evita juntar todo o chat em um único valor D1.
CREATE VIEW IF NOT EXISTS report_evidence_source AS
SELECT r.id AS report_id,'mission' AS kind,CAST(p.id AS TEXT) AS source_id,
  json_object('id',p.id,'title',p.title,'format',p.format,'status',p.status,'spokespersonId',p.spokesperson_id,'editorId',p.reserved_by_id,
    'tone',p.brief_tone,'color',p.brief_color,'font',p.brief_font,'references',p.brief_refs,'extras',p.extras,'motivation',p.motivation,
    'deadline',p.desired_deadline,'rawMedia',p.raw_media,'rawVideoUrls',p.raw_video_urls,'driveLink',p.drive_link,'youtubeLink',p.youtube_link,
    'deliveryVersion',p.delivery_version,'inspectionRequired',p.inspection_required,'inspectionReason',p.inspection_reason,
    'reporterId',r.reporter_id,'reportedId',r.reported_id,'reportBody',r.body,'reportCreatedAt',r.created_at) AS payload
FROM reports r JOIN missions p ON p.id=r.mission_id
UNION ALL
SELECT r.id,'message',CAST(m.id AS TEXT),json_object('id',m.id,'authorId',m.author_id,'text',m.body,'createdAt',m.created_at,'assignmentId',m.assignment_id)
FROM reports r JOIN messages m ON m.mission_id=r.mission_id
UNION ALL
SELECT r.id,'delivery',CAST(d.version AS TEXT),json_object('version',d.version,'editorId',d.editor_id,'link',d.delivery_link,'videoUrl',d.delivery_video_url,
  'submittedAt',d.submitted_at,'inspectionRequired',d.inspection_required,'inspectionReason',d.inspection_reason)
FROM reports r JOIN mission_deliveries d ON d.mission_id=r.mission_id
UNION ALL
SELECT r.id,'inspection',CAST(i.version AS TEXT),json_object('version',i.version,'inspectorId',i.inspector_id,'decision',i.decision,'comment',i.comment,'rating',i.rating,'inspectedAt',i.inspected_at)
FROM reports r JOIN mission_inspections i ON i.mission_id=r.mission_id;

-- shortcut: D1 limita SELECT composto a cinco termos; dividir se surgirem novas fontes.
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

CREATE TRIGGER IF NOT EXISTS capture_report_evidence AFTER INSERT ON reports
BEGIN
  INSERT INTO report_evidence_captures(report_id,origin) VALUES(NEW.id,'opening');
  INSERT INTO report_evidence(report_id,kind,source_id,payload) SELECT report_id,kind,source_id,payload FROM report_evidence_source WHERE report_id=NEW.id;
  INSERT INTO report_evidence(report_id,kind,source_id,payload) SELECT report_id,kind,source_id,payload FROM report_evidence_participants WHERE report_id=NEW.id;
END;

-- Legado aberto: captura o estado disponível agora, não inventa estado original.
INSERT OR IGNORE INTO report_evidence(report_id,kind,source_id,payload)
SELECT s.report_id,s.kind,s.source_id,s.payload FROM report_evidence_source s JOIN reports r ON r.id=s.report_id
WHERE r.status='aberta' AND NOT EXISTS(SELECT 1 FROM report_evidence_captures c WHERE c.report_id=r.id);
INSERT OR IGNORE INTO report_evidence(report_id,kind,source_id,payload)
SELECT s.report_id,s.kind,s.source_id,s.payload FROM report_evidence_participants s JOIN reports r ON r.id=s.report_id
WHERE r.status='aberta' AND NOT EXISTS(SELECT 1 FROM report_evidence_captures c WHERE c.report_id=r.id);
INSERT OR IGNORE INTO report_evidence_captures(report_id,origin) SELECT id,'migration' FROM reports WHERE status='aberta';

CREATE TRIGGER IF NOT EXISTS apply_report_decision AFTER INSERT ON report_decisions
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM reports r JOIN users u ON u.id=NEW.actor_id
    WHERE r.id=NEW.report_id AND r.status='aberta' AND u.role='admin' AND u.is_banned=0 AND u.name=NEW.actor_name
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
      AND a.capability='release_report_retention' AND u.id<>r.reporter_id AND u.id<>coalesce(r.reported_id,-1)
      AND NOT EXISTS(SELECT 1 FROM missions p WHERE p.id=r.mission_id AND (p.spokesperson_id=u.id OR p.reserved_by_id=u.id))
      AND NOT EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=r.mission_id AND i.inspector_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM report_evidence e WHERE e.report_id=r.id AND e.kind IN ('mission','assignment','inspection')
        AND (json_extract(e.payload,'$.spokespersonId')=u.id OR json_extract(e.payload,'$.editorId')=u.id OR json_extract(e.payload,'$.inspectorId')=u.id)))
    THEN RAISE(ABORT,'report_release_unavailable') END;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.actor_id,'retencao_denuncia_liberada','report',CAST(NEW.report_id AS TEXT),json_object('reason',NEW.reason,'actorName',NEW.actor_name),NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_decision BEFORE UPDATE ON report_decisions BEGIN
  SELECT RAISE(ABORT,'report_decision_immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_decision_delete BEFORE DELETE ON report_decisions BEGIN
  SELECT RAISE(ABORT,'report_decision_immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_release BEFORE UPDATE ON report_retention_releases BEGIN
  SELECT RAISE(ABORT,'report_release_immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_release_delete BEFORE DELETE ON report_retention_releases BEGIN
  SELECT RAISE(ABORT,'report_release_immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_evidence BEFORE UPDATE ON report_evidence BEGIN
  SELECT RAISE(ABORT,'report_evidence_immutable');
END;
CREATE TRIGGER IF NOT EXISTS preserve_report_capture BEFORE UPDATE ON report_evidence_captures BEGIN
  SELECT RAISE(ABORT,'report_evidence_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_report_capture BEFORE DELETE ON report_evidence_captures
WHEN NOT EXISTS(SELECT 1 FROM report_retention_releases WHERE report_id=OLD.report_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS retain_report_evidence BEFORE DELETE ON report_evidence
WHEN NOT EXISTS(SELECT 1 FROM report_retention_releases WHERE report_id=OLD.report_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS retain_report BEFORE DELETE ON reports
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE report_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS preserve_report BEFORE UPDATE ON reports
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.mission_id IS NOT OLD.mission_id OR NEW.reporter_id IS NOT OLD.reporter_id
    OR NEW.reported_id IS NOT OLD.reported_id OR NEW.body IS NOT OLD.body OR NEW.created_at IS NOT OLD.created_at
    OR NOT EXISTS(SELECT 1 FROM report_decisions d WHERE d.report_id=OLD.id AND d.status=NEW.status AND d.created_at=NEW.resolved_at)
    THEN RAISE(ABORT,'report_immutable') END;
END;
CREATE TRIGGER IF NOT EXISTS retain_mission BEFORE DELETE ON missions
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE mission_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS retain_report_user BEFORE DELETE ON users
WHEN EXISTS(SELECT 1 FROM report_evidence e JOIN retained_report_missions r ON r.report_id=e.report_id
  WHERE e.kind='participant' AND e.source_id=CAST(OLD.id AS TEXT))
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS preserve_delivery BEFORE UPDATE ON mission_deliveries BEGIN
  SELECT RAISE(ABORT,'delivery_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_delivery BEFORE DELETE ON mission_deliveries
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE mission_id=OLD.mission_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS preserve_inspection BEFORE UPDATE ON mission_inspections
WHEN NEW.mission_id IS NOT OLD.mission_id OR NEW.version IS NOT OLD.version OR NEW.inspector_id IS NOT OLD.inspector_id
  OR NEW.inspected_at IS NOT OLD.inspected_at OR NEW.rating IS NOT OLD.rating OR NEW.comment IS NOT OLD.comment OR NEW.decision IS NOT OLD.decision
BEGIN
  SELECT RAISE(ABORT,'inspection_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_inspection BEFORE DELETE ON mission_inspections
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE mission_id=OLD.mission_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS retain_message_update BEFORE UPDATE ON messages
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE mission_id=OLD.mission_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS retain_message_delete BEFORE DELETE ON messages
WHEN EXISTS(SELECT 1 FROM retained_report_missions WHERE mission_id=OLD.mission_id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
