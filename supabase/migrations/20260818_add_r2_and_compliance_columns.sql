-- URLs de vídeo (R2/S3) no schema canônico de produção.
ALTER TABLE pautas
ADD COLUMN IF NOT EXISTS video_bruto_url TEXT,
ADD COLUMN IF NOT EXISTS video_entrega_url TEXT;

-- Dados de campanha e conformidade.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS marca_dagua TEXT,
ADD COLUMN IF NOT EXISTS cnpj_campanha TEXT,
ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;

ALTER TABLE pautas
ADD COLUMN IF NOT EXISTS marca_dagua TEXT,
ADD COLUMN IF NOT EXISTS cnpj_campanha TEXT,
ADD COLUMN IF NOT EXISTS titulo_eleitor TEXT;
