-- Schema canônico da Oficina Amarela (Supabase / PostgreSQL)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  apelido TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  senha_hash TEXT,
  google_id TEXT,
  papel TEXT NOT NULL CHECK (papel IN ('voz', 'editor', 'admin')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  sessoes_validas_apos TIMESTAMPTZ NOT NULL DEFAULT now(),
  headline TEXT,
  bio TEXT,
  localizacao TEXT,
  entregues INT NOT NULL DEFAULT 0,
  reputacao INT NOT NULL DEFAULT 0,
  streak INT NOT NULL DEFAULT 0,
  nota NUMERIC(3,2),
  nivel TEXT GENERATED ALWAYS AS (
    CASE
      WHEN entregues >= 60 THEN 'Mestre-Artesão'
      WHEN entregues >= 30 THEN 'Artífice'
      WHEN entregues >= 10 THEN 'Oficial'
      ELSE 'Aprendiz'
    END
  ) STORED,
  travado_reservas_ate TIMESTAMPTZ,
  banido BOOLEAN NOT NULL DEFAULT false,
  banido_em TIMESTAMPTZ,
  motivo_banimento TEXT,
  softwares TEXT[],
  estilos TEXT[],
  link_portfolio TEXT,
  disponibilidade JSONB,
  perfil_completo BOOLEAN NOT NULL DEFAULT false,
  nivel_edicao TEXT,
  setup_pc TEXT,
  nicho TEXT[],
  foto_url TEXT,
  cargo TEXT,
  disputa_por TEXT,
  ano_eleicao TEXT,
  bandeiras TEXT[],
  tom_comunicacao TEXT,
  palavras_chave TEXT[],
  redes_sociais JSONB,
  marca_dagua TEXT,
  cnpj_campanha TEXT,
  titulo_eleitor TEXT,
  ultimo_visto_em TIMESTAMPTZ,
  codigo_indicacao UUID NOT NULL DEFAULT gen_random_uuid(),
  indicado_por_id INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apelido ON users (lower(apelido));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_codigo_indicacao ON users (codigo_indicacao);

CREATE TABLE IF NOT EXISTS tentativas_login (
  chave TEXT PRIMARY KEY,
  tentativas INT NOT NULL DEFAULT 0,
  primeira_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  travado_ate TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pautas (
  id SERIAL PRIMARY KEY,
  porta_voz_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('short', 'longo')),
  brief_tom TEXT,
  brief_cor TEXT,
  brief_fonte TEXT,
  brief_refs TEXT,
  drive_link TEXT,
  youtube_link TEXT,
  video_bruto_url TEXT,
  video_entrega_url TEXT,
  entrega_link TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel', 'oferecida', 'reservada', 'em_revisao', 'reedicao', 'aprovada', 'finalizada')),
  reservada_por_id INT REFERENCES users(id) ON DELETE SET NULL,
  reservada_em TIMESTAMPTZ,
  reservada_ate TIMESTAMPTZ,
  notas_inspetor TEXT,
  reedicao_pedida_por TEXT CHECK (reedicao_pedida_por IN ('inspetor', 'porta_voz')),
  extras TEXT,
  motivo TEXT,
  prazo_desejado TEXT,
  marca_dagua TEXT,
  cnpj_campanha TEXT,
  titulo_eleitor TEXT,
  prioridade INT NOT NULL DEFAULT 0,
  pontuada BOOLEAN NOT NULL DEFAULT false,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pautas_status ON pautas (status);

-- Ordem da fila de despacho: evita sort em dispatchMissions().
CREATE INDEX IF NOT EXISTS idx_pautas_fila
  ON pautas (prioridade DESC, criada_em ASC)
  WHERE status IN ('disponivel', 'oferecida');
CREATE INDEX IF NOT EXISTS idx_pautas_porta_voz ON pautas (porta_voz_id);
CREATE INDEX IF NOT EXISTS idx_pautas_reservada_por ON pautas (reservada_por_id);

-- Invariante: um editor segura no máximo uma missão ativa por vez.
-- Mesmo conjunto de status usado por reserveMission() e getNextEditor().
CREATE UNIQUE INDEX IF NOT EXISTS idx_pautas_missao_ativa_por_editor
  ON pautas (reservada_por_id)
  WHERE reservada_por_id IS NOT NULL
    AND status IN ('reservada', 'em_revisao', 'reedicao');

CREATE TABLE IF NOT EXISTS portfolio (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('short', 'longo')),
  porta_voz TEXT NOT NULL,
  tint TEXT,
  link_video TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio (user_id);

CREATE TABLE IF NOT EXISTS conquistas (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL,
  conquistada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conquistas_user ON conquistas (user_id);

CREATE TABLE IF NOT EXISTS ofertas (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aceita', 'rejeitada', 'expirada')),
  oferecida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondida_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL,
  ordem INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ofertas_editor_status ON ofertas (editor_id, status);
CREATE INDEX IF NOT EXISTS idx_ofertas_pauta ON ofertas (pauta_id);

-- Varredura de expiração de ofertas.
CREATE INDEX IF NOT EXISTS idx_ofertas_pendentes ON ofertas (oferecida_em) WHERE status = 'pendente';

-- Invariante: um editor recebe no máximo uma oferta por missão.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_missao_editor ON ofertas (pauta_id, editor_id);

-- Caixa de saída de e-mail: enfileirar na requisição, enviar depois, com chave
-- de idempotência e retentativa. Ver lib/email-queue-db.ts.
CREATE TABLE IF NOT EXISTS fila_emails (
  id BIGSERIAL PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  html TEXT NOT NULL,
  tentativas INT NOT NULL DEFAULT 0,
  processar_apos TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  erro TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fila_emails_pendentes
  ON fila_emails (processar_apos)
  WHERE enviado_em IS NULL;

-- Trava de periodicidade: só uma requisição por janela roda o trabalho global
-- (expiração de ofertas, despacho). Ver lib/scheduler-db.ts.
CREATE TABLE IF NOT EXISTS tarefas_periodicas (
  nome TEXT PRIMARY KEY,
  executada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensagens (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  autor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_pauta ON mensagens (pauta_id);

CREATE TABLE IF NOT EXISTS denuncias (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  denunciante_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  denunciado_id INT REFERENCES users(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'resolvida', 'ignorada')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvida_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias (status);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_editor ON avaliacoes (editor_id);

CREATE TABLE IF NOT EXISTS musicas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  url TEXT NOT NULL,
  tamanho INTEGER,
  adicionado_por INT REFERENCES users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_musicas_tags ON musicas USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_musicas_criado_em ON musicas (criado_em DESC);

CREATE TABLE IF NOT EXISTS novidades (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  publicada BOOLEAN NOT NULL DEFAULT true,
  autor_id INT REFERENCES users(id) ON DELETE SET NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gamificacao_regras (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  xp INT NOT NULL CHECK (xp > 0),
  ciclo TEXT NOT NULL CHECK (ciclo IN ('daily', 'one_time')),
  ativa BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO gamificacao_regras (id, titulo, descricao, xp, ciclo)
VALUES
  ('entrada_diaria', 'Entrou no site', 'Acesse a Oficina Amarela hoje.', 10, 'daily'),
  ('missao_entregue', 'Entregue uma missão hoje', 'Envie uma edição válida para revisão.', 40, 'one_time')
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  xp = EXCLUDED.xp,
  ciclo = EXCLUDED.ciclo,
  ativa = true;

CREATE TABLE IF NOT EXISTS gamificacao_eventos (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  regra_id TEXT NOT NULL,
  referencia TEXT NOT NULL,
  xp INT NOT NULL CHECK (xp > 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, regra_id, referencia)
);

CREATE INDEX IF NOT EXISTS idx_gamificacao_eventos_user_date
  ON gamificacao_eventos (user_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS ranking_ciclos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  inicia_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  termina_em TIMESTAMPTZ NOT NULL,
  congelado_em TIMESTAMPTZ,
  max_editores_ativos INT NOT NULL DEFAULT 0 CHECK (max_editores_ativos >= 0),
  criado_por INT REFERENCES users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ranking_ciclos_periodo_check CHECK (termina_em > inicia_em)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_ciclo_aberto
  ON ranking_ciclos ((congelado_em IS NULL))
  WHERE congelado_em IS NULL;

INSERT INTO ranking_ciclos (nome, termina_em)
SELECT 'Eleições gerais de 2026', '2026-10-26 02:59:59.999+00'
WHERE NOT EXISTS (SELECT 1 FROM ranking_ciclos WHERE congelado_em IS NULL);

CREATE TABLE IF NOT EXISTS ranking_aprovacoes (
  pauta_id INT PRIMARY KEY REFERENCES pautas(id) ON DELETE CASCADE,
  ciclo_id BIGINT NOT NULL REFERENCES ranking_ciclos(id) ON DELETE RESTRICT,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aprovado_por INT REFERENCES users(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulado_em TIMESTAMPTZ,
  anulado_por INT REFERENCES users(id) ON DELETE SET NULL,
  motivo_anulacao TEXT,
  CONSTRAINT ranking_aprovacoes_anulacao_check CHECK (
    (anulado_em IS NULL AND anulado_por IS NULL AND motivo_anulacao IS NULL)
    OR (anulado_em IS NOT NULL AND anulado_por IS NOT NULL AND length(trim(motivo_anulacao)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_ranking_aprovacoes_editor
  ON ranking_aprovacoes (ciclo_id, editor_id, aprovado_em)
  WHERE anulado_em IS NULL;

CREATE TABLE IF NOT EXISTS convites_porta_voz (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  criado_por INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  usado_por INT REFERENCES users(id) ON DELETE SET NULL,
  revogado_em TIMESTAMPTZ,
  revogado_por INT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT convites_porta_voz_validade_check CHECK (expira_em > criado_em),
  CONSTRAINT convites_porta_voz_uso_check CHECK (
    (usado_em IS NULL AND usado_por IS NULL) OR (usado_em IS NOT NULL AND usado_por IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_convites_porta_voz_email
  ON convites_porta_voz (lower(email), expira_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_convites_porta_voz_email_aberto
  ON convites_porta_voz (lower(email))
  WHERE usado_em IS NULL AND revogado_em IS NULL;

CREATE TABLE IF NOT EXISTS indicacoes_recompensas (
  convidado_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  convidador_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pontos INT NOT NULL DEFAULT 100 CHECK (pontos = 100),
  premiado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  revogado_em TIMESTAMPTZ,
  motivo_revogacao TEXT,
  CONSTRAINT indicacoes_pessoas_diferentes CHECK (convidado_id <> convidador_id)
);

CREATE INDEX IF NOT EXISTS idx_indicacoes_recompensas_mes
  ON indicacoes_recompensas (convidador_id, premiado_em)
  WHERE revogado_em IS NULL;

CREATE TABLE IF NOT EXISTS bloqueios_constancia (
  id BIGSERIAL PRIMARY KEY,
  editor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  concedido_por INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  motivo TEXT NOT NULL CHECK (length(trim(motivo)) > 0),
  concedido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumido_semana DATE,
  consumido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bloqueios_constancia_disponiveis
  ON bloqueios_constancia (editor_id, concedido_em)
  WHERE consumido_em IS NULL;

CREATE TABLE IF NOT EXISTS auditoria_admin (
  id BIGSERIAL PRIMARY KEY,
  ator_id INT REFERENCES users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_admin_criado_em
  ON auditoria_admin (criado_em DESC);
