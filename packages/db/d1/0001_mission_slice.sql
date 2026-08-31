-- Schema D1 da Oficina Amarela.
--
-- Aplicar com `node scripts/aplicar-schema-d1.mjs <ambiente>`, nunca com
-- `wrangler d1 migrations apply`: o splitter de migração corta em ";" e quebra
-- o corpo dos CREATE TRIGGER, falhando com "incomplete input" no meio do
-- arquivo e deixando o banco pela metade.
--
-- Todo comando é IF NOT EXISTS, então reaplicar é seguro — inclusive depois de
-- uma falha parcial.

-- First D1 slice only: mission lifecycle, offer queue invariants, and outbox idempotency.
-- Timestamps use sortable UTC ISO-8601 text throughout this slice.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apelido TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  papel TEXT NOT NULL CHECK (papel IN ('voz', 'editor', 'admin')),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Corte de revogação de sessão: banimento, troca de senha e "sair de todos os
  -- aparelhos" movem esta data para frente, e todo JWT emitido antes dela morre.
  -- Sem esta coluna o D1 não teria como revogar sessão nenhuma.
  sessoes_validas_apos TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  banido INTEGER NOT NULL DEFAULT 0,
  banido_em TEXT,
  motivo_banimento TEXT,
  senha_hash TEXT,
  google_id TEXT,
  foto_url TEXT,
  codigo_indicacao TEXT,
  ultimo_visto_em TEXT,
  travado_reservas_ate TEXT,
  disponibilidade TEXT,
  entregues INTEGER NOT NULL DEFAULT 0,
  reputacao INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  nota REAL,
  nivel TEXT,
  headline TEXT,
  bio TEXT,
  localizacao TEXT,
  softwares TEXT,
  estilos TEXT,
  link_portfolio TEXT,
  perfil_completo INTEGER NOT NULL DEFAULT 0,
  nivel_edicao TEXT,
  setup_pc TEXT,
  nicho TEXT,
  cargo TEXT,
  disputa_por TEXT,
  ano_eleicao TEXT,
  bandeiras TEXT,
  tom_comunicacao TEXT,
  palavras_chave TEXT,
  redes_sociais TEXT,
  marca_dagua TEXT,
  cnpj_campanha TEXT,
  titulo_eleitor TEXT,
  indicado_por_id INTEGER REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apelido ON users (lower(apelido));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_codigo_indicacao
  ON users (codigo_indicacao) WHERE codigo_indicacao IS NOT NULL;

