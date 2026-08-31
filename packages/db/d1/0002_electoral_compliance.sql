-- Colunas adicionadas depois que o D1 já existia.
--
-- O 0001 é um arquivo de CREATE TABLE IF NOT EXISTS: reaplicá-lo num banco que
-- já tem as tabelas não acrescenta coluna nenhuma. Por isso todo campo novo
-- entra aqui como ALTER, e o aplicador roda uma instrução por vez tratando
-- "duplicate column name" como já aplicado — o SQLite não tem
-- ADD COLUMN IF NOT EXISTS.
--
-- Conformidade eleitoral da missão: existia só no PostgreSQL. O D1 aceitava a
-- missão e descartava em silêncio a marca d'água, o CNPJ da campanha e o título
-- de eleitor, que são justamente o que a tarja de propaganda estampa.
ALTER TABLE pautas ADD COLUMN marca_dagua TEXT;
ALTER TABLE pautas ADD COLUMN cnpj_campanha TEXT;
ALTER TABLE pautas ADD COLUMN titulo_eleitor TEXT;

-- Número na urna, no perfil do porta-voz e na missão. Não confundir com o
-- título de eleitor: aquele identifica a pessoa, este identifica a candidatura.
ALTER TABLE users ADD COLUMN numero_eleitoral TEXT;
ALTER TABLE pautas ADD COLUMN numero_eleitoral TEXT;
