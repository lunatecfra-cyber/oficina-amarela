-- Remove as 18 tabelas fantasma em português. 0001 cria as tabelas com nome
-- antigo (CREATE TABLE IF NOT EXISTS pautas, ...) e 0003 as renomeia para
-- inglês (ALTER TABLE pautas RENAME TO missions). Reaplicar 0001 depois da
-- renomeação recriava as 18 vazias a cada deploy, porque `pautas` não existe
-- mais e o IF NOT EXISTS não tinha o que barrar. scripts/aplicar-schema-d1.mjs
-- já para de reaplicar 0001 numa base renomeada — este patch limpa o que já
-- tinha acumulado. Todas confirmadas com 0 linhas antes deste patch.
DROP TABLE IF EXISTS mensagens;
DROP TABLE IF EXISTS denuncias;
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS ofertas;
DROP TABLE IF EXISTS ranking_aprovacoes;
DROP TABLE IF EXISTS pautas;
DROP TABLE IF EXISTS ranking_ciclos;
DROP TABLE IF EXISTS convites_porta_voz;
DROP TABLE IF EXISTS indicacoes_recompensas;
DROP TABLE IF EXISTS bloqueios_constancia;
DROP TABLE IF EXISTS gamificacao_eventos;
DROP TABLE IF EXISTS gamificacao_regras;
DROP TABLE IF EXISTS auditoria_admin;
DROP TABLE IF EXISTS fila_emails;
DROP TABLE IF EXISTS conquistas;
DROP TABLE IF EXISTS musicas;
DROP TABLE IF EXISTS novidades;
DROP TABLE IF EXISTS tentativas_login;
