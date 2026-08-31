# Cloudflare Cutover Plan — Oficina Amarela

> Branch: `infra/cloudflare-scale` · Written 2026-08-30 · Executes in **Phase 22**
> **Not executable yet.** This is the plan of record; it is filled in with concrete
> values (hosts, database IDs, DNS records, timings) during Phases 20–21.
> Production cutover is never improvised.

Every infrastructure replacement follows:
`AUDIT → BASELINE → IMPLEMENT → TEST → COMPARE → REVIEW → APPROVE → CUTOVER → OBSERVE → REMOVE LEGACY`.
No working provider is removed before its replacement has been validated in
production conditions.

---

## 1. Prerequisites — all must be true

- [ ] Every P0 item on `CLOUDFLARE_MIGRATION_BOARD.md` is `DONE`.
- [ ] Phase 19 load tests pass, including **zero** mission-claim violations in Scenario C.
- [ ] `npm test`, `npx tsc --noEmit`, Biome and the production build all pass on `infra/cloudflare-scale`.
- [ ] Test coverage exists for authentication, authorization, mission claim/abandon/submit/approve/revise, ranking, gamification, invitations and candidate approval (`P2-09`).
- [ ] The production database provider is confirmed and recorded (`P0-06`).
- [ ] A **verified restorable** backup of production data exists — restore tested, not just taken.
- [ ] D1 migration validation scripts exist and pass against a full production copy in staging.
- [ ] Rollback is documented, rehearsed end to end, and timed.
- [ ] Cloudflare Email Service has been compared against Resend on real deliverability (Phase 17).
- [ ] Sentry and Workers observability are both live and verified to record real errors.
- [ ] Secrets are provisioned as Wrangler secrets in the production environment, with staging and production fully separated.
- [ ] A maintenance window is agreed, announced, and outside campaign-critical hours.
- [ ] A named human approver has signed off. **`infra/cloudflare-scale` is not merged into `master` automatically.**

---

## 2. Freeze and baseline

1. Announce the window in-product (PT-BR) and disable new mission creation.
2. Stop background dispatch and any scheduled jobs.
3. Take the final PostgreSQL dump. Record: dump SHA-256, byte size, timestamp, and per-table row counts.
4. Record baseline production metrics (request rate, error rate, latency) for post-cutover comparison.
5. Tag the pre-cutover commit on `master`.

---

## 3. Database migration

1. Import the dump into production D1 using the tooling built in Phase 9.
2. Run the validation suite. **A successful import command is not evidence that the data is correct.** Validate:

   - [ ] row counts per table match the source exactly — `users`, `pautas`, `ofertas`, `mensagens`, `denuncias`, `avaliacoes`, `portfolio`, `conquistas`, `musicas`, `novidades`, `gamificacao_regras`, `gamificacao_eventos`, `ranking_ciclos`, `ranking_aprovacoes`, `convites_porta_voz`, `indicacoes_recompensas`, `bloqueios_constancia`, `auditoria_admin`, `tentativas_login`;
   - [ ] every foreign key resolves — no orphaned `pautas.reservada_por_id`, `ofertas.editor_id`, `mensagens.autor_id`, `ranking_aprovacoes.editor_id`;
   - [ ] users: count by `papel`, no duplicate `lower(email)`, no duplicate `lower(apelido)`, no duplicate `google_id`, no duplicate `codigo_indicacao`;
   - [ ] authentication: `senha_hash` values intact and byte-identical; `sessoes_validas_apos` preserved so live sessions are not silently invalidated;
   - [ ] candidates: every `voz` account traces to a consumed `convites_porta_voz` row (`P0-08`);
   - [ ] editors: `entregues`, `reputacao`, `streak`, `nota` match; `nivel` — a Postgres generated column — recomputes to the same value under the new implementation for **every** row;
   - [ ] missions: status distribution matches; every `'reservada'`/`'em_revisao'`/`'reedicao'` mission has exactly one editor, and no editor holds more than one;
   - [ ] rankings: `ranking_ciclos` has exactly one open cycle; `ranking_aprovacoes` counts per editor per cycle match;
   - [ ] chat: message counts per mission match; ordering by timestamp is stable;
   - [ ] audit history: `auditoria_admin` count matches and `detalhes` JSON parses;
   - [ ] invitations: open/used/revoked counts match; no invitation that was used appears reusable;
   - [ ] gamification: `gamificacao_eventos` count matches and the `(user_id, regra_id, referencia)` uniqueness still holds;
   - [ ] arrays and JSON round-trip: `softwares`, `estilos`, `nicho`, `bandeiras`, `palavras_chave`, `musicas.tags`, `users.disponibilidade`, `users.redes_sociais`;
   - [ ] timestamps: every `TIMESTAMPTZ` converted to the chosen D1 representation with no timezone drift — spot-check against known São Paulo local times;
   - [ ] indexes and constraints present, including the invariants added by `P0-01` and `P0-03`;
   - [ ] `EXPLAIN QUERY PLAN` on every hot query shows `SEARCH ... USING INDEX`.

