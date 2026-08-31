-- Contato direto entre porta-voz e editor da mesma missão.
--
-- Guardado só em dígitos (DDD + número, 10 ou 11), normalizado no domínio
-- antes de chegar aqui: número pela metade entra como NULL, e não como um
-- telefone que não disca.
ALTER TABLE IF EXISTS users
ADD COLUMN IF NOT EXISTS whatsapp TEXT;
