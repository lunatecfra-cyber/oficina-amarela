-- Preserve the old aggregate without inventing who submitted its votes.
CREATE TABLE IF NOT EXISTS legacy_user_rating_snapshot (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating REAL NOT NULL,
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  provenance TEXT NOT NULL DEFAULT 'legacy_aggregate_unknown_source'
);
INSERT INTO legacy_user_rating_snapshot(user_id, rating)
SELECT id, rating FROM users
WHERE rating IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM pragma_table_info('reviews') WHERE name = 'source')
ON CONFLICT(user_id) DO NOTHING;