CREATE TABLE IF NOT EXISTS pautas (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_pautas_missao_ativa_por_editor
  ON pautas (reservada_por_id)
  WHERE reservada_por_id IS NOT NULL
    AND status IN ('reservada', 'em_revisao', 'reedicao');
CREATE INDEX IF NOT EXISTS idx_pautas_fila
  ON pautas (prioridade DESC, criada_em ASC)
  WHERE status IN ('disponivel', 'oferecida');
CREATE INDEX IF NOT EXISTS idx_pautas_porta_voz ON pautas (porta_voz_id);
CREATE INDEX IF NOT EXISTS idx_pautas_reservada_por ON pautas (reservada_por_id);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  autor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_mensagens_pauta ON mensagens (pauta_id, criada_em);

CREATE TABLE IF NOT EXISTS denuncias (
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

CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias (status, criada_em);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_editor ON avaliacoes (editor_id);

CREATE TABLE IF NOT EXISTS ranking_ciclos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  inicia_em TEXT NOT NULL,
  termina_em TEXT NOT NULL,
  congelado_em TEXT,
  -- Maior número de editores ativos já visto no ciclo. Ele só sobe: os prêmios
  -- destravados por marco não podem sumir porque a semana seguinte esvaziou.
  max_editores_ativos INTEGER NOT NULL DEFAULT 0,
  criado_por INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ranking_aprovacoes (
  pauta_id INTEGER PRIMARY KEY REFERENCES pautas(id) ON DELETE CASCADE,
  ciclo_id INTEGER NOT NULL REFERENCES ranking_ciclos(id),
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aprovado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  aprovado_em TEXT NOT NULL,
  anulado_em TEXT,
  anulado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  motivo_anulacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_ranking_aprovacoes_editor
  ON ranking_aprovacoes (ciclo_id, editor_id, aprovado_em)
  WHERE anulado_em IS NULL;

CREATE TABLE IF NOT EXISTS indicacoes_recompensas (
  convidado_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  convidador_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pontos INTEGER NOT NULL DEFAULT 100 CHECK (pontos = 100),
  premiado_em TEXT NOT NULL,
  revogado_em TEXT,
  motivo_revogacao TEXT
);

-- Limite de tentativas. Vale para login, recuperação, cadastro por IP e emissão
-- de URL de upload — a chave carrega o assunto. O estado mora no banco de
-- propósito: contador em memória de processo não vale nada quando há vários
-- isolates, que é exatamente o caso nos Workers.
CREATE TABLE IF NOT EXISTS tentativas_login (
  chave TEXT PRIMARY KEY,
  tentativas INTEGER NOT NULL DEFAULT 0,
  primeira_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  travado_ate TEXT
);

CREATE TABLE IF NOT EXISTS auditoria_admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes TEXT NOT NULL DEFAULT '{}',
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Eventos de gamificação. A unicidade por (usuário, regra, referência) é o que
-- torna o registro idempotente: o mesmo evento não pontua duas vezes, mesmo
-- que a chamada se repita.
CREATE TABLE IF NOT EXISTS gamificacao_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  regra_id TEXT NOT NULL CHECK (regra_id IN ('entrada_diaria', 'missao_entregue')),
  referencia TEXT NOT NULL,
  xp INTEGER NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, regra_id, referencia)
);

-- Bloqueios de constância concedidos pelo inspetor. O máximo de dois por editor
-- é regra de aplicação, não de esquema: o PostgreSQL também não tem índice que
-- a segure, e quem garante é a trava na linha do editor.
CREATE TABLE IF NOT EXISTS bloqueios_constancia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concedido_por INTEGER NOT NULL REFERENCES users(id),
  motivo TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
  concedido_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  consumido_semana TEXT,
  consumido_em TEXT
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_constancia_disponiveis
  ON bloqueios_constancia (editor_id, concedido_em)
  WHERE consumido_em IS NULL;

CREATE TABLE IF NOT EXISTS convites_porta_voz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  criado_por INTEGER NOT NULL REFERENCES users(id),
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em TEXT NOT NULL,
  usado_em TEXT,
  usado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  revogado_em TEXT,
  revogado_por INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_convites_porta_voz_email_aberto
  ON convites_porta_voz (lower(email))
  WHERE usado_em IS NULL AND revogado_em IS NULL;

-- The redemption row is the single-use invariant. Creating it inserts the
-- official spokesperson account, claims the invitation and writes the audit
-- record inside the same D1 statement.
CREATE TABLE IF NOT EXISTS invitation_redemptions (
  token_hash TEXT PRIMARY KEY REFERENCES convites_porta_voz(token_hash),
  email TEXT NOT NULL,
  apelido TEXT NOT NULL,
  nome TEXT NOT NULL,
  senha_hash TEXT,
  google_id TEXT,
  foto_url TEXT,
  codigo_indicacao TEXT,
  resgatado_em TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS apply_invitation_redemption
AFTER INSERT ON invitation_redemptions
BEGIN
  INSERT INTO users (
    apelido, nome, email, senha_hash, google_id, papel, foto_url, indicado_por_id
  ) VALUES (
    NEW.apelido, NEW.nome, NEW.email, NEW.senha_hash, NEW.google_id, 'voz', NEW.foto_url,
    (SELECT id FROM users WHERE codigo_indicacao = NEW.codigo_indicacao)
  );
  UPDATE convites_porta_voz
  SET usado_em = NEW.resgatado_em,
      usado_por = (SELECT id FROM users WHERE lower(email) = lower(NEW.email))
  WHERE token_hash = NEW.token_hash AND usado_em IS NULL AND revogado_em IS NULL;
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'invitation_unavailable') END;
  INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes, criado_em)
  SELECT criado_por, 'convite_consumido', 'convite_porta_voz', CAST(id AS TEXT),
         json_object('email', NEW.email, 'user_id', usado_por), NEW.resgatado_em
  FROM convites_porta_voz WHERE token_hash = NEW.token_hash;
