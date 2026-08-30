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

CREATE TABLE fila_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL UNIQUE
);
