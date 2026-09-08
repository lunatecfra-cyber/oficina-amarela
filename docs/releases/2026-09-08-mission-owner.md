# Cancelamento e redistribuicao de missao

Publicado em 2026-09-08, a partir de checkout isolado, sem as alteracoes locais da Home.

- Implementacao: `807b108`; correcao do identificador de conversa: `ac19934` (release: `52cb1b9`).
- D1: `0006_mission_owner_actions.sql` aplicada antes da API; 23 consultas executadas com sucesso.
- API: `0097c49b-39db-45c5-9866-8bf3ff9ba6f1`.
- Web: `10ac47c2-bdba-4b1e-943f-5c0b02c97220`.
- Recuperacao D1 anterior: `000005b2-00000000-000050e0-bba0489b8d0f3a14f724067cf9222053`. Nao restaurar automaticamente: uma restauracao posterior pode desfazer novas escritas de usuarios.

## Verificado

- Banco: 122 testes executados passaram. API: 52. Web: 15. Controles de confirmacao: 4.
- Typecheck API/web e build Cloudflare passaram.
- D1 local real (Miniflare): limite de 48h, nova contagem, propriedade, duplicacao, concorrencia com entrega, rollback se outbox falhar, exclusao do editor anterior e isolamento de mensagens.
- Celular 390px: sem transbordo horizontal na fixture dos controles; confirmacao por teclado e conversa somente para leitura.
- Producao: migration verificada por consultas agregadas; pagina do editor recarregada sem erros de console.

## Limites da verificacao

- Suites de integracao PostgreSQL nao executadas: `TEST_DATABASE_URL` nao configurado. Migration PostgreSQL preparada, nao aplicada; producao usa D1.
- Nao houve cancelamento de missao real nem teste completo autenticado como porta-voz em producao. A sessao disponivel era de editor. Falta validar com missao de teste e verificar recebimento do e-mail.
- Mensagens legadas de autoria/periodo ambiguos ficam visiveis somente para proprietario/inspetor; nao se inventa atribuicao retroativa.
- E-mails pendentes da missao sao retirados da fila na transacao. E-mail ja entregue ou em transito nao pode ser desfeito.

## Reproducao da interface local

`node apps/web/tests/owner-ui/server.mjs` abre fixture isolada em `http://127.0.0.1:3012/`, com dados ficticios. Nao testa o backend nem altera producao.
