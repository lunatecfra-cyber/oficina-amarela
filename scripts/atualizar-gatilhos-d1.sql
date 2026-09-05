DROP TRIGGER IF EXISTS apply_invitation_redemption;
DROP TRIGGER IF EXISTS apply_mission_approval;
DROP TRIGGER IF EXISTS claim_mission_on_pending_offer;
DROP TRIGGER IF EXISTS reserve_mission_on_offer_accept;
DROP TRIGGER IF EXISTS release_mission_on_offer_close;

CREATE TRIGGER apply_invitation_redemption
AFTER INSERT ON invitation_redemptions
BEGIN
  INSERT INTO users (
    handle, name, email, password_hash, google_id, role, avatar_url, referred_by_id
  ) VALUES (
    NEW.handle, NEW.name, NEW.email, NEW.password_hash, NEW.google_id, 'voz', NEW.avatar_url,
    (SELECT id FROM users WHERE referral_code = NEW.referral_code)
  );
  UPDATE spokesperson_invitations
  SET used_at = NEW.redeemed_at,
      used_by = (SELECT id FROM users WHERE lower(email) = lower(NEW.email))
  WHERE token_hash = NEW.token_hash AND used_at IS NULL AND revoked_at IS NULL;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'invitation_unavailable') END;
  INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
  SELECT created_by, 'convite_consumido', 'spokesperson_invitation', CAST(id AS TEXT),
         json_object('email', NEW.email, 'user_id', used_by), NEW.redeemed_at
  FROM spokesperson_invitations WHERE token_hash = NEW.token_hash;
END;

CREATE TRIGGER apply_mission_approval
AFTER INSERT ON mission_approvals
BEGIN
  UPDATE missions
  SET status = NEW.status_final, inspector_notes = NULL,
      revision_requested_by = NULL, is_scored = 1
  WHERE id = NEW.mission_id AND status = 'em_revisao' AND is_scored = 0;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_not_in_review') END;

  INSERT INTO reviews (mission_id, editor_id, rating, comment)
  SELECT NEW.mission_id, NEW.editor_id, NEW.rating, nullif(trim(NEW.comment), '')
  WHERE NEW.rating IS NOT NULL;

  UPDATE users
  SET delivered_count = delivered_count + 1, reputation = reputation + 25, streak = streak + 1
  WHERE id = NEW.editor_id;
  UPDATE users
  SET rating = (SELECT round(avg(rating), 2) FROM reviews WHERE editor_id = NEW.editor_id)
  WHERE id = NEW.editor_id;

  INSERT INTO ranking_approvals (
    mission_id, cycle_id, editor_id, approved_by, approved_at
  )
  SELECT NEW.mission_id, id, NEW.editor_id, NEW.approved_by, NEW.approved_at
  FROM ranking_cycles
  WHERE frozen_at IS NULL
    AND NEW.approved_at BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC LIMIT 1
  ON CONFLICT (mission_id) DO UPDATE SET
    cycle_id = excluded.cycle_id,
    editor_id = excluded.editor_id,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    voided_at = NULL,
    voided_by = NULL,
    void_reason = NULL
  WHERE ranking_approvals.voided_at IS NOT NULL;

  INSERT INTO admin_audit (actor_id, action, entity, entity_id, details, created_at)
  VALUES (
    NEW.approved_by, 'edicao_aprovada', 'mission', CAST(NEW.mission_id AS TEXT),
    json_object('editorId', NEW.editor_id), NEW.approved_at
  );

  INSERT OR IGNORE INTO referral_rewards (
    invitee_id, inviter_id, awarded_at
  )
  SELECT NEW.editor_id, referred_by_id, NEW.approved_at
  FROM users
  WHERE id = NEW.editor_id AND referred_by_id IS NOT NULL
    AND (SELECT count(*) FROM ranking_approvals
         WHERE editor_id = NEW.editor_id AND voided_at IS NULL) >= 2
    AND (SELECT count(*) FROM referral_rewards
         WHERE inviter_id = users.referred_by_id AND revoked_at IS NULL
           AND awarded_at >= substr(NEW.approved_at, 1, 7) || '-01T00:00:00.000Z') < 5;
  UPDATE users SET reputation = reputation + 100
  WHERE id = (SELECT inviter_id FROM referral_rewards
              WHERE invitee_id = NEW.editor_id)
    AND changes() = 1;
END;

CREATE TRIGGER claim_mission_on_pending_offer
AFTER INSERT ON offers
WHEN NEW.status = 'pendente'
BEGIN
  UPDATE missions SET status = 'oferecida'
  WHERE id = NEW.mission_id AND status IN ('disponivel', 'oferecida');
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_unavailable') END;
END;

CREATE TRIGGER reserve_mission_on_offer_accept
AFTER UPDATE OF status ON offers
WHEN OLD.status = 'pendente' AND NEW.status = 'aceita'
BEGIN
  UPDATE missions
  SET status = 'reservada', reserved_by_id = NEW.editor_id,
      reserved_at = NEW.answered_at
  WHERE id = NEW.mission_id AND status = 'oferecida';
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'offer_invalid') END;
END;

CREATE TRIGGER release_mission_on_offer_close
AFTER UPDATE OF status ON offers
WHEN OLD.status = 'pendente' AND NEW.status IN ('rejeitada', 'expirada')
BEGIN
  UPDATE missions SET status = 'disponivel'
  WHERE id = NEW.mission_id AND status = 'oferecida';
END;
