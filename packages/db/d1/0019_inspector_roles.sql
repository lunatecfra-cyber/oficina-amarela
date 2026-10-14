-- expandInspectorRole applies the native role constraint atomically before this patch.
ALTER TABLE mission_deliveries ADD COLUMN assigned_inspector_id INTEGER REFERENCES users(id);
ALTER TABLE editor_verifications ADD COLUMN invitation_id INTEGER REFERENCES spokesperson_invitations(id);