END;

-- One durable approval event per mission. The trigger keeps every scoring side
-- effect in the same D1 statement, so retries and concurrent requests cannot
-- double-score even without PostgreSQL row locks.
CREATE TABLE IF NOT EXISTS mission_approvals (
  pauta_id INTEGER PRIMARY KEY REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aprovado_por INTEGER NOT NULL REFERENCES users(id),
  status_final TEXT NOT NULL CHECK (status_final IN ('aprovada', 'finalizada')),
  nota INTEGER CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  aprovado_em TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS apply_mission_approval
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

CREATE TABLE IF NOT EXISTS ofertas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pauta_id INTEGER NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  oferecida_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expira_em TEXT NOT NULL,
  respondida_em TEXT,
  ordem INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_missao_editor ON ofertas (pauta_id, editor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_pendente_por_missao
  ON ofertas (pauta_id) WHERE status = 'pendente';
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_pendente_por_editor
  ON ofertas (editor_id) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_ofertas_editor_status ON ofertas (editor_id, status);
CREATE INDEX IF NOT EXISTS idx_ofertas_pauta ON ofertas (pauta_id);
CREATE INDEX IF NOT EXISTS idx_ofertas_pendentes
  ON ofertas (oferecida_em) WHERE status = 'pendente';

-- D1/SQLite cannot express PostgreSQL's data-modifying CTEs. These triggers
-- keep the same all-or-nothing boundary inside the database statement.
CREATE TRIGGER IF NOT EXISTS claim_mission_on_pending_offer
AFTER INSERT ON ofertas
WHEN NEW.status = 'pendente'
BEGIN
  UPDATE pautas SET status = 'oferecida'
  WHERE id = NEW.pauta_id AND status IN ('disponivel', 'oferecida');
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'mission_unavailable') END;
END;

CREATE TRIGGER IF NOT EXISTS reserve_mission_on_offer_accept
AFTER UPDATE OF status ON ofertas
WHEN OLD.status = 'pendente' AND NEW.status = 'aceita'
BEGIN
  UPDATE pautas
  SET status = 'reservada', reservada_por_id = NEW.editor_id,
      reservada_em = NEW.respondida_em
  WHERE id = NEW.pauta_id AND status = 'oferecida';
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'offer_invalid') END;
END;

CREATE TRIGGER IF NOT EXISTS release_mission_on_offer_close
AFTER UPDATE OF status ON ofertas
WHEN OLD.status = 'pendente' AND NEW.status IN ('rejeitada', 'expirada')
BEGIN
  UPDATE pautas SET status = 'disponivel'
  WHERE id = NEW.pauta_id AND status = 'oferecida';
END;

CREATE TABLE IF NOT EXISTS fila_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('short', 'longo')),
  porta_voz TEXT NOT NULL,
  tint TEXT,
  link_video TEXT,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio (user_id);

CREATE TABLE IF NOT EXISTS conquistas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL,
  conquistada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conquistas_user ON conquistas (user_id);

CREATE TABLE IF NOT EXISTS novidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  publicada INTEGER NOT NULL DEFAULT 1,
  autor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS musicas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  url TEXT NOT NULL,
  tamanho INTEGER,
  adicionado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS gamificacao_regras (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  xp INTEGER NOT NULL,
  ciclo TEXT NOT NULL CHECK (ciclo IN ('daily', 'one_time')),
  ativa INTEGER NOT NULL DEFAULT 1
);

