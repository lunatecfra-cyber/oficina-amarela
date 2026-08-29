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

ALTER TABLE users ADD COLUMN IF NOT EXISTS codigo_indicacao UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE users ADD COLUMN IF NOT EXISTS indicado_por_id INT REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_codigo_indicacao ON users (codigo_indicacao);

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

ALTER TABLE ranking_ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE convites_porta_voz ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicacoes_recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios_constancia ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_admin ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS oficina_private;

CREATE OR REPLACE FUNCTION oficina_private.criar_porta_voz_com_convite(
  p_token_hash TEXT,
  p_email TEXT,
  p_apelido TEXT,
  p_nome TEXT,
  p_senha_hash TEXT,
  p_google_id TEXT,
  p_foto_url TEXT,
  p_codigo_indicacao UUID
) RETURNS TABLE (id INT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_convite_id BIGINT;
  v_user_id INT;
BEGIN
  SELECT c.id INTO v_convite_id
  FROM convites_porta_voz c
  WHERE c.token_hash = p_token_hash
    AND lower(c.email) = lower(p_email)
    AND c.usado_em IS NULL
    AND c.revogado_em IS NULL
    AND c.expira_em > now()
  FOR UPDATE;

  IF v_convite_id IS NULL THEN
    RAISE EXCEPTION 'CONVITE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO users (
    apelido, nome, email, senha_hash, google_id, papel, foto_url, indicado_por_id
  ) VALUES (
    p_apelido,
    p_nome,
    p_email,
    p_senha_hash,
    p_google_id,
    'voz',
    p_foto_url,
    (SELECT u.id FROM users u WHERE u.codigo_indicacao = p_codigo_indicacao)
  ) RETURNING users.id INTO v_user_id;

  UPDATE convites_porta_voz
  SET usado_em = now(), usado_por = v_user_id
  WHERE convites_porta_voz.id = v_convite_id;

  INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
  SELECT criado_por, 'convite_consumido', 'convite_porta_voz', id::text,
         jsonb_build_object('email', email, 'user_id', v_user_id)
  FROM convites_porta_voz WHERE convites_porta_voz.id = v_convite_id;

  RETURN QUERY SELECT v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION oficina_private.criar_porta_voz_com_convite(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;

CREATE OR REPLACE FUNCTION oficina_private.aprovar_edicao(
  p_pauta_id INT,
  p_aprovado_por INT,
  p_status_final TEXT,
  p_nota INT,
  p_comentario TEXT
) RETURNS TABLE (editor_id INT, pontuou BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_editor_id INT;
  v_pontuada BOOLEAN;
  v_ciclo_id BIGINT;
BEGIN
  IF p_status_final NOT IN ('aprovada', 'finalizada') THEN
    RAISE EXCEPTION 'STATUS_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  SELECT reservada_por_id, pontuada INTO v_editor_id, v_pontuada
  FROM pautas WHERE pautas.id = p_pauta_id AND status = 'em_revisao'
  FOR UPDATE;
  IF v_editor_id IS NULL THEN
    RAISE EXCEPTION 'PAUTA_FORA_DE_REVISAO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE pautas
  SET status = p_status_final, notas_inspetor = NULL, reedicao_pedida_por = NULL,
      pontuada = true
  WHERE pautas.id = p_pauta_id;

  IF v_pontuada THEN
    RETURN QUERY SELECT v_editor_id, false;
    RETURN;
  END IF;

  IF p_nota IS NOT NULL THEN
    INSERT INTO avaliacoes (pauta_id, editor_id, nota, comentario)
    VALUES (p_pauta_id, v_editor_id, p_nota, nullif(trim(p_comentario), ''));
  END IF;

  UPDATE users
  SET entregues = entregues + 1, reputacao = reputacao + 25, streak = streak + 1
  WHERE users.id = v_editor_id;

  UPDATE users u
  SET nota = (SELECT round(avg(a.nota)::numeric, 2) FROM avaliacoes a WHERE a.editor_id = u.id)
  WHERE u.id = v_editor_id;

  SELECT id INTO v_ciclo_id FROM ranking_ciclos
  WHERE congelado_em IS NULL AND now() BETWEEN inicia_em AND termina_em
  ORDER BY inicia_em DESC LIMIT 1;

  IF v_ciclo_id IS NOT NULL THEN
    INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_por)
    VALUES (p_pauta_id, v_ciclo_id, v_editor_id, p_aprovado_por)
    ON CONFLICT (pauta_id) DO UPDATE SET
      ciclo_id = EXCLUDED.ciclo_id,
      editor_id = EXCLUDED.editor_id,
      aprovado_por = EXCLUDED.aprovado_por,
      aprovado_em = now(),
      anulado_em = NULL,
      anulado_por = NULL,
      motivo_anulacao = NULL
    WHERE ranking_aprovacoes.anulado_em IS NOT NULL;
  END IF;

  INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
  VALUES (p_aprovado_por, 'edicao_aprovada', 'pauta', p_pauta_id::text,
          jsonb_build_object('editorId', v_editor_id));

  RETURN QUERY SELECT v_editor_id, true;
END;
$$;

REVOKE ALL ON FUNCTION oficina_private.aprovar_edicao(INT, INT, TEXT, INT, TEXT) FROM PUBLIC;
