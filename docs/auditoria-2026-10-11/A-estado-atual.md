# A. Estado Atual — Oficina Amarela (auditoria de 2026-10-11/12)

Legenda: **FATO** (evidência direta) · **INFERÊNCIA** · **RISCO** · **PENDÊNCIA**. Status de infra: `CODE_ONLY` / `CONFIGURED` / `DEPLOYED` / `VERIFIED` / `UNKNOWN`.
Evidências brutas (JSON/logs, sem segredos): `/tmp/oficina-audit-2026-10-11/` (volátil; copiar se for preciso preservar).

## 1. Repositório
- **FATO** Branch `master`, HEAD `d9eba39` (2026-09-11), 50 commits, em sincronia com `origin/master`. Working tree com 12 arquivos modificados e não commitados (README, `package.json`/`bun.lock`, `wrangler.jsonc` de api e mail) — preservados; nada foi alterado no código.
- **FATO** Monorepo bun/Turborepo: `apps/web` (Next.js), `apps/api` (Hono), `apps/mail` (webmail serverless + dashboard), `packages/{auth,config,db,domain,email}`, `scripts/`, `supabase/` (legado), `docs/`.
- **FATO** Migrations D1 em `packages/db/d1/0001…0007`. Sem `.github/` → **não há CI**.
- **FATO** `supabase/` e `docs/AUDITORIA-BUGS.md`, `docs/PLANO.md` etc. descrevem uma fase anterior (Supabase, dados mock). **INFERÊNCIA** são documentação histórica; `docs/AI_HANDOFF.md` ("Nothing has been deployed", Turnstile/KV/Email "NOT STARTED") **contradiz** a realidade remota abaixo.

## 2. Infraestrutura Cloudflare (conta `casamarela`, leitura via API)
| Componente | Status | Evidência |
|---|---|---|
| Workers `oficina-amarela-web`, `-api`, `-web-staging`, `-api-staging`, `email-explorer` | **DEPLOYED** | `scripts.json`; última modificação api 2026-09-13, web 2026-09-14 |
| Domínios `oficinaamarela.com.br`, `www`, `mail.` | **VERIFIED** (HTTP 200 em `/login`, mail) | `domains.json`, `public-probes.json` |
| D1 `oficina-amarela` (prod), `-staging` | **VERIFIED** (leitura: 38 users, 8 missões em prod) | `d1-aggregates-*.json` |
| Durable Object `MissionCoordinator` (api, api-staging), `MailboxDO` | **DEPLOYED** | `durable_objects.json` |
| Queues `manutencao` (+DLQ) prod e staging, consumer = api | **DEPLOYED**; funcionamento **UNKNOWN** (sem métricas coletadas) | `queues.json` |
| Cron api `*/5 * * * *` (prod); `*/15` no código | **DEPLOYED** | `*-schedules.json`, `apps/api/wrangler.jsonc` |
| R2 (3 buckets, CORS e domínio de mídia) | **CONFIGURED/DEPLOYED**; upload ponta a ponta **UNKNOWN** | `r2*.json` |
| Service Binding web→api | **VERIFIED** (binding `API` no web) | `*-web-settings.json` |
| KV | não existe (0 namespaces) | `kv.json` |
| Pages | não usado (Workers) | `pages.json` |
| Turnstile | **CODE_ONLY/ausente** | `turnstile.json` |
| Access | **desativado na conta** (403 not_enabled) | `access.json` |
| DNS records, Analytics | **UNKNOWN** (token sem permissão) | `dns.json` |
| E-mail transacional | **ver risco R-04**: `RESEND_API_KEY` não existe nos bindings de api/web | `*-settings.json` |

- **FATO** A API tem `workers.dev` habilitado e responde publicamente (`/health` 200; `/admin/users` 401).
- **FATO** Produção e staging separados (Workers, D1, Queues, DO próprios). Staging tem dados mais "de teste" (4 admins, 1 banido).
- **PENDÊNCIA** Rollback/recuperação: existem `scripts/backup.mjs` e `restore.mjs`, mas não há evidência de backup executado, nem de Time Travel testado. Deploys são manuais (wrangler); histórico de deployments em `*-deployments.json`.
- **FATO** Divergência código remoto × checkout: o bundle da API em produção restringe `DELETE /missions/:id` a admin (`requireAdmin`) e contém rotas de cancelamento/repasse; o checkout local permite DELETE por qualquer sessão de editor (ver C). **RISCO**: um deploy do checkout atual pode regredir comportamento/segurança.

## 3. Funcionamento comprovado em produção (dados, só leitura)
- **FATO** 38 usuários (2 admin, 22 editores, 14 porta-vozes); 8 missões: 3 finalizadas (com entrega e pontuadas), 1 em revisão, 1 reservada, 3 disponíveis; 13 ofertas (5 aceitas, 7 expiradas, 1 recusada); 2 avaliações; 7 mensagens; 2 eventos de auditoria.
- **FATO** Integridade: 0 violações de FK, 0 estados impossíveis, 0 claims duplicados, 0 órfãos.
- **INFERÊNCIA** O ciclo criar → ofertar → aceitar → entregar → aprovar → pontuar já foi exercido em produção (3 finalizadas pontuadas). Volume baixo: não prova robustez sob carga.

## 4. Qualidade (execução local isolada, cópia em `/tmp/.../checkout`)
- **FATO** Testes (node:test): config 6, domain 63, db 105, email 2, api 49, web 15 — **todos passam**. Typecheck dos 8 workspaces — passa.
- **FATO** `lint` (Biome) falha: 15 erros, 22 warnings, 1 info (`lint.log`). **Ressalva**: a memória do projeto registra que o hook RTK deforma a saída do lint — conferir rodando o binário do Biome diretamente.
- **FATO** Sem testes E2E no CI; existem scripts manuais (`testar-e2e-producao.mjs`, `testar-concorrencia-remoto.mjs`, `teste-carga.mjs`).

## 5. Limitações de acesso
- Jira: sem credenciais, sem aba/URL/chave de projeto → Etapa H **não realizada** (ver F). 
- Cloudflare: token de leitura; sem DNS, Access, Analytics/GraphQL.
- Não testado: upload real, e-mail real, fluxo de UI autenticado (sem credenciais de teste; proibido modificar dados reais).
