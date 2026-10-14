CREATE TABLE IF NOT EXISTS portfolio_samples (
  id TEXT PRIMARY KEY,
  mission_id INTEGER NOT NULL,
  delivery_version INTEGER NOT NULL,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  asset_url TEXT NOT NULL,
  media_kind TEXT NOT NULL CHECK(media_kind IN ('video','image')),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=1000),
  specialties TEXT NOT NULL DEFAULT '' CHECK(length(specialties)<=200),
  preview_seconds INTEGER NOT NULL DEFAULT 0 CHECK(preview_seconds BETWEEN 0 AND 3600),
  editor_visible INTEGER NOT NULL DEFAULT 0 CHECK(editor_visible IN (0,1)),
  owner_authorized INTEGER NOT NULL DEFAULT 0 CHECK(owner_authorized IN (0,1)),
  authorization_statement TEXT,
  authorized_by INTEGER REFERENCES users(id),
  revision INTEGER NOT NULL DEFAULT 0,
  last_actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(mission_id,delivery_version) REFERENCES mission_deliveries(mission_id,version) ON DELETE CASCADE,
  CHECK(owner_authorized=0 OR (authorization_statement IS NOT NULL AND length(authorization_statement)>0 AND authorized_by IS NOT NULL)),
  UNIQUE(mission_id,delivery_version,editor_id)
);
CREATE INDEX IF NOT EXISTS portfolio_samples_editor ON portfolio_samples(editor_id);
CREATE TRIGGER IF NOT EXISTS portfolio_sample_identity BEFORE UPDATE ON portfolio_samples
WHEN NEW.id IS NOT OLD.id OR NEW.mission_id IS NOT OLD.mission_id OR NEW.delivery_version IS NOT OLD.delivery_version OR NEW.editor_id IS NOT OLD.editor_id OR NEW.asset_key IS NOT OLD.asset_key OR NEW.asset_url IS NOT OLD.asset_url
BEGIN
  SELECT RAISE(ABORT,'portfolio_asset_immutable');
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
CREATE TRIGGER IF NOT EXISTS audit_portfolio_sample_created AFTER INSERT ON portfolio_samples
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.last_actor_id,'portfolio_requested','portfolio_sample',NEW.id,json_object('missionId',NEW.mission_id,'version',NEW.delivery_version));
END;
CREATE TRIGGER IF NOT EXISTS audit_portfolio_sample_updated AFTER UPDATE ON portfolio_samples
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.last_actor_id,'portfolio_updated','portfolio_sample',NEW.id,json_object('missionId',NEW.mission_id,'version',NEW.delivery_version,'revision',NEW.revision,'visible',NEW.editor_visible,'ownerAuthorized',NEW.owner_authorized,'authorizationStatement',NEW.authorization_statement,'authorizedBy',NEW.authorized_by,'previousAuthorizedBy',OLD.authorized_by));
END;
