-- Disputes: their own domain, separate from reports and from regular revision requests.
-- No financial or reputation consequence is applied here: the decision records the
-- outcome, rationale and recommendation; acting on it is a future step.

-- Who may mediate is an explicit grant (role inspector or admin), like releasing report
-- retention; the role alone is not enough.
CREATE TABLE IF NOT EXISTS dispute_mediators (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY,
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  opened_by_id INTEGER NOT NULL REFERENCES users(id),
  counterpart_id INTEGER NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK(category IN ('quality','deadline','scope','conduct','other')),
  claim TEXT NOT NULL CHECK(length(trim(claim)) BETWEEN 10 AND 2000),
  mission_status TEXT NOT NULL,
  delivery_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','decided','appealed','closed')),
  mediator_id INTEGER REFERENCES users(id),
  appeal_reviewer_id INTEGER REFERENCES users(id),
  closed_by_id INTEGER REFERENCES users(id),
  close_reason TEXT CHECK(close_reason IS NULL OR length(trim(close_reason)) BETWEEN 10 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(opened_by_id <> counterpart_id)
);
-- One live dispute per mission; closing it allows a new one.
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_active ON disputes(mission_id) WHERE status <> 'closed';
CREATE INDEX IF NOT EXISTS disputes_status ON disputes(status, id);

CREATE TABLE IF NOT EXISTS dispute_statements (
  id INTEGER PRIMARY KEY,
  dispute_id INTEGER NOT NULL REFERENCES disputes(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  author_kind TEXT NOT NULL CHECK(author_kind IN ('party','mediator')),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS dispute_statements_dispute ON dispute_statements(dispute_id, id);

CREATE TABLE IF NOT EXISTS dispute_attachments (
  id INTEGER PRIMARY KEY,
  dispute_id INTEGER NOT NULL REFERENCES disputes(id),
  statement_id INTEGER NOT NULL REFERENCES dispute_statements(id),
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size > 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS dispute_attachments_dispute ON dispute_attachments(dispute_id, statement_id);

-- One decision per round; the second never erases or changes the first.
CREATE TABLE IF NOT EXISTS dispute_decisions (
  id INTEGER PRIMARY KEY,
  dispute_id INTEGER NOT NULL REFERENCES disputes(id),
  round INTEGER NOT NULL CHECK(round IN (1,2)),
  decider_id INTEGER NOT NULL REFERENCES users(id),
  decider_name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('upheld','partially_upheld','dismissed')),
  rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 10 AND 2000),
  recommendation TEXT CHECK(recommendation IS NULL OR length(recommendation) <= 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(dispute_id, round)
);
CREATE TABLE IF NOT EXISTS dispute_appeals (
  dispute_id INTEGER PRIMARY KEY REFERENCES disputes(id),
  requested_by_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Capture at opening, in the same shape as the report capture.
CREATE TABLE IF NOT EXISTS dispute_evidence_captures (
  dispute_id INTEGER PRIMARY KEY REFERENCES disputes(id),
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS dispute_evidence (
  dispute_id INTEGER NOT NULL REFERENCES disputes(id),
  kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  PRIMARY KEY(dispute_id, kind, source_id)
);

-- One row per source; D1 limits compound SELECT to five terms, hence two views.
CREATE VIEW IF NOT EXISTS dispute_evidence_source AS
SELECT d.id AS dispute_id,'mission' AS kind,CAST(p.id AS TEXT) AS source_id,
  json_object('id',p.id,'title',p.title,'format',p.format,'status',p.status,'spokespersonId',p.spokesperson_id,'editorId',p.reserved_by_id,
    'deliveryVersion',p.delivery_version,'inspectionRequired',p.inspection_required,'rawMedia',p.raw_media,'driveLink',p.drive_link,'youtubeLink',p.youtube_link,
    'disputeOpenedById',d.opened_by_id,'disputeCounterpartId',d.counterpart_id,'disputeCategory',d.category,'disputeClaim',d.claim,'disputeCreatedAt',d.created_at) AS payload
FROM disputes d JOIN missions p ON p.id=d.mission_id
UNION ALL
SELECT d.id,'message',CAST(m.id AS TEXT),json_object('id',m.id,'authorId',m.author_id,'text',m.body,'createdAt',m.created_at,'assignmentId',m.assignment_id)
FROM disputes d JOIN messages m ON m.mission_id=d.mission_id
UNION ALL
SELECT d.id,'delivery',CAST(v.version AS TEXT),json_object('version',v.version,'editorId',v.editor_id,'link',v.delivery_link,'videoUrl',v.delivery_video_url,'submittedAt',v.submitted_at)
FROM disputes d JOIN mission_deliveries v ON v.mission_id=d.mission_id
UNION ALL
SELECT d.id,'inspection',CAST(i.version AS TEXT),json_object('version',i.version,'inspectorId',i.inspector_id,'decision',i.decision,'comment',i.comment,'rating',i.rating,'inspectedAt',i.inspected_at)
FROM disputes d JOIN mission_inspections i ON i.mission_id=d.mission_id;

CREATE VIEW IF NOT EXISTS dispute_evidence_participants AS
SELECT d.id AS dispute_id,'assignment' AS kind,CAST(a.id AS TEXT) AS source_id,json_object('id',a.id,'editorId',a.editor_id,'acceptedAt',a.accepted_at,'endedAt',a.ended_at,'endReason',a.end_reason) AS payload
FROM disputes d JOIN mission_assignments a ON a.mission_id=d.mission_id
UNION ALL
SELECT d.id,'participant',CAST(u.id AS TEXT),json_object('id',u.id,'name',u.name,'handle',u.handle,'role',u.role)
FROM disputes d JOIN missions p ON p.id=d.mission_id JOIN users u ON u.id IN (d.opened_by_id,d.counterpart_id,p.spokesperson_id,p.reserved_by_id)
UNION ALL
-- Manifest of the chat attachments: name, size and hash; the bytes stay in R2.
SELECT d.id,'chat_attachment',CAST(t.id AS TEXT),json_object('id',t.id,'messageId',t.message_id,'filename',t.filename,'contentType',t.content_type,'size',t.size,'sha256',t.sha256,'objectKey',t.object_key)
FROM disputes d JOIN message_attachments t ON t.mission_id=d.mission_id;

-- Anyone tied to the case neither judges nor reviews it.
CREATE VIEW IF NOT EXISTS dispute_conflicted_users AS
SELECT d.id AS dispute_id,d.opened_by_id AS user_id FROM disputes d
UNION SELECT d.id,d.counterpart_id FROM disputes d
UNION SELECT d.id,p.spokesperson_id FROM disputes d JOIN missions p ON p.id=d.mission_id
UNION SELECT d.id,p.reserved_by_id FROM disputes d JOIN missions p ON p.id=d.mission_id WHERE p.reserved_by_id IS NOT NULL
UNION SELECT d.id,a.editor_id FROM disputes d JOIN mission_assignments a ON a.mission_id=d.mission_id;

-- Hook for the wallet: while a dispute is live the mission is flagged. This does not
-- claim that any money is held; it only lets a future financial module query it.
CREATE VIEW IF NOT EXISTS disputed_missions AS
SELECT mission_id,id AS dispute_id,status FROM disputes WHERE status <> 'closed';

-- Capabilities: read for inspector and admin, appeal decision for admin, mediation by grant.
INSERT OR IGNORE INTO role_capabilities(role,capability) VALUES
  ('admin','disputes.read'),('admin','disputes.decide'),('inspector','disputes.read');
DROP VIEW IF EXISTS authorized_user_capabilities;
CREATE VIEW authorized_user_capabilities AS
SELECT u.id AS user_id,c.capability FROM users u JOIN role_capabilities c ON c.role=u.role
WHERE u.is_banned=0 AND NOT EXISTS(SELECT 1 FROM user_capability_revocations x WHERE x.user_id=u.id AND x.capability=c.capability)
UNION ALL
SELECT u.id,'reports.releaseRetention' FROM users u JOIN admin_capabilities a ON a.user_id=u.id
WHERE u.role='admin' AND u.is_banned=0 AND a.capability='release_report_retention'
AND NOT EXISTS(SELECT 1 FROM user_capability_revocations x WHERE x.user_id=u.id AND x.capability='reports.releaseRetention')
UNION ALL
SELECT u.id,'disputes.mediate' FROM users u JOIN dispute_mediators m ON m.user_id=u.id
WHERE u.role IN ('inspector','admin') AND u.is_banned=0
AND NOT EXISTS(SELECT 1 FROM user_capability_revocations x WHERE x.user_id=u.id AND x.capability='disputes.mediate');

-- Mission retention now covers disputes (a negative id never collides with a report's).
-- There is no dispute retention release: without a defined deadline rule, it stays retained.
DROP VIEW IF EXISTS retained_report_missions;
CREATE VIEW retained_report_missions AS
SELECT r.id AS report_id,r.mission_id FROM reports r JOIN report_evidence_captures c ON c.report_id=r.id
WHERE NOT EXISTS(SELECT 1 FROM report_retention_releases x WHERE x.report_id=r.id)
UNION ALL
SELECT -d.id,d.mission_id FROM disputes d;

CREATE TRIGGER IF NOT EXISTS retain_dispute_user BEFORE DELETE ON users
WHEN EXISTS(SELECT 1 FROM dispute_conflicted_users WHERE user_id=OLD.id)
  OR EXISTS(SELECT 1 FROM mission_inspections i JOIN disputes d ON d.mission_id=i.mission_id WHERE i.inspector_id=OLD.id)
  OR EXISTS(SELECT 1 FROM dispute_decisions WHERE decider_id=OLD.id)
  OR EXISTS(SELECT 1 FROM dispute_statements WHERE author_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;

-- Opening: only the two live parties of the mission, against the counterpart, and the
-- recorded state must be the mission's real state at that instant.
CREATE TRIGGER IF NOT EXISTS validate_dispute_opening BEFORE INSERT ON disputes
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM missions p JOIN users u ON u.id=NEW.opened_by_id
    WHERE p.id=NEW.mission_id AND u.is_banned=0
      AND ((p.spokesperson_id=NEW.opened_by_id AND p.reserved_by_id=NEW.counterpart_id)
        OR (p.reserved_by_id=NEW.opened_by_id AND p.spokesperson_id=NEW.counterpart_id))
      AND NEW.mission_status=p.status AND NEW.delivery_version=p.delivery_version)
  THEN RAISE(ABORT,'dispute_open_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS capture_dispute_evidence AFTER INSERT ON disputes
BEGIN
  INSERT INTO dispute_evidence_captures(dispute_id) VALUES(NEW.id);
  INSERT INTO dispute_evidence(dispute_id,kind,source_id,payload) SELECT dispute_id,kind,source_id,payload FROM dispute_evidence_source WHERE dispute_id=NEW.id;
  INSERT INTO dispute_evidence(dispute_id,kind,source_id,payload) SELECT dispute_id,kind,source_id,payload FROM dispute_evidence_participants WHERE dispute_id=NEW.id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.opened_by_id,'disputa_aberta','dispute',CAST(NEW.id AS TEXT),json_object('missionId',NEW.mission_id,'category',NEW.category),NEW.created_at);
END;

-- Case fields never change; only status, assignment and closing.
CREATE TRIGGER IF NOT EXISTS preserve_dispute BEFORE UPDATE ON disputes
BEGIN
  SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.mission_id IS NOT OLD.mission_id OR NEW.opened_by_id IS NOT OLD.opened_by_id
    OR NEW.counterpart_id IS NOT OLD.counterpart_id OR NEW.category IS NOT OLD.category OR NEW.claim IS NOT OLD.claim
    OR NEW.mission_status IS NOT OLD.mission_status OR NEW.delivery_version IS NOT OLD.delivery_version OR NEW.created_at IS NOT OLD.created_at
  THEN RAISE(ABORT,'dispute_immutable') END;
END;
CREATE TRIGGER IF NOT EXISTS retain_dispute BEFORE DELETE ON disputes
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;

-- Allowed transitions; decision, appeal and closing drive them through the triggers below.
CREATE TRIGGER IF NOT EXISTS guard_dispute_transition BEFORE UPDATE OF status ON disputes
WHEN NEW.status <> OLD.status
BEGIN
  SELECT CASE WHEN NOT ((OLD.status='open' AND NEW.status='in_review')
    OR (OLD.status='in_review' AND NEW.status IN ('decided','closed'))
    OR (OLD.status='decided' AND NEW.status IN ('appealed','closed'))
    OR (OLD.status='appealed' AND NEW.status='in_review'))
  THEN RAISE(ABORT,'dispute_transition_invalid') END;
END;

-- Assignment: the mediator (round 1) needs the grant; the appeal reviewer needs disputes.decide
-- and cannot be whoever decided round 1. Neither may be tied to the case.
CREATE TRIGGER IF NOT EXISTS guard_dispute_assignment BEFORE UPDATE OF mediator_id, appeal_reviewer_id ON disputes
WHEN NEW.mediator_id IS NOT OLD.mediator_id OR NEW.appeal_reviewer_id IS NOT OLD.appeal_reviewer_id
BEGIN
  SELECT CASE
    WHEN NEW.mediator_id IS NOT OLD.mediator_id AND (OLD.mediator_id IS NOT NULL OR OLD.status<>'open' OR NEW.status<>'in_review'
      OR NOT EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=NEW.mediator_id AND c.capability='disputes.mediate')
      OR EXISTS(SELECT 1 FROM dispute_conflicted_users x WHERE x.dispute_id=NEW.id AND x.user_id=NEW.mediator_id)
      OR EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=NEW.mission_id AND i.inspector_id=NEW.mediator_id))
    THEN RAISE(ABORT,'dispute_assignment_unavailable')
    WHEN NEW.appeal_reviewer_id IS NOT OLD.appeal_reviewer_id AND (OLD.appeal_reviewer_id IS NOT NULL OR OLD.status<>'appealed' OR NEW.status<>'in_review'
      OR NEW.appeal_reviewer_id = OLD.mediator_id
      OR NOT EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=NEW.appeal_reviewer_id AND c.capability='disputes.decide')
      OR EXISTS(SELECT 1 FROM dispute_conflicted_users x WHERE x.dispute_id=NEW.id AND x.user_id=NEW.appeal_reviewer_id)
      OR EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=NEW.mission_id AND i.inspector_id=NEW.appeal_reviewer_id))
    THEN RAISE(ABORT,'dispute_assignment_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS audit_dispute_assignment AFTER UPDATE OF mediator_id, appeal_reviewer_id ON disputes
WHEN NEW.mediator_id IS NOT OLD.mediator_id OR NEW.appeal_reviewer_id IS NOT OLD.appeal_reviewer_id
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(coalesce(NEW.appeal_reviewer_id,NEW.mediator_id),'disputa_assumida','dispute',CAST(NEW.id AS TEXT),
    json_object('round',CASE WHEN NEW.appeal_reviewer_id IS NOT OLD.appeal_reviewer_id THEN 2 ELSE 1 END),NEW.updated_at);
END;

-- Closing without appeal: whoever closes has disputes.decide, gives a reason and is not tied to the case.
CREATE TRIGGER IF NOT EXISTS guard_dispute_close BEFORE UPDATE OF status ON disputes
WHEN NEW.status='closed' AND OLD.status='decided'
BEGIN
  SELECT CASE WHEN NEW.closed_by_id IS NULL OR NEW.close_reason IS NULL
    OR NOT EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=NEW.closed_by_id AND c.capability='disputes.decide')
    OR EXISTS(SELECT 1 FROM dispute_conflicted_users x WHERE x.dispute_id=NEW.id AND x.user_id=NEW.closed_by_id)
    OR EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=NEW.mission_id AND i.inspector_id=NEW.closed_by_id)
  THEN RAISE(ABORT,'dispute_close_unavailable') END;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.closed_by_id,'disputa_encerrada','dispute',CAST(NEW.id AS TEXT),json_object('reason',NEW.close_reason),NEW.updated_at);
