-- Caixa de saída de e-mail.
--
-- O broadcast disparava um `void notify...()` por destinatário dentro da
-- requisição. Em ambiente serverless a promessa solta morre junto com a
-- resposta, então boa parte dos e-mails simplesmente não saía — e não havia
-- retentativa, registro de falha nem proteção contra envio duplicado.
--
-- A tabela é o equivalente local de uma Cloudflare Queue: enfileirar aqui,
-- drenar em outro momento. Na migração, muda quem dispara a drenagem; o
-- contrato (chave de idempotência, retentativa com recuo, marca de envio)
-- continua o mesmo.

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
