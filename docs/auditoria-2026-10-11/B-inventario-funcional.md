# B. Inventário Funcional

Estados: **Funcional (P)** = código + testes + indício em dados de produção · **Implementado** = código e testes, sem indício em produção · **Parcial** · **Ausente** · **Não verificado**.
Fontes: rotas em `apps/api/src/routes/*.ts`, repositório D1 em `packages/db/src/d1/*.ts`, domínio em `packages/domain/src/*.ts`, telas em `apps/web/app/*`, dados em `/tmp/oficina-audit-2026-10-11/d1-aggregates-production.json`. Confiança: média (leitura de código por amostragem de rotas; UI não exercitada).

| Funcionalidade | Estado | Frontend | Backend | Dados | Papéis | Testes | Produção | Riscos |
|---|---|---|---|---|---|---|---|---|
| Cadastro/login e-mail+senha | Implementado | `login`, `criar-conta`, `recuperar`, `redefinir-senha` | `routes/auth.ts`, `account-registration.ts` | `users`, convites | público | `auth.test.ts` | 38 usuários | Rate limit controlado pelo cliente (C-02) |
| Login Google | Implementado | `login` + `api/auth/google/*` | `auth.ts` `/google/find`, `/google/register` | `users.google_id` | público | parcial | `GOOGLE_CLIENT_*` no web | **Vínculo de identidade sem verificação no backend (C-01)** |
| Sessão/revogação | Implementado | `proxy.ts` | `packages/auth/session.ts`, `d1/session-revocation.ts` | `users` | todos | sim | — | — |
| Convites/indicação de porta-voz | Implementado | admin | `admin-invitations.ts` | `invitations` (índice único) | admin/inspetor | `admin-invitations.test.ts` | não observado | — |
| Criar missão (porta-voz) | Funcional (P) | `porta-voz`, `nova-pauta-form` | `missions-crud.ts` | `missions` | porta-voz | sim | 8 missões | `GET /missions/view/:id` só exige sessão (IDOR, C-03) |
| Upload de bruto | Parcial/Não verificado | `upload-dropzone`, `api/upload` | presign R2 (`apps/web/lib/upload-policy.ts`) | R2 | porta-voz | `upload-policy` 15 testes | **UNKNOWN** | Acesso a arquivos sem verificação de dono |
| Distribuição/ofertas | Funcional (P) | fila do editor | `editor-queue.ts`, `d1/mission-queue.ts`, DO `MissionCoordinator` | `offers`, `missions` | editor | sim | 13 ofertas; 7 expiradas | Cron de manutenção depende da fila (ver A) |
| Aceitar/recusar (reserva) | Funcional (P) | `editor-panel` | `mission-claim-coordination.ts`, `d1/mission-lifecycle.ts` | índice único `idx_pautas_missao_ativa_por_editor`; ofertas | editor | `mission-claim-coordination.test.ts` | 0 claims duplicados | — |
| Entrega e revisão | Funcional (P) | painéis | `mission-lifecycle.ts`, `mission-approval.ts` | `mission_approvals`, `delivery_*` | editor/porta-voz | 10 testes de ciclo | 3 finalizadas, 1 em revisão | Trigger `apply_mission_approval` (lógica no banco) |
| Pontuação/ranking eleitoral | Funcional (P) | `ranking`, `perfil` | `ranking.ts`, `ranking-service.ts`, `domain/electoral-ranking.ts`, `ranking-cycle.ts` | `is_scored`, ciclos, bloqueios | todos | domain 63 testes | 3 pontuadas | Amostra pequena; ver D |
| Avaliações | Implementado | porta-voz | `profiles.ts` | `reviews` | porta-voz | `profiles.test.ts` | 2 | Sem avaliação automática (48h) |
| Chat da missão | Funcional (P) | página de missão | `mission-collaboration.ts` + trigger `mission_chat_forbidden` | `messages` | dono+editor | sim | 7 mensagens | Trigger no banco garante vínculo |
| Transferência de dono / cancelamento | Implementado (checkout) / **divergente** | admin | migration `0006_mission_owner_transfer.sql`; bundle remoto tem cancelamento | `mission_owner_events` | admin | sim (db) | 0 eventos | Código remoto ≠ checkout |
| Perfil público / portfólio | Parcial | `candidato/[slug]`, `perfil` | `profiles.ts` | `portfolio` | editor | sim | **0 registros** | Sem diretório nem especialidades |
| Treinamentos | Parcial | `aulas` (+ `tutorial-drive`) | — (conteúdo estático) | — | editor | não | n/a | Sem progresso persistido (**não verificado**) |
| Notificações e-mail | Implementado, **entrega não verificada** | — | `packages/email`, `email_queue`, fila/cron | `email_queue` | sistema | 2 testes | 3 "enviadas" em prod | **Sem provedor configurado (C-04)** |
| Inspetor: segurança, avisos, banimento | Implementado | `inspetor/*` | `admin-routes.ts`, `d1/accounts.ts` | `admin_audit` | inspetor/admin | `admin-routes.test.ts` | 2 eventos de auditoria | Granularidade de papéis |
| Admin: ranking, broadcast | Implementado | `inspetor` | `admin-ranking.ts` | ranking | admin | sim | — | — |
| Conteúdo (música, novidades) | Implementado | home | `content.ts` | `music_tracks`, `news` | admin | sim | 0 em prod; 2 em staging | — |
| Campeonato/premiações | Parcial | `api/championship`, home | agregados na API | ciclos | público | `championship.test.ts` | — | Prêmios "reais" sem fluxo de entrega |
| Webmail (`mail.`) | Funcional | `apps/mail/dashboard` | worker `email-explorer`, `MailboxDO` | R2/DO | admin | typecheck | HTTP 200 | Fora do escopo do produto |
| Pagamentos / saldo / Pix | **Ausente** | — | — | — | — | — | — | — |
| Mural aberto de serviços | **Ausente** | — | — | — | — | — | — | — |
| Limites mensais por solicitante | **Ausente** | — | `domain/limits.ts` cobre limites de editor (a confirmar) | — | — | — | — | — |
| Especialidades de editor | **Ausente** | — | — | — | — | — | — | — |

Observações:
- Uma rota existente não é prova do fluxo; a coluna "Produção" usa só agregados D1 de leitura.
- **PENDÊNCIA** Cobertura medida (%) não foi coletada; só contagem de testes.
- **PENDÊNCIA** Páginas `home-anterior`, `previa-home`, `dev`, `ferramentas`, `supabase/` parecem legado/auxiliares (INFERÊNCIA).