END;

-- Statements: only the parties (and the current mediator), while the case is live.
CREATE TRIGGER IF NOT EXISTS validate_dispute_statement BEFORE INSERT ON dispute_statements
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM disputes d JOIN users u ON u.id=NEW.author_id
    WHERE d.id=NEW.dispute_id AND d.status IN ('open','in_review','appealed') AND u.is_banned=0
      AND ((NEW.author_kind='party' AND NEW.author_id IN (d.opened_by_id,d.counterpart_id))
        OR (NEW.author_kind='mediator' AND d.status='in_review'
            AND NEW.author_id = CASE WHEN d.appeal_reviewer_id IS NULL THEN d.mediator_id ELSE d.appeal_reviewer_id END)))
  THEN RAISE(ABORT,'dispute_statement_forbidden') END;
END;
CREATE TRIGGER IF NOT EXISTS validate_dispute_attachment BEFORE INSERT ON dispute_attachments
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM dispute_statements s WHERE s.id=NEW.statement_id AND s.dispute_id=NEW.dispute_id)
  THEN RAISE(ABORT,'dispute_statement_forbidden') END;
END;

-- Decision: round 1 by the dispute's mediator; round 2 by the appeal reviewer.
CREATE TRIGGER IF NOT EXISTS validate_dispute_decision BEFORE INSERT ON dispute_decisions
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM disputes d JOIN users u ON u.id=NEW.decider_id
    WHERE d.id=NEW.dispute_id AND d.status='in_review' AND u.is_banned=0 AND u.name=NEW.decider_name
      AND ((NEW.round=1 AND d.mediator_id=NEW.decider_id AND d.appeal_reviewer_id IS NULL
            AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='disputes.mediate'))
        OR (NEW.round=2 AND d.appeal_reviewer_id=NEW.decider_id
            AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=u.id AND c.capability='disputes.decide')))
      AND NOT EXISTS(SELECT 1 FROM dispute_conflicted_users x WHERE x.dispute_id=d.id AND x.user_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM mission_inspections i WHERE i.mission_id=d.mission_id AND i.inspector_id=u.id))
  THEN RAISE(ABORT,'dispute_decision_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS apply_dispute_decision AFTER INSERT ON dispute_decisions
BEGIN
  UPDATE disputes SET status=CASE NEW.round WHEN 1 THEN 'decided' ELSE 'closed' END,updated_at=NEW.created_at WHERE id=NEW.dispute_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.decider_id,'disputa_decidida','dispute',CAST(NEW.dispute_id AS TEXT),
    json_object('round',NEW.round,'outcome',NEW.outcome,'rationale',NEW.rationale,'actorName',NEW.decider_name),NEW.created_at);
