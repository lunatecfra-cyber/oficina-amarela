-- Número que aparece na urna. Não confundir com o título de eleitor.
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS candidate_number TEXT;

ALTER TABLE IF EXISTS missions
ADD COLUMN IF NOT EXISTS candidate_number TEXT;

-- Compatibilidade com o schema legado em português.
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS numero_eleitoral TEXT;

ALTER TABLE IF EXISTS pautas
ADD COLUMN IF NOT EXISTS numero_eleitoral TEXT;
