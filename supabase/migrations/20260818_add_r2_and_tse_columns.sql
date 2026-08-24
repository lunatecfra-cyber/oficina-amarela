-- Colunas de URLs de vídeo (R2)
ALTER TABLE pautas
ADD COLUMN video_bruto_url TEXT,
ADD COLUMN video_entrega_url TEXT;

-- Colunas das Regras do TSE
ALTER TABLE users
ADD COLUMN marca_dagua TEXT,
ADD COLUMN cnpj_campanha TEXT,
ADD COLUMN titulo_eleitor TEXT;

ALTER TABLE pautas
ADD COLUMN marca_dagua TEXT,
ADD COLUMN cnpj_campanha TEXT,
ADD COLUMN titulo_eleitor TEXT;