END;

-- Appeal: once, by one of the parties, after the round 1 decision.
CREATE TRIGGER IF NOT EXISTS validate_dispute_appeal BEFORE INSERT ON dispute_appeals
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM disputes d JOIN users u ON u.id=NEW.requested_by_id
    WHERE d.id=NEW.dispute_id AND d.status='decided' AND u.is_banned=0 AND NEW.requested_by_id IN (d.opened_by_id,d.counterpart_id))
  THEN RAISE(ABORT,'dispute_appeal_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS apply_dispute_appeal AFTER INSERT ON dispute_appeals
BEGIN
  UPDATE disputes SET status='appealed',updated_at=NEW.created_at WHERE id=NEW.dispute_id;
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  VALUES(NEW.requested_by_id,'disputa_recurso','dispute',CAST(NEW.dispute_id AS TEXT),json_object('reason',NEW.reason),NEW.created_at);
END;

-- Dispute records are append-only.
CREATE TRIGGER IF NOT EXISTS immutable_dispute_statements BEFORE UPDATE ON dispute_statements
BEGIN
  SELECT RAISE(ABORT,'dispute_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_dispute_statements BEFORE DELETE ON dispute_statements
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS immutable_dispute_attachments BEFORE UPDATE ON dispute_attachments
BEGIN
  SELECT RAISE(ABORT,'dispute_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_dispute_attachments BEFORE DELETE ON dispute_attachments
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS immutable_dispute_decisions BEFORE UPDATE ON dispute_decisions
BEGIN
  SELECT RAISE(ABORT,'dispute_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_dispute_decisions BEFORE DELETE ON dispute_decisions
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS immutable_dispute_appeals BEFORE UPDATE ON dispute_appeals
BEGIN
  SELECT RAISE(ABORT,'dispute_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_dispute_appeals BEFORE DELETE ON dispute_appeals
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
CREATE TRIGGER IF NOT EXISTS immutable_dispute_evidence BEFORE UPDATE ON dispute_evidence
BEGIN
  SELECT RAISE(ABORT,'dispute_immutable');
END;
CREATE TRIGGER IF NOT EXISTS retain_dispute_evidence BEFORE DELETE ON dispute_evidence
BEGIN
  SELECT RAISE(ABORT,'evidence_retained');
END;
