-- Formaliza a funcionalidade de cancelamento/repasse de missão pelo
-- porta-voz. Já existia em produção como DDL aplicado direto (sem passar por
-- este diretório) — este patch só a traz para o controle de versão e para o
-- staging, reproduzindo exatamente o que já roda.
ALTER TABLE missions ADD COLUMN lifecycle_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE missions ADD COLUMN first_delivered_at TEXT;
ALTER TABLE missions ADD COLUMN cancelled_at TEXT;
ALTER TABLE missions ADD COLUMN cancellation_reason TEXT;
ALTER TABLE missions ADD COLUMN excluded_editor_id INTEGER;

ALTER TABLE messages ADD COLUMN assignment_id INTEGER;

CREATE TABLE IF NOT EXISTS mission_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id),
  accepted_at TEXT NOT NULL,
  ended_at TEXT,
  end_reason TEXT
);

CREATE TABLE IF NOT EXISTS mission_owner_events (
  request_id TEXT PRIMARY KEY,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('cancel_mission', 'reassign_mission')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  expected_version INTEGER NOT NULL,
  previous_editor_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS message_assignment ON messages(mission_id, assignment_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS mission_assignment_active ON mission_assignments(mission_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS mission_assignment_editor ON mission_assignments(editor_id, mission_id);
CREATE INDEX IF NOT EXISTS mission_owner_recipient ON mission_owner_events(previous_editor_id, created_at);

DROP TRIGGER IF EXISTS apply_mission_owner_event;
CREATE TRIGGER apply_mission_owner_event AFTER INSERT ON mission_owner_events
BEGIN
  UPDATE missions SET status = CASE NEW.action WHEN 'cancel_mission' THEN 'cancelada' ELSE 'disponivel' END,
    cancelled_at = CASE NEW.action WHEN 'cancel_mission' THEN NEW.created_at ELSE NULL END,
    cancellation_reason = CASE NEW.action WHEN 'cancel_mission' THEN NEW.reason ELSE NULL END,
    excluded_editor_id = CASE NEW.action WHEN 'reassign_mission' THEN reserved_by_id ELSE excluded_editor_id END,
    reserved_by_id = NULL, reserved_at = NULL, reserved_until = NULL
  WHERE id = NEW.mission_id AND spokesperson_id = NEW.actor_id
    AND lifecycle_version = NEW.expected_version AND first_delivered_at IS NULL
    AND delivery_link IS NULL AND delivery_video_url IS NULL
    AND status IN ('disponivel','oferecida','reservada')
    AND (NEW.action = 'cancel_mission' OR (status = 'reservada' AND reserved_by_id IS NOT NULL AND julianday(NEW.created_at) >= julianday(reserved_at) + 2));
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'owner_action_conflict') END;
  UPDATE offers SET status = 'expirada', answered_at = NEW.created_at WHERE mission_id = NEW.mission_id AND status = 'pendente';
  DELETE FROM email_queue WHERE sent_at IS NULL AND key LIKE 'mission:' || NEW.mission_id || ':%';
  INSERT INTO admin_audit(actor_id, action, entity, entity_id, details, created_at)
  VALUES(NEW.actor_id, NEW.action, 'mission', CAST(NEW.mission_id AS TEXT), json_object('reason',NEW.reason,'previousEditorId',NEW.previous_editor_id,'requestId',NEW.request_id), NEW.created_at);
  INSERT INTO email_queue(key,recipient,subject,html)
  SELECT 'mission-owner:' || NEW.request_id, email,
    CASE NEW.action WHEN 'cancel_mission' THEN 'Missao cancelada pelo porta-voz' ELSE 'Missao devolvida a fila pelo porta-voz' END,
    '<p>O porta-voz encerrou sua atribuicao na missao #' || NEW.mission_id || '. Consulte o motivo e o historico na sua conta da Oficina Amarela.</p>'
  FROM users WHERE id = NEW.previous_editor_id;
END;

DROP TRIGGER IF EXISTS mission_assignment_insert;
CREATE TRIGGER mission_assignment_insert AFTER INSERT ON missions
WHEN NEW.reserved_by_id IS NOT NULL
BEGIN
  INSERT INTO mission_assignments(mission_id, editor_id, accepted_at)
  VALUES(NEW.id, NEW.reserved_by_id, COALESCE(NEW.reserved_at, NEW.created_at));
END;

DROP TRIGGER IF EXISTS mission_assignment_update;
CREATE TRIGGER mission_assignment_update AFTER UPDATE OF reserved_by_id, reserved_at ON missions
WHEN OLD.reserved_by_id IS NOT NEW.reserved_by_id OR OLD.reserved_at IS NOT NEW.reserved_at
BEGIN
  UPDATE mission_assignments SET ended_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), end_reason = NEW.status
  WHERE mission_id = NEW.id AND ended_at IS NULL;
  INSERT INTO mission_assignments(mission_id, editor_id, accepted_at)
  SELECT NEW.id, NEW.reserved_by_id, COALESCE(NEW.reserved_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE NEW.reserved_by_id IS NOT NULL;
END;

DROP TRIGGER IF EXISTS mission_delivery_insert;
CREATE TRIGGER mission_delivery_insert AFTER INSERT ON missions
WHEN NEW.delivery_link IS NOT NULL OR NEW.delivery_video_url IS NOT NULL OR NEW.status IN ('em_revisao','reedicao','aprovada','finalizada')
BEGIN
  UPDATE missions SET first_delivered_at = COALESCE(first_delivered_at,NEW.created_at) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS mission_first_delivery;
CREATE TRIGGER mission_first_delivery AFTER UPDATE OF status, delivery_link, delivery_video_url ON missions
WHEN NEW.first_delivered_at IS NULL AND (NEW.delivery_link IS NOT NULL OR NEW.delivery_video_url IS NOT NULL OR NEW.status IN ('em_revisao','reedicao','aprovada','finalizada'))
BEGIN
  UPDATE missions SET first_delivered_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS mission_lifecycle_version;
CREATE TRIGGER mission_lifecycle_version AFTER UPDATE OF status, reserved_by_id, reserved_at ON missions
WHEN OLD.status IS NOT NEW.status OR OLD.reserved_by_id IS NOT NEW.reserved_by_id OR OLD.reserved_at IS NOT NEW.reserved_at
BEGIN
  UPDATE missions SET lifecycle_version = lifecycle_version + 1 WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS mission_message_assignment;
CREATE TRIGGER mission_message_assignment AFTER INSERT ON messages
WHEN NEW.assignment_id IS NULL
BEGIN
  UPDATE messages SET assignment_id = (SELECT id FROM mission_assignments WHERE mission_id = NEW.mission_id AND ended_at IS NULL) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS mission_message_guard;
CREATE TRIGGER mission_message_guard BEFORE INSERT ON messages
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM missions p JOIN users u ON u.id = NEW.author_id
    WHERE p.id = NEW.mission_id AND p.status <> 'cancelada'
    AND (u.role = 'admin' OR u.id = p.spokesperson_id OR u.id = p.reserved_by_id))
    THEN RAISE(ABORT,'mission_chat_forbidden') END;
  SELECT CASE WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mission_assignments a
    WHERE a.id = NEW.assignment_id AND a.mission_id = NEW.mission_id AND a.ended_at IS NULL)
    THEN RAISE(ABORT,'mission_chat_forbidden') END;
END;