3. Commit the validation output to `docs/cutover-results/`.
4. **Any mismatch stops the cutover.** Roll back per §8.

---

## 4. Workers deployment

1. Deploy `apps/api` to production Workers with production bindings: D1, R2, Queues, Durable Object namespaces, KV, Analytics Engine.
2. Deploy `apps/web`, bound to `apps/api` via a **Service Binding** — no public hop for internal calls.
3. Confirm `compatibility_flags` include `nodejs_compat` (`node:crypto` in `lib/invitations-db.ts`).
4. Confirm `NODE_ENV=production` in the build and that the development authentication bypasses are unreachable (`P0-04`) — verify by request, not by reading code.
5. Verify secrets: `AUTH_SECRET` (**carried over verbatim — rotating it logs out every user**), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `EMAIL_SENDER`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, R2 credentials.
6. Add the Workers deployment as an OAuth redirect URI in Google Cloud **before** DNS moves.
7. Smoke test on the `workers.dev` URL before touching DNS.

---

## 5. Queues, Durable Objects and email

1. Deploy Queue consumers; confirm each is idempotent and that dead-letter handling is configured.
2. Confirm Durable Object namespaces and migrations are applied.
3. Point email at the provider chosen in Phase 17, with the other as fallback. **Verify a message cannot be sent by both providers** — the idempotency key is doing that job.
4. Send a canary email through the production path to a real inbox on Gmail and on Outlook.

---

## 6. DNS

1. Lower the TTL on the affected records **at least 24 h in advance**.
2. Fix `oficinaamarela.com.br` DNS as a prerequisite, not during the window: replace `v=spf1 -all` (**replace, never duplicate** — two SPF records at one name cancel each other), add MX, DKIM and DMARC for the chosen email provider (`P2-07`).
3. Move the apex and `www` to the Workers custom domain.
4. Confirm certificate issuance before announcing the window closed.
5. Restore the original TTL once the observation window in §9 is clean.

---

## 7. Verification before reopening

- [ ] Log in with a password account and with Google OAuth.
- [ ] An **existing** session cookie issued before the cutover is still valid (`P0-07`).
- [ ] Create a mission as `porta-voz`; it appears as `disponivel`.
- [ ] An editor receives an offer, accepts it, and holds exactly one mission.
- [ ] Two editors racing the same mission produce exactly one winner and a PT-BR conflict message for the other.
- [ ] Submit a delivery, request a revision, then approve — ranking and gamification counters move by the expected amounts.
- [ ] Mission chat delivers messages in both directions.
- [ ] Presigned upload to R2 succeeds and the object is readable.
- [ ] Admin invitation issue → redeem creates exactly one `voz` account and marks the invitation used.
- [ ] Self-registration **cannot** produce a `voz` account.
- [ ] Report a mission and resolve it as inspector.
- [ ] Sentry receives a deliberately triggered test error.
- [ ] Workers Logs and Analytics Engine show live traffic.
- [ ] Public pages return cache hits.

---

## 8. Rollback

Rollback is only clean while the legacy stack is still running and still authoritative.

**Trigger:** any §3 validation mismatch, any §7 check failing, error rate above 1%,
p95 latency above 3 s sustained for 10 minutes, or any mission-claim inconsistency.

1. Revert DNS to the legacy origin (bounded by the TTL set in §6.1 — this is why the TTL is lowered in advance).
2. Re-enable the legacy application and its database.
3. Re-enable background dispatch on the legacy stack.
4. **Reconcile writes that landed on D1 during the window.** Keeping the window short and mission creation disabled is what makes this tractable; if it is not tractable, the window was too long.
5. Record what happened in `docs/cutover-results/` before attempting again.

