DROP TRIGGER IF EXISTS validate_editor_verification_insert;
CREATE TRIGGER validate_editor_verification_insert BEFORE INSERT ON editor_verifications
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.admin_id AND role='admin' AND is_banned=0)
    OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.editor_id AND role='editor' AND is_banned=0 AND (profile_completed=1 OR EXISTS(SELECT 1 FROM spokesperson_invitations WHERE id=NEW.invitation_id AND used_by=NEW.editor_id AND kind='experienced_editor' AND used_at IS NOT NULL)))
    THEN RAISE(ABORT,'editor_verification_unavailable') END;
END;
