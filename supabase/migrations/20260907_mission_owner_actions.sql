BEGIN;

ALTER TABLE pautas
  ADD COLUMN IF NOT EXISTS lifecycle_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS excluded_editor_id integer REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pautas DROP CONSTRAINT IF EXISTS pautas_status_check;
ALTER TABLE pautas ADD CONSTRAINT pautas_status_check CHECK (status IN
  ('disponivel','oferecida','reservada','em_revisao','reedicao','aprovada','finalizada','cancelada'));

CREATE TABLE IF NOT EXISTS mission_assignments (
  id bigserial PRIMARY KEY,
  mission_id integer NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id integer NOT NULL REFERENCES users(id),
  accepted_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS mission_assignments_active ON mission_assignments(mission_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS mission_assignments_editor ON mission_assignments(editor_id, mission_id);
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS assignment_id bigint REFERENCES mission_assignments(id);
CREATE INDEX IF NOT EXISTS mensagens_assignment ON mensagens(assignment_id, criada_em);

UPDATE pautas SET first_delivered_at = now()
WHERE first_delivered_at IS NULL AND (nullif(btrim(entrega_link), '') IS NOT NULL
   OR nullif(btrim(video_entrega_url), '') IS NOT NULL
   OR status IN ('em_revisao','aprovada','finalizada','reedicao'));
INSERT INTO mission_assignments(mission_id, editor_id, accepted_at)
SELECT id, reservada_por_id, coalesce(reservada_em, now()) FROM pautas
WHERE reservada_por_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mission_assignments a WHERE a.mission_id = pautas.id AND a.ended_at IS NULL);
-- Only attribute messages within a known acceptance window. Older ambiguous
-- history remains owner/admin-only instead of leaking a former assignment.
UPDATE mensagens m SET assignment_id = a.id
FROM mission_assignments a JOIN pautas p ON p.id = a.mission_id
WHERE m.assignment_id IS NULL AND a.ended_at IS NULL AND m.pauta_id = a.mission_id AND p.reservada_em IS NOT NULL
  AND m.criada_em >= a.accepted_at
  AND (m.autor_id IN (a.editor_id, p.porta_voz_id)
       OR EXISTS (SELECT 1 FROM users u WHERE u.id = m.autor_id AND u.papel = 'admin'));

CREATE OR REPLACE FUNCTION mission_owner_track_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.lifecycle_version := OLD.lifecycle_version + CASE WHEN
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.reservada_por_id IS DISTINCT FROM OLD.reservada_por_id OR
      NEW.reservada_em IS DISTINCT FROM OLD.reservada_em THEN 1 ELSE 0 END;
    NEW.first_delivered_at := coalesce(OLD.first_delivered_at, NEW.first_delivered_at);
  END IF;
  IF NEW.first_delivered_at IS NULL AND (
    nullif(btrim(NEW.entrega_link), '') IS NOT NULL OR
    nullif(btrim(NEW.video_entrega_url), '') IS NOT NULL OR
    NEW.status IN ('em_revisao','aprovada','finalizada','reedicao')) THEN
    NEW.first_delivered_at := clock_timestamp();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mission_owner_track_state ON pautas;
CREATE TRIGGER mission_owner_track_state BEFORE INSERT OR UPDATE ON pautas
FOR EACH ROW EXECUTE FUNCTION mission_owner_track_state();

CREATE OR REPLACE FUNCTION mission_owner_track_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.reservada_por_id IS NOT DISTINCT FROM OLD.reservada_por_id
       AND NEW.reservada_em IS NOT DISTINCT FROM OLD.reservada_em
       AND NEW.status <> 'cancelada' THEN RETURN NEW; END IF;
    UPDATE mission_assignments SET ended_at = clock_timestamp(),
      end_reason = CASE WHEN NEW.status = 'cancelada' THEN 'cancel_mission'
        WHEN NEW.excluded_editor_id = OLD.reservada_por_id THEN 'reassign_mission'
        ELSE 'assignment_ended' END
    WHERE mission_id = NEW.id AND ended_at IS NULL;
  END IF;
  IF NEW.reservada_por_id IS NOT NULL AND NEW.status <> 'cancelada' THEN
    INSERT INTO mission_assignments(mission_id, editor_id, accepted_at)
    VALUES (NEW.id, NEW.reservada_por_id, coalesce(NEW.reservada_em, clock_timestamp()));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mission_owner_track_assignment ON pautas;
CREATE TRIGGER mission_owner_track_assignment AFTER INSERT OR UPDATE ON pautas
FOR EACH ROW EXECUTE FUNCTION mission_owner_track_assignment();

CREATE TABLE IF NOT EXISTS mission_owner_events (
  request_id text PRIMARY KEY,
  mission_id integer NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  actor_id integer NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('cancel_mission','reassign_mission')),
  reason text NOT NULL,
  expected_version integer NOT NULL,
  previous_editor_id integer REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS mission_owner_events_editor ON mission_owner_events(previous_editor_id, created_at);

CREATE OR REPLACE FUNCTION mission_owner_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM fila_emails WHERE enviado_em IS NULL AND chave LIKE 'mission:' || NEW.mission_id || ':%';
  INSERT INTO auditoria_admin(ator_id,acao,entidade,entidade_id,detalhes)
  VALUES(NEW.actor_id,NEW.action,'mission',NEW.mission_id::text,
    jsonb_build_object('reason',NEW.reason,'previousEditorId',NEW.previous_editor_id,'requestId',NEW.request_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mission_owner_audit_event ON mission_owner_events;
CREATE TRIGGER mission_owner_audit_event AFTER INSERT ON mission_owner_events
FOR EACH ROW EXECUTE FUNCTION mission_owner_audit_event();

-- Even legacy chat inserts must serialize against owner actions.
CREATE OR REPLACE FUNCTION mission_owner_guard_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p pautas%ROWTYPE; active_id bigint; author_role text;
BEGIN
  SELECT * INTO p FROM pautas WHERE id = NEW.pauta_id FOR UPDATE;
  SELECT papel INTO author_role FROM users WHERE id = NEW.autor_id;
  IF p.id IS NULL OR p.status = 'cancelada' OR
    (NEW.autor_id <> p.porta_voz_id AND NEW.autor_id IS DISTINCT FROM p.reservada_por_id
     AND author_role IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'mission_chat_forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO active_id FROM mission_assignments
  WHERE mission_id = p.id AND ended_at IS NULL;
  IF NEW.assignment_id IS NOT NULL AND NEW.assignment_id IS DISTINCT FROM active_id THEN
    RAISE EXCEPTION 'mission_chat_forbidden' USING ERRCODE = '42501';
  END IF;
  NEW.assignment_id := active_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mission_owner_guard_message ON mensagens;
CREATE TRIGGER mission_owner_guard_message BEFORE INSERT ON mensagens
FOR EACH ROW EXECUTE FUNCTION mission_owner_guard_message();

COMMIT;
