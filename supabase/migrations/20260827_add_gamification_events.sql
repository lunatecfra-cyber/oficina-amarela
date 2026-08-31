-- Gamificação: regras e eventos.
--
-- Os nomes aqui são os do schema em produção — `gamificacao_regras` e
-- `gamificacao_eventos`. Esta migração criava `gamification_rules` e
-- `gamification_events`, em inglês: tabelas que nenhuma consulta do sistema
-- lê. Quem aplicasse as migrações em ordem num banco novo ficava com duas
-- tabelas órfãs e sem as que o código usa.
--
-- O XP mora aqui e em packages/db/src/gamification.ts. São os mesmos valores:
-- 25 pela entrada do dia, 100 por vídeo entregue.
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
  ('entrada_diaria', 'Entrou no site', 'Acesse a Oficina Amarela hoje.', 25, 'daily'),
  ('missao_entregue', 'Entregou um vídeo', 'Cada vídeo entregue soma 100 XP.', 100, 'one_time')
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

CREATE INDEX IF NOT EXISTS idx_gamificacao_eventos_user_data
  ON gamificacao_eventos (user_id, criado_em DESC);
