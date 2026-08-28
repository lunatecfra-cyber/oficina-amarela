CREATE TABLE IF NOT EXISTS gamificacao_regras (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  xp INT NOT NULL CHECK (xp > 0),
  ciclo TEXT NOT NULL CHECK (ciclo IN ('diario', 'unico')),
  ativa BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO gamificacao_regras (id, titulo, descricao, xp, ciclo)
VALUES
  ('entrada_diaria', 'Entrou no site', 'Acesse a Oficina Amarela hoje.', 10, 'diario'),
  ('missao_entregue', 'Entregue uma missão hoje', 'Envie uma edição válida para revisão.', 40, 'unico')
ON CONFLICT (id) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  xp = EXCLUDED.xp,
  ciclo = EXCLUDED.ciclo,
  ativa = true;

CREATE TABLE IF NOT EXISTS gamificacao_eventos (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  regra_id TEXT NOT NULL REFERENCES gamificacao_regras(id),
  referencia TEXT NOT NULL,
  xp INT NOT NULL CHECK (xp > 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, regra_id, referencia)
);

CREATE INDEX IF NOT EXISTS idx_gamificacao_eventos_usuario_data
  ON gamificacao_eventos (user_id, criado_em DESC);
