-- Colunas de URLs de vídeo (R2)
ALTER TABLE pautas
ADD COLUMN IF NOT EXISTS video_bruto_url TEXT,
ADD COLUMN IF NOT EXISTS video_entrega_url TEXT;

-- Colunas das Regras do TSE
ALTER TABLE users
ADD COLUMN IF NOT EXISTS marca_dagua TEXT,
ADD COLUMN IF NOT EXISTS cnpj_campanha TEXT,
ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;

ALTER TABLE pautas
ADD COLUMN IF NOT EXISTS marca_dagua TEXT,
ADD COLUMN IF NOT EXISTS cnpj_campanha TEXT,
ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;
