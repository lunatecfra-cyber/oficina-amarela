# Auditoria da Oficina Amarela — 2026-10-11/12

Investigação predominantemente de leitura. Nenhum arquivo existente foi alterado; nada foi implantado, migrado ou escrito em banco/Jira.

- [A — Estado Atual](A-estado-atual.md)
- [B — Inventário Funcional](B-inventario-funcional.md)
- [C — Riscos Técnicos](C-riscos-tecnicos.md)
- [D — Matriz de Compatibilidade](D-matriz-compatibilidade.md)
- [E — Decisões Arquiteturais](E-decisoes-arquiteturais.md)
- [F — Próximos Checkpoints](F-proximos-checkpoints.md)

## Resumo executivo
1. **Estado:** a plataforma está de fato migrada para Cloudflare (5 Workers, 2 D1, DO, Queues, Cron, R2, domínio próprio) e já processou missões reais até a finalização (3 finalizadas e pontuadas; integridade sem violações). Pagamentos, mural, especialidades e limites por solicitante **não existem**.
2. **Aproveitável:** reserva transacional, ofertas, ranking, chat, auditoria, convites, painel do inspetor, 240 testes.
3. **Problemas principais:** C-01 (sequestro de conta via Google), C-02 (rate limit controlado pelo cliente), C-04 (e-mails marcados como enviados sem provedor), deriva checkout × produção, sem CI/ledger de migrations.
4. **Compatibilidade:** 25 propostas classificadas em D; a maior parte é ADAPTAR/NOVA; pagamento e CPF são PENDENTE (jurídico).
5. **Decisões pendentes:** jurídico/tributário/eleitoral do dinheiro; CPF; exposição pública de editores; nota automática; provedor de e-mail/PSP.
6. **Primeiro checkpoint:** CP0 em F (segurança e paridade), validado em staging.

## Verificações executadas
Coleta read-only da API Cloudflare; consultas SELECT agregadas no D1; GETs públicos de 13 URLs; 3 requisições não mutantes à API (health, admin/users, google/find com corpo vazio); testes (`node --test`) e typecheck em cópia isolada em `/tmp`; sondas com mocks sintéticos.
## Limitações
Sem Jira; sem DNS/Access/Analytics; sem UI autenticada; sem teste de upload/e-mail reais; cobertura % não medida; C-01..C-03 não explorados em ambiente real.
