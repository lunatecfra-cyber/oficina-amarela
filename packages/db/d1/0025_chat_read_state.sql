-- Marcador de leitura do chat por participante. Guarda o maior id de mensagem
-- lido; só avança (ver markRead), então repetir ou reordenar chamadas é inofensivo.
CREATE TABLE IF NOT EXISTS message_reads (
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (mission_id, user_id)
);
-- O cursor do chat é o id da mensagem, não o horário: dois envios no mesmo
-- milissegundo têm created_at igual, mas ids distintos e crescentes.
CREATE INDEX IF NOT EXISTS messages_mission_id ON messages(mission_id, id);
-- Linha do tempo da missão na conversa: lê mission_notifications por missão.
CREATE INDEX IF NOT EXISTS mission_notification_mission ON mission_notifications(mission_id, created_at);
