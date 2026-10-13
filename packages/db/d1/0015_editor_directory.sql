-- Publication is opt-in; existing profiles and links remain unchanged.
ALTER TABLE users ADD COLUMN directory_visible INTEGER NOT NULL DEFAULT 0 CHECK(directory_visible IN (0,1));
ALTER TABLE users ADD COLUMN directory_portfolio_consent INTEGER NOT NULL DEFAULT 0 CHECK(directory_portfolio_consent IN (0,1));
CREATE TRIGGER audit_editor_directory_visibility AFTER UPDATE OF directory_visible,directory_portfolio_consent ON users
WHEN OLD.directory_visible<>NEW.directory_visible OR OLD.directory_portfolio_consent<>NEW.directory_portfolio_consent
BEGIN
  INSERT INTO admin_audit(actor_id,action,entity,entity_id,details)
  VALUES(NEW.id,'editor_directory_consent','user',CAST(NEW.id AS TEXT),json_object('visible',NEW.directory_visible,'portfolioConsent',NEW.directory_portfolio_consent));
END;
