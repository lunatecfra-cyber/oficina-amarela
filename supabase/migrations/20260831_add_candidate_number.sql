-- Número que aparece na urna. Não confundir com o título de eleitor:
-- `titulo_eleitor` identifica a pessoa no cadastro eleitoral, `numero_eleitoral`
-- é o número da candidatura, e é ele que a lei manda estampar na tarja de
-- propaganda junto do nome oficial e do CNPJ da campanha.
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS numero_eleitoral TEXT;

ALTER TABLE IF EXISTS pautas
ADD COLUMN IF NOT EXISTS numero_eleitoral TEXT;
