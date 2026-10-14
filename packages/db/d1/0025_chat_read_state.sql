-- Per-participant chat read marker. Stores the highest message id read; it only moves
-- forward (see markRead), so repeating or reordering calls is harmless.
CREATE TABLE IF NOT EXISTS message_reads (
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (mission_id, user_id)
);
-- The chat cursor is the message id, not the timestamp: two sends in the same
-- millisecond have equal created_at but distinct, increasing ids.
CREATE INDEX IF NOT EXISTS messages_mission_id ON messages(mission_id, id);
-- Mission timeline in the conversation: reads mission_notifications by mission.
CREATE INDEX IF NOT EXISTS mission_notification_mission ON mission_notifications(mission_id, created_at);
