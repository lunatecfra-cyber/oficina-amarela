-- Trava de periodicidade para trabalho global disparado por requisição.
--
-- expireStaleOffers() e dispatchMissions() são varreduras globais: rodavam uma
-- vez por poll de cada editor. Com 1.000 editores em 15s isso é ~67 varreduras
-- por segundo fazendo o mesmo trabalho. A tabela abaixo deixa apenas uma
-- requisição por janela executar a varredura; as outras seguem direto.
--
-- Equivale a um Cron Trigger / consumidor de fila no destino Cloudflare — a
-- diferença é só quem dispara.

CREATE TABLE IF NOT EXISTS tarefas_periodicas (
  nome TEXT PRIMARY KEY,
  executada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices da fila de despacho.

-- Já existia em produção via scripts/migrar-prioridade.mjs, mas nunca entrou no
-- schema canônico. Serve o ORDER BY de dispatchMissions() sem sort.
CREATE INDEX IF NOT EXISTS idx_pautas_fila
  ON pautas (prioridade DESC, criada_em ASC)
  WHERE status IN ('disponivel', 'oferecida');

-- Varredura de expiração: hoje faz scan por status.
CREATE INDEX IF NOT EXISTS idx_ofertas_pendentes
  ON ofertas (oferecida_em)
  WHERE status = 'pendente';
