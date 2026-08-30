-- Invariantes de concorrência da fila de missões.
--
-- Antes desta migração, duas regras do produto existiam apenas em código, com
-- uma janela de corrida entre a checagem e a escrita:
--
--   1. um editor só pode segurar UMA missão ativa por vez;
--   2. um editor só pode receber UMA oferta por missão.
--
-- Ambas passam a ser garantidas pelo banco. O código continua checando antes
-- (mensagem melhor pro usuário), mas a violação de unicidade é a resposta
-- autoritativa.
--
-- NÃO é idempotente contra dados sujos: se já existir editor com duas missões
-- ativas ou oferta duplicada, a criação do índice falha. Use
-- scripts/migrar-invariantes-concorrencia.mjs, que aponta os conflitos antes
-- de tentar.

-- (1) Uma missão ativa por editor.
-- O conjunto "ativo" é o mesmo usado por reserveMission() e getNextEditor():
-- 'aprovada' e 'finalizada' não ocupam o editor, e 'disponivel'/'oferecida'
-- não têm dono.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pautas_missao_ativa_por_editor
  ON pautas (reservada_por_id)
  WHERE reservada_por_id IS NOT NULL
    AND status IN ('reservada', 'em_revisao', 'reedicao');

-- (2) Uma oferta por (missão, editor).
-- dispatchMissions() já tratava o erro 23505 como "esse editor já viu essa
-- missão", mas a restrição não existia — o catch nunca disparava.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_missao_editor
  ON ofertas (pauta_id, editor_id);
