-- expandInspectorRole applies the native role constraint atomically before this patch.
CREATE TABLE IF NOT EXISTS mission_inspection_assignments (
  mission_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  inspector_id INTEGER NOT NULL REFERENCES users(id),
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(mission_id,version),
  FOREIGN KEY(mission_id,version) REFERENCES mission_deliveries(mission_id,version) ON DELETE CASCADE
);
ALTER TABLE editor_verifications ADD COLUMN invitation_id INTEGER REFERENCES spokesperson_invitations(id);
