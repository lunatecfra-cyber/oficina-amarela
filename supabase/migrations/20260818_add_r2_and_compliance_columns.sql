-- URLs de vídeo (R2/S3) e dados de conformidade eleitoral.
--
-- Esta migração nomeava `missions`, `watermark`, `campaign_tax_id` e
-- `voter_id` — o vocabulário em inglês. O schema em produção é o PT-BR
-- (`pautas`, `marca_dagua`, `cnpj_campanha`, `titulo_eleitor`), então aplicar
-- as migrações em ordem parava aqui com "relation missions does not exist" e
-- nenhuma das seguintes chegava a rodar.
--
-- Cobre o mesmo terreno que a 20260818_add_r2_and_tse_columns.sql. As duas
-- ficam: migração aplicada é registro histórico, e as duas são idempotentes.
ALTER TABLE pautas
ADD COLUMN IF NOT EXISTS video_bruto_url TEXT,
ADD COLUMN IF NOT EXISTS video_entrega_url TEXT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS marca_dagua TEXT,
ADD COLUMN IF NOT EXISTS cnpj_campanha TEXT,
ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;

ALTER TABLE pautas
ADD COLUMN IF NOT EXISTS marca_dagua TEXT,
ADD COLUMN IF NOT EXISTS cnpj_campanha TEXT,
ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;
