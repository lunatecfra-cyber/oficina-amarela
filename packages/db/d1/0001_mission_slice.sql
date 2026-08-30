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
  reputacao INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  nota REAL,
  indicado_por_id INTEGER REFERENCES users(id)
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
  pontuada INTEGER NOT NULL DEFAULT 0 CHECK (pontuada IN (0, 1)),
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

CREATE TABLE avaliacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_avaliacoes_editor ON avaliacoes (editor_id);

CREATE TABLE ranking_ciclos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  inicia_em TEXT NOT NULL,
  termina_em TEXT NOT NULL,
  congelado_em TEXT
);

CREATE TABLE ranking_aprovacoes (
  pauta_id INTEGER PRIMARY KEY REFERENCES pautas(id) ON DELETE CASCADE,
  ciclo_id INTEGER NOT NULL REFERENCES ranking_ciclos(id),
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aprovado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  aprovado_em TEXT NOT NULL,
  anulado_em TEXT,
  anulado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  motivo_anulacao TEXT
);

CREATE INDEX idx_ranking_aprovacoes_editor
  ON ranking_aprovacoes (ciclo_id, editor_id, aprovado_em)
  WHERE anulado_em IS NULL;

CREATE TABLE indicacoes_recompensas (
  convidado_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  convidador_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pontos INTEGER NOT NULL DEFAULT 100 CHECK (pontos = 100),
  premiado_em TEXT NOT NULL,
  revogado_em TEXT,
  motivo_revogacao TEXT
);

CREATE TABLE auditoria_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes TEXT NOT NULL DEFAULT '{}',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One durable approval event per mission. The trigger keeps every scoring side
-- effect in the same D1 statement, so retries and concurrent requests cannot
-- double-score even without PostgreSQL row locks.
CREATE TABLE mission_approvals (
  pauta_id INTEGER PRIMARY KEY REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aprovado_por INTEGER NOT NULL REFERENCES users(id),
  status_final TEXT NOT NULL CHECK (status_final IN ('aprovada', 'finalizada')),
  nota INTEGER CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  aprovado_em TEXT NOT NULL
);

CREATE TRIGGER apply_mission_approval
AFTER INSERT ON mission_approvals
BEGIN
  UPDATE pautas
  SET status = NEW.status_final, notas_inspetor = NULL,
      reedicao_pedida_por = NULL, pontuada = 1
  WHERE id = NEW.pauta_id AND status = 'em_revisao' AND pontuada = 0;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_not_in_review') END;

  INSERT INTO avaliacoes (pauta_id, editor_id, nota, comentario)
  SELECT NEW.pauta_id, NEW.editor_id, NEW.nota, nullif(trim(NEW.comentario), '')
  WHERE NEW.nota IS NOT NULL;

  UPDATE users
  SET entregues = entregues + 1, reputacao = reputacao + 25, streak = streak + 1
  WHERE id = NEW.editor_id;
  UPDATE users
  SET nota = (SELECT round(avg(nota), 2) FROM avaliacoes WHERE editor_id = NEW.editor_id)
  WHERE id = NEW.editor_id;

  INSERT INTO ranking_aprovacoes (
    pauta_id, ciclo_id, editor_id, aprovado_por, aprovado_em
  )
  SELECT NEW.pauta_id, id, NEW.editor_id, NEW.aprovado_por, NEW.aprovado_em
  FROM ranking_ciclos
  WHERE congelado_em IS NULL
    AND NEW.aprovado_em BETWEEN inicia_em AND termina_em
  ORDER BY inicia_em DESC LIMIT 1
  ON CONFLICT (pauta_id) DO UPDATE SET
    ciclo_id = excluded.ciclo_id,
    editor_id = excluded.editor_id,
    aprovado_por = excluded.aprovado_por,
    aprovado_em = excluded.aprovado_em,
    anulado_em = NULL,
    anulado_por = NULL,
    motivo_anulacao = NULL
  WHERE ranking_aprovacoes.anulado_em IS NOT NULL;

  INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes, criado_em)
  VALUES (
    NEW.aprovado_por, 'edicao_aprovada', 'pauta', CAST(NEW.pauta_id AS TEXT),
    json_object('editorId', NEW.editor_id), NEW.aprovado_em
  );

  INSERT OR IGNORE INTO indicacoes_recompensas (
    convidado_id, convidador_id, premiado_em
  )
  SELECT NEW.editor_id, indicado_por_id, NEW.aprovado_em
  FROM users
  WHERE id = NEW.editor_id AND indicado_por_id IS NOT NULL
    AND (SELECT count(*) FROM ranking_aprovacoes
         WHERE editor_id = NEW.editor_id AND anulado_em IS NULL) >= 2
    AND (SELECT count(*) FROM indicacoes_recompensas
         WHERE convidador_id = users.indicado_por_id AND revogado_em IS NULL
           AND premiado_em >= substr(NEW.aprovado_em, 1, 7) || '-01T00:00:00.000Z') < 5;
  UPDATE users SET reputacao = reputacao + 100
  WHERE id = (SELECT convidador_id FROM indicacoes_recompensas
              WHERE convidado_id = NEW.editor_id)
    AND changes() = 1;
END;

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