Rollback must be rehearsed in staging and **timed** before the real window. An
unrehearsed rollback is not a rollback plan.

---

## 9. Post-cutover observation

| Window | Watch |
|---|---|
| First hour | error rate, p50/p95/p99, D1 rows read and query latency, Queue depth, DO throughput, login success rate |
| First 24 h | email delivery and bounce rate, cache hit ratio, cost accrual against `CLOUDFLARE_COST_MODEL.md`, mission claim conflicts vs successes |
| First 7 days | ranking correctness across a full weekly cycle, consistency shields, referral rewards, audit completeness |
| First 30 days | JWT expiry rollover completes — only after this can `AUTH_SECRET` rotation or claim-format changes be scheduled (`P0-07`) |

---

## 10. Legacy removal (Phase 23, separate approval)

Nothing below happens during the cutover window. Each requires: replacement
validated in production, backup confirmed, rollback documented, tests passing.

| Provider | Removal condition |
|---|---|
| Vercel hosting | ≥ 30 days of clean Workers operation; DNS fully migrated; final export taken |
| Neon / Supabase | ≥ 30 days of clean D1 operation; final dump archived offline and restore-tested |
| `@vercel/blob` | already only one call site (`P2-01`); removable well before cutover |
| Resend | only after Cloudflare Email Service is proven on real deliverability, and only by explicit decision — **not because Cloudflare is cheaper** |
| Sentry | only after Workers observability is proven sufficient to diagnose a real production error |

Record the final state of each in `AI_HANDOFF.md` under **External Providers**.

---

## Estado real da produção — 2026-08-31

Provisionado na conta **casamarela** (`53878b12fbc280f03fc30b5875f3522f`), em
execução paralela: no ar, sem tráfego de usuário e sem dados.

| Recurso | Identificador | Estado |
|---|---|---|
| D1 | `oficina-amarela` · `a9ac89e5-38e9-4788-b8da-be8c79f40100` | schema aplicado, **0 linhas** |
| Fila | `oficina-amarela-manutencao` | criada |
| DLQ | `oficina-amarela-manutencao-dlq` | criada |
| Worker API | `oficina-amarela-api` | no ar, com D1 + fila + Durable Object |
| Worker web | `oficina-amarela-web` | no ar, com Service Binding `API` |

URLs (sem DNS próprio, sem tráfego):
`https://oficina-amarela-api.casamarela.workers.dev`
`https://oficina-amarela-web.casamarela.workers.dev`

Paridade de schema conferida contra o staging: 24 tabelas, 5 triggers, 30
índices nos dois.

Provado de ponta a ponta em produção: cadastro pelo web atravessando o Service
Binding até o D1, sessão lida de volta com os claims legados em português
intactos, e cadastro público recusando papel `admin`. Os dados do teste foram
apagados; o banco voltou a zero.

### ⚠️ Dois bloqueios obrigatórios antes de virar o tráfego

**1. `AUTH_SECRET` de produção é temporário.**

O Worker de produção subiu com um segredo aleatório, porque o segredo real de
produção não estava disponível. Virar o tráfego com ele **invalida a sessão de
todos os usuários** — os tokens duram 30 dias.

Antes do flip:

```bash
cd apps/api
echo -n "<o segredo real de produção>" | npx wrangler secret put AUTH_SECRET --env production
npx wrangler deploy --env production
```

**2. Nunca use `wrangler d1 migrations apply` neste schema.**

O splitter corta em `;` e quebra o corpo dos `CREATE TRIGGER`, falhando com
`incomplete input` no meio do arquivo e deixando o banco pela metade. Foi
exatamente o que aconteceu na primeira tentativa de provisionar produção.

```bash
node scripts/aplicar-schema-d1.mjs production
```

O schema é idempotente, então reaplicar depois de falha parcial é seguro.

### O que ainda falta para o flip

- `P0-06`: origem dos dados de produção (Supabase/Neon) — pendente com o time
- ensaio de migração PostgreSQL → D1 com dados reais
- backup restaurável e teste de restauração
- ensaio de rollback
- jornada completa e prova de concorrência contra o ambiente publicado
- Queue/Cron/DLQ exercitados de verdade, não só provisionados
- R2
- teste de carga (nenhum nível executado)
- WAF, rate limit de borda, Turnstile
- revisão de log do `P0-09`
