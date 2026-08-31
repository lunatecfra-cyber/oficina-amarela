-- Colunas de URLs de vídeo (R2) e das regras do TSE.
--
-- IF NOT EXISTS em toda coluna: sem ele, reaplicar parava com "column already
-- exists", e migração que só roda uma vez na vida não serve pra banco que já
-- recebeu parte do caminho.
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
