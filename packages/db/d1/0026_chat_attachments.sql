-- Private chat attachments. The bytes live in R2 (key chat/<mission>/<uuid>); here we keep
-- the link to the message and the hash, which will feed the evidence manifest.
CREATE TABLE IF NOT EXISTS message_attachments (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS message_attachments_mission ON message_attachments(mission_id, message_id);
-- An attachment is a conversation record: it is not rewritten after being sent.
CREATE TRIGGER IF NOT EXISTS message_attachments_immutable BEFORE UPDATE ON message_attachments
BEGIN
  SELECT RAISE(ABORT, 'attachment_immutable');
END;
