ALTER TABLE users ADD COLUMN work_preference TEXT CHECK(work_preference IS NULL OR work_preference IN ('volunteer','paid','both'));
CREATE TABLE IF NOT EXISTS editor_verifications (
  editor_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified INTEGER NOT NULL CHECK(verified IN (0,1)),
  admin_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
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
CREATE TRIGGER IF NOT EXISTS audit_editor_verification_insert AFTER INSERT ON editor_verifications
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.admin_id,'editor_verification','user',CAST(NEW.editor_id AS TEXT),json_object('verified',NEW.verified,'reason',NEW.reason));
END;
CREATE TRIGGER IF NOT EXISTS audit_editor_verification_update AFTER UPDATE ON editor_verifications
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.admin_id,'editor_verification','user',CAST(NEW.editor_id AS TEXT),json_object('verified',NEW.verified,'reason',NEW.reason));
END;
CREATE TRIGGER IF NOT EXISTS audit_editor_work_preference AFTER UPDATE OF work_preference ON users
WHEN OLD.work_preference IS NOT NEW.work_preference
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.id,'editor_work_preference','user',CAST(NEW.id AS TEXT),json_object('preference',NEW.work_preference));
END;
CREATE VIEW IF NOT EXISTS editor_work_stats AS
SELECT m.reserved_by_id AS editor_id,COUNT(*) AS completedCount,
  SUM(CASE WHEN length(m.desired_deadline)=10 AND date(m.desired_deadline) IS NOT NULL AND date(d.submitted_at) IS NOT NULL THEN 1 ELSE 0 END) AS onTimeKnownCount,
  SUM(CASE WHEN length(m.desired_deadline)=10 AND date(m.desired_deadline) IS NOT NULL AND date(d.submitted_at,'-3 hours')<=date(m.desired_deadline) THEN 1 ELSE 0 END) AS onTimeCount
FROM missions m LEFT JOIN mission_deliveries d ON d.mission_id=m.id AND d.version=1 AND d.editor_id=m.reserved_by_id
WHERE m.status='finalizada' GROUP BY m.reserved_by_id;
