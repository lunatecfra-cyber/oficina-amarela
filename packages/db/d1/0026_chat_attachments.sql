-- Anexos privados do chat. Os bytes ficam no R2 (chave chat/<missão>/<uuid>); aqui
-- ficam o vínculo com a mensagem e o hash, que alimentará o manifesto de evidências.
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
-- Anexo é registro de conversa: não se reescreve depois de enviado.
CREATE TRIGGER IF NOT EXISTS message_attachments_immutable BEFORE UPDATE ON message_attachments
BEGIN
  SELECT RAISE(ABORT, 'attachment_immutable');
END;
