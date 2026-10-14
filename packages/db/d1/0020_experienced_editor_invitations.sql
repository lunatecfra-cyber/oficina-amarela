ALTER TABLE spokesperson_invitations ADD COLUMN kind TEXT NOT NULL DEFAULT 'spokesperson' CHECK(kind IN ('spokesperson','experienced_editor'));
ALTER TABLE spokesperson_invitations ADD COLUMN specialties TEXT NOT NULL DEFAULT '[]';
DROP TRIGGER IF EXISTS apply_invitation_redemption;
CREATE TRIGGER apply_invitation_redemption AFTER INSERT ON invitation_redemptions
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM spokesperson_invitations i JOIN users a ON a.id=i.created_by
    WHERE i.token_hash=NEW.token_hash AND lower(i.email)=lower(NEW.email) AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>NEW.redeemed_at
    AND a.role='admin' AND a.is_banned=0) THEN RAISE(ABORT,'invitation_unavailable') END;
  INSERT INTO users(handle,name,email,password_hash,google_id,role,avatar_url,referred_by_id,editing_styles,sessions_valid_after)
  SELECT NEW.handle,NEW.name,NEW.email,NEW.password_hash,NEW.google_id,
    CASE i.kind WHEN 'experienced_editor' THEN 'editor' ELSE 'voz' END,NEW.avatar_url,
    (SELECT id FROM users WHERE referral_code=NEW.referral_code),i.specialties,'1970-01-01T00:00:00.000Z'
  FROM spokesperson_invitations i WHERE i.token_hash=NEW.token_hash;
  UPDATE spokesperson_invitations SET used_at=NEW.redeemed_at,used_by=(SELECT id FROM users WHERE lower(email)=lower(NEW.email))
  WHERE token_hash=NEW.token_hash AND used_at IS NULL AND revoked_at IS NULL;
  SELECT CASE WHEN changes()=0 THEN RAISE(ABORT,'invitation_unavailable') END;
  INSERT INTO editor_verifications(editor_id,verified,admin_id,reason,invitation_id)
  SELECT used_by,1,created_by,'Administrative experienced-editor invitation redeemed',id FROM spokesperson_invitations
  WHERE token_hash=NEW.token_hash AND kind='experienced_editor';
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details,created_at)
  SELECT created_by,CASE kind WHEN 'experienced_editor' THEN 'experienced_invitation_redeemed' ELSE 'convite_consumido' END,'spokesperson_invitation',CAST(id AS TEXT),json_object('kind',kind,'userId',used_by),NEW.redeemed_at
  FROM spokesperson_invitations WHERE token_hash=NEW.token_hash;
END;
DROP TRIGGER IF EXISTS validate_editor_verification_insert;
CREATE TRIGGER validate_editor_verification_insert BEFORE INSERT ON editor_verifications
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.admin_id AND role='admin' AND is_banned=0)
    OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.editor_id AND role='editor' AND is_banned=0 AND (profile_completed=1 OR EXISTS(SELECT 1 FROM spokesperson_invitations WHERE id=NEW.invitation_id AND used_by=NEW.editor_id AND kind='experienced_editor' AND used_at IS NOT NULL)))
    THEN RAISE(ABORT,'editor_verification_unavailable') END;
END;
CREATE TRIGGER IF NOT EXISTS authorize_invitation_issue BEFORE INSERT ON spokesperson_invitations
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND role='admin' AND is_banned=0)
    THEN RAISE(ABORT,'invitation_forbidden') END;
END;
