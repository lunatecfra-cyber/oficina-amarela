-- First D1 slice only: mission lifecycle, offer queue invariants, and outbox idempotency.
-- Timestamps use sortable UTC ISO-8601 text throughout this slice.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apelido TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  papel TEXT NOT NULL CHECK (papel IN ('voz', 'editor', 'admin')),
  ultimo_visto_em TEXT,
  travado_reservas_ate TEXT,
  disponibilidade TEXT,
  entregues INTEGER NOT NULL DEFAULT 0,
  reputacao INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pautas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  porta_voz_id INTEGER NOT NULL REFERENCES users(id),
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel',
  prioridade INTEGER NOT NULL DEFAULT 0,
  drive_link TEXT,
  youtube_link TEXT,
  brief_tom TEXT,
  brief_cor TEXT,
  brief_fonte TEXT,
  brief_refs TEXT,
  extras TEXT,
  motivo TEXT,
  prazo_desejado TEXT,
  reservada_por_id INTEGER REFERENCES users(id),
  reservada_ate TEXT,
  reservada_em TEXT,
  entrega_link TEXT,
  video_entrega_url TEXT,
  notas_inspetor TEXT,
  reedicao_pedida_por TEXT,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One active mission per editor. Durable Objects may coordinate claims later;
-- this index remains the durable database invariant.
CREATE UNIQUE INDEX idx_pautas_missao_ativa_por_editor
  ON pautas (reservada_por_id)
  WHERE reservada_por_id IS NOT NULL
    AND status IN ('reservada', 'em_revisao', 'reedicao');
CREATE INDEX idx_pautas_fila
  ON pautas (prioridade DESC, criada_em ASC)
  WHERE status IN ('disponivel', 'oferecida');
CREATE INDEX idx_pautas_porta_voz ON pautas (porta_voz_id);
CREATE INDEX idx_pautas_reservada_por ON pautas (reservada_por_id);

CREATE TABLE mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  autor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_mensagens_pauta ON mensagens (pauta_id, criada_em);

CREATE TABLE denuncias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  denunciante_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denunciado_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'resolvida', 'ignorada')),
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolvida_em TEXT
);

CREATE INDEX idx_denuncias_status ON denuncias (status, criada_em);

CREATE TABLE ofertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  oferecida_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em TEXT NOT NULL,
  respondida_em TEXT,
  ordem INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_ofertas_missao_editor ON ofertas (pauta_id, editor_id);
CREATE UNIQUE INDEX idx_ofertas_pendente_por_missao
  ON ofertas (pauta_id) WHERE status = 'pendente';
CREATE UNIQUE INDEX idx_ofertas_pendente_por_editor
  ON ofertas (editor_id) WHERE status = 'pendente';
CREATE INDEX idx_ofertas_editor_status ON ofertas (editor_id, status);
CREATE INDEX idx_ofertas_pauta ON ofertas (pauta_id);
CREATE INDEX idx_ofertas_pendentes
  ON ofertas (oferecida_em) WHERE status = 'pendente';

-- D1/SQLite cannot express PostgreSQL's data-modifying CTEs. These triggers
-- keep the same all-or-nothing boundary inside the database statement.
CREATE TRIGGER claim_mission_on_pending_offer
AFTER INSERT ON ofertas
WHEN NEW.status = 'pendente'
BEGIN
  UPDATE pautas SET status = 'oferecida'
  WHERE id = NEW.pauta_id AND status IN ('disponivel', 'oferecida');
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_unavailable') END;
END;

CREATE TRIGGER reserve_mission_on_offer_accept
AFTER UPDATE OF status ON ofertas
WHEN OLD.status = 'pendente' AND NEW.status = 'aceita'
BEGIN
  UPDATE pautas
  SET status = 'reservada', reservada_por_id = NEW.editor_id,
      reservada_em = NEW.respondida_em
  WHERE id = NEW.pauta_id AND status = 'oferecida';
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'offer_invalid') END;
END;

CREATE TRIGGER release_mission_on_offer_close
AFTER UPDATE OF status ON ofertas
WHEN OLD.status = 'pendente' AND NEW.status IN ('rejeitada', 'expirada')
BEGIN
  UPDATE pautas SET status = 'disponivel'
  WHERE id = NEW.pauta_id AND status = 'oferecida';
END;

CREATE TABLE fila_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL UNIQUE
);
