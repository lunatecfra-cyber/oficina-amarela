# C. Riscos Técnicos

Prioridade: P0 (agir antes de qualquer feature) · P1 · P2 · P3. Confiança: A/M/B.
Provas locais usam **dados sintéticos e mocks** (`/tmp/oficina-audit-2026-10-11/checkout/audit-probes.ts`, saída em `security-probes.log`). Nada foi explorado em produção; só `GET /health`, `GET /admin/users` (401) e `POST /auth/google/find` com corpo vazio (400) foram enviados à API pública.

| ID | Sev. | Pri. | Risco | Evidência | Conf. |
|---|---|---|---|---|---|
| C-01 | Crítica | P0 | **Sequestro de conta via Google**: `POST /auth/google/find` não exige sessão nem prova de posse do `googleId`; se o e-mail existe e não há `google_id`, grava o `googleId` informado e devolve a conta (id, papel, e-mail). Atacante pré-vincula o próprio `sub` do Google ao e-mail da vítima e depois entra via Google (`findByGoogleId` vence). | Handler em `apps/api/src/routes/auth.ts` e no bundle remoto (`remote-code-excerpts.json`, linhas ~20713-20757); sonda local `google.status=200` + `linkGoogleId` chamado; API pública e roteável (workers.dev ligado, 400 em corpo vazio) | A no código · M na explorabilidade (não explorado) |
| C-02 | Alta | P0 | **Rate limit sob controle do cliente**: `/auth/rate-limit/record` aceita `key`, `max`, `windowMinutes`, `lockMinutes` do corpo sem autenticação → bloqueio de qualquer conta/IP (DoS dirigido) ou limites frouxos. | Sonda local (`attempt` = valores enviados); bundle remoto contém `rate-limit/check` | M |
| C-03 | Média-Alta | P1 | **IDOR / exposição de dados**: `GET /missions/view/:id` só exige sessão válida (qualquer papel vê qualquer missão); `GET /candidates/:slug/missions` repassa o formato completo (vimos `voterId`, URLs de mídia bruta) — a sonda usou repositório mock, então o formato real precisa ser conferido. | Sonda local; `missions-crud.ts` | M (view) · B (candidates) |
| C-04 | Alta | P0 | **E-mail "enviado" sem enviar**: sem `RESEND_API_KEY`, `deliverEmail` retorna `true`; a fila marca `sent_at`. Os Workers api/web não têm esse segredo (`*-settings.json`); prod tem 3 e staging 14 linhas "enviadas" (tentativas=1). Convites, recuperação de senha e avisos podem estar silenciosamente perdidos. | `packages/email/src/messages.ts`; `email_states` nos agregados; sonda `returned_success:true, real_message_sent:false` | M-A (não conferi se outro caminho de envio existe) |
| C-05 | Média | P1 | **Deriva código × produção**: checkout permite `DELETE /missions/:id` a qualquer editor autenticado; o bundle remoto restringe a admin e tem cancelamento/repasse ausentes no checkout. Novo deploy pode reabrir falha ou remover recursos. | Sonda `deletion.status=200`; `oficina-amarela-api-source-summary.json` (`deleteMission`, `mission_owner_events`) | A |
| C-06 | Média | P1 | **Sem CI**, `lint` vermelho (15 erros), deploy manual: nada impede regressão (como C-05). | ausência de `.github/`; `lint.log` | A (lint: confirmar sem o hook RTK) |
| C-07 | Média | P1 | **Sem ledger de migrations**: tabela de controle vazia em prod; migrations aplicadas por script (`scripts/aplicar-schema-d1.mjs`) e há scripts `migrar-*.mjs` ad hoc. Divergência schema × migrations não verificável. | `migration_ledger: []`; comparar `d1-schema-*.json` com `packages/db/d1/*.sql` (**PENDÊNCIA**) | M |
| C-08 | Média | P2 | **Lógica de negócio em triggers SQL** (aprovação, resgate de convite, vínculo de chat). Boa para invariantes, mas difícil de testar/evoluir; mudanças exigem recriar triggers (`atualizar-gatilhos-d1.sql`). | `0001_mission_slice.sql`, `0006_…sql` | A |
| C-09 | Média | P2 | **Superfície pública**: API acessível por `workers.dev` contornando o web; sem Turnstile, sem Access; WAF/rate limit de borda **UNKNOWN**. | `access.json`, `turnstile.json`, `*-subdomain.json` | M |
| C-10 | Média | P2 | **Observabilidade**: `telemetry.ts` existe; sem evidência de alertas, logs retidos ou métricas de Queue/Cron coletadas. Incidente de cota de Queues em 2026-09-02 (`docs/infra/cloudflare-queues-incident-2026-09-02.md`). | docs; `queues.json` (retenção 24h, DLQ sem consumidor) | M |
| C-11 | Média | P2 | **Backup/recuperação não comprovados** (scripts existem; sem execução registrada). Exclusão de missão (`deleteMission`) pode comprometer histórico — sem soft delete verificado. | `scripts/backup.mjs`, `restore.mjs` | B |
| C-12 | Média | P2 | **Dados pessoais**: WhatsApp, e-mail, vínculo político; proposta de CPF amplia o risco (LGPD, retenção, finalidade). Sem política de retenção verificada. | `whatsapp-field`, `docs/OBRIGATORIO-LEGAL.md` | B |
| C-13 | Baixa | P3 | **Documentação contraditória** (`AI_HANDOFF.md` diz "nada implantado"; `docs/*` tratam Supabase/mock como atual). Induz decisões erradas. | `docs/AI_HANDOFF.md:70` | A |
| C-14 | Baixa | P3 | Amostra pequena de pontuação (3 finalizadas) e ranking sem testes de carga em produção além dos scripts manuais. | agregados | M |

## Pontos fortes (FATO)
- Reserva de missão com índice único parcial + Durable Object `MissionCoordinator` + teste dedicado; 0 claims duplicados em prod.
- 0 violações de FK, 0 estados impossíveis, 0 órfãos em prod e staging.
- Ofertas com índices únicos por missão/editor e expiração; chat protegido por trigger.
- 240 testes automatizados verdes; typecheck limpo; separação prod/staging completa.

## Limitações
Não verifiquei: fluxo autenticado de UI, uploads/URLs assinadas reais, controle de acesso ao R2, headers/CSP em profundidade, quota/limites do plano, DNS/WAF. Itens C-01/C-02 devem ser confirmados em **staging** com contas de teste antes de qualquer correção (fora do escopo desta auditoria).
