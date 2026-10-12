# Solicitações de vídeo e atribuição — meta de 23/10

- Staging: a conta sintética autorizada completou o formulário de cinco etapas,
  com link fictício do Drive e dados de campanha herdados do perfil. A interface
  confirmou “Missão enviada!” e listou `db-38` aguardando editor. D1 confirmou
  dono 84, status `disponivel` e nenhuma mensagem para as fixtures na caixa de
  saída. Havia zero editores ativos antes da criação.
  [Evidência da missão](missao-criada-staging.jpg). Nenhum vídeo real foi enviado.
- D1 isolado, pela API HTTP: editor registra presença → porta-voz solicita vídeo
  → mensagem de despacho → consumidor oferece → somente destinatário aceita
  → missão ativa e `mission_assignments` persistem o editor. Segundo aceite
  retorna 409; dono da missão vem da sessão, mesmo com id forjado no corpo.
- Dois defeitos reproduzidos antes da correção (200 em vez de 403): leitura de
  `/missions/view/:id` por editor alheio e exclusão por não administrador.
  Leitura exige participante/inspetor; exclusão exige inspetor. O teste legado
  PostgreSQL foi ajustado ao contrato, sem declarar sua execução.
- 12 testes direcionados passaram; suíte geral: 253 aprovados, typecheck e Biome
  dos arquivos alterados aprovados. No ensaio de aceite a rede foi bloqueada;
  nenhuma mensagem foi marcada como enviada. Não foi exercido aceite remoto,
  pois sua rota também drena a caixa de saída compartilhada de staging.
- Próxima validação funcional: editor sintético recebe e aceita pela interface
  em ambiente com entrega de notificações isolada. Upload R2 real, OAuth Google
  real e entrega real de e-mail ainda não foram testados nesta rodada.
- ONCA permanece inacessível; nenhuma issue foi lida ou alterada. Produção não
  foi modificada. Fixtures aguardam autorização de limpeza.
