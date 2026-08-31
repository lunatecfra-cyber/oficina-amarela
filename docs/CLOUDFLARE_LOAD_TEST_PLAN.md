# Cloudflare Load Test Plan — Oficina Amarela

> Branch: `infra/cloudflare-scale` · Written 2026-08-30 · Executes in **Phase 19**
> Shares results with ONCA-58 (launch readiness, capacity, observability).
> **Nothing here has been run yet.**

Target: **5,000 simultaneous users**, modelled as real behaviour — concurrent
sessions, requests/s, reads/s, writes/s, realtime connections, uploads, playback,
Queue throughput and email volume — not as 5,000 raw HTTP requests.

---

## 1. Preconditions

Do not start until all of these hold:

- [ ] `apps/web` and `apps/api` deployed to a **staging** Cloudflare environment with its own D1, R2, Queues, Durable Objects and secrets — never production bindings.
- [ ] Sentry DSN configured (`P2-05`), so failures during the run produce evidence.
- [ ] Workers Logs and Analytics Engine emitting the event set in §5.
- [ ] Staging D1 seeded with a realistic corpus: ≥ 2,000 editors, ≥ 200 spokespersons, ≥ 5,000 missions across every status, ≥ 50,000 chat messages, a populated ranking cycle.
- [ ] `EXPLAIN QUERY PLAN` captured for every hot query, with the plan recorded in the migration board.
- [ ] Load generator running **outside** Cloudflare's network, from at least two geographies including South America.
- [ ] A documented way to stop the run and reset staging data.

Tooling: k6 or Artillery for HTTP scenarios; a purpose-written WebSocket client
for Scenario D. Whatever is chosen must produce per-percentile latency and a
machine-readable result file committed under `docs/loadtest-results/`.

---

## 2. Pass / fail thresholds

Applied per scenario unless overridden. A scenario fails if **any** threshold is missed.

| Metric | Threshold |
|---|---|
| p50 latency | ≤ 200 ms |
| p95 latency | ≤ 800 ms |
| p99 latency | ≤ 2,000 ms |
| Error rate (5xx + timeouts) | ≤ 0.1% |
| Worker CPU per request | ≤ 50 ms p95 |
| D1 rows read per request | ≤ 200 p95 on any authenticated route |
| D1 query latency | ≤ 50 ms p95 |
| Cache hit ratio, `PUBLIC CACHEABLE` routes | ≥ 85% |
| Queue latency (enqueue → consumed) | ≤ 30 s p95 |
| Queue depth | must drain; no unbounded growth over the run |
| Email failure rate | ≤ 0.5% |
| **Mission claim correctness** | **exactly zero violations — this is not a percentage** |

Ramp profile for every scenario: 5 min ramp-up → 20 min steady state → 5 min
ramp-down. Measurements are taken from the steady-state window only.

---

## 3. Scenarios

### Scenario A — public traffic

3,800 virtual users browsing `/`, `/ranking`, `/candidato/[slug]`, public profiles,
`/parceiros`, `/termos`, `/privacidade`. No authentication. One page view per
45 s per user.

Measures caching effectiveness. **The point of this scenario is the cache hit
ratio**, not throughput: if `/ranking` and `/candidato/[slug]` are still
`force-dynamic` (`P1-03`), this scenario will show it as 84 req/s of identical D1
work and must fail on the rows-read threshold.

### Scenario B — authenticated editors

1,000 authenticated editors exercising `/editor`, the mission queue, `/ranking`,
mission detail, `/perfil`, challenges and notifications, plus the 15 s offer poll.

Watch specifically:
- D1 rows read per request — this is where `P1-02` (a session lookup per request) shows up;
- whether `dispatchMissions()` still runs inside the poll path (`P1-01`).

### Scenario C — mission claim burst ← **the critical scenario**

200 editors attempt to claim the **same** mission within a 500 ms window. Repeat
across 50 distinct missions. Then repeat with the same editor firing 10
simultaneous claims against 10 different missions.

Verification after each burst, by direct database query, not by API response:

- [ ] exactly one `pautas` row per mission has `status='reservada'` and one `reservada_por_id`;
- [ ] no editor holds more than one mission in `('reservada','em_revisao','reedicao')` — the invariant from `P0-01`;
- [ ] every editor told `ok:true` actually holds the mission — the failure mode in `P0-02`;
- [ ] no `ofertas` row is `'aceita'` against a mission that is not `'reservada'` by the same editor;
- [ ] no duplicate `(pauta_id, editor_id)` offer rows — the constraint from `P0-03`;
- [ ] the mission Durable Object serialised access and left no orphaned state;
- [ ] replaying the same claim request is safe (idempotent), not a second reservation.

**Any violation blocks the cutover outright.** No latency result compensates.

### Scenario D — realtime

500 concurrent mission chats with 2–4 participants each, typing indicators, editor
presence and live mission updates. Measures Durable Object throughput and
distribution, connection count, message fan-out latency and reconnection behaviour.

Include a partition-skew check: confirm that load spreads across
`chat:{missionId}` / `presence:{partition}` objects and does not concentrate on one.

### Scenario E — write burst

Simultaneous mission submissions, approvals, ranking updates, candidate profile
edits, supporter and donor changes, notifications and audit writes.

Watch: D1 rows written, write contention against the single-threaded database,
whether `ranking_aprovacoes` upserts stay correct under concurrency, and whether
audit rows are ever lost.

### Scenario F — media

200 concurrent presigned upload requests, 500 concurrent previews, playback and
downloads, and review flows over stored assets.

**Explicit requirement: Workers must not carry the media bytes.** Verify that
upload traffic goes browser → R2 directly and that Worker bandwidth stays flat
while media volume rises. Also verify the presign rate limit actually holds —
`P1-05` says today's in-memory `Map` will not survive multiple isolates.

---

## 4. Degradation and recovery (ONCA-58)

Run after the six scenarios pass:

| Test | Expectation |
|---|---|
| D1 returns `D1 DB is overloaded` under sustained burst | graceful PT-BR error, no data corruption, no partial writes |
| Queue consumer fails and retries | consumers are idempotent — no duplicate emails, no double-scored approvals |
| Durable Object restarts mid-claim | claim either completes or fails cleanly; never half-applied |
| Rate limit tripped | clear PT-BR message, correct 429, no lockout of legitimate users |
| R2 unavailable | uploads fail visibly; the mission is not marked delivered |
| Email provider fails | falls back to the secondary provider **without** sending twice |

---

## 5. Telemetry to emit during runs

Analytics Engine events (from `CLOUDFLARE_ARCHITECTURE.md`):

```
mission_view · mission_claim_attempt · mission_claim_success · mission_claim_conflict
upload_started · upload_completed · video_preview · editor_online
submission_created · review_completed · queue_latency · worker_latency
```

Each event carries the request ID so a slow request can be traced end to end.
`mission_claim_conflict` is expected and healthy during Scenario C — a conflict
means the guard worked. A *silent* success that fails verification is the failure.

---

## 6. Reporting

For each run record: date, commit SHA, environment, scenario, ramp profile, every
metric in §2, pass/fail per threshold, and the raw result file. Commit under
`docs/loadtest-results/YYYY-MM-DD-<scenario>.md`.

Feed the measured request mix, CPU-ms, rows read and cache hit ratios back into
`CLOUDFLARE_COST_MODEL.md`, replacing the assumptions in its §2 and keeping the
modelled figures alongside so the estimation error stays visible.

---

## Medições reais — 2026-08-31 (staging)

Alvo: `oficina-amarela-web-staging`, cenário `mix`, 30s por estágio, geração em
8 processos.

| Usuários | req/s | p50 | p95 | p99 | erro servidor | falha cliente |
|---|---|---|---|---|---|---|
| 100 | 1454 | 19ms | 231ms | 385ms | **0,00%** | 0,00% |
| 250 | 885 | 15ms | 184ms | 10479ms | **0,00%** | 2,35% |

**100 usuários simultâneos passa em todos os limiares.**

### O gargalo medido foi o gerador, não a plataforma

Durante um estágio de 500 usuários, o tail do Worker registrou:

```
outcome    2218 ok · 1 canceled · 0 exception
status     2012 × 401 (rotas com sessão)  ·  206 × 200
cpuTime    p50 1ms · p95 3ms · p99 5ms · max 133ms
```

Zero exceção, CPU quase parada. A vazão CAINDO enquanto o p50 continua baixo e
o p95 explode é assinatura de fila no gerador. Uma máquina só não sustenta
muito além de ~200 conexões simultâneas.

**Os degraus de 1.000, 2.500 e 5.000 continuam sem medição.** Precisam de
geração distribuída — várias máquinas ou um serviço de carga. Medir daqui e
declarar aprovado seria inventar.

### Dois gargalos reais encontrados e corrigidos

**A home estourava o limite de CPU do Worker.** Sob 100 usuários,
`Worker exceeded CPU time limit` em `GET /` — 65% do tráfego do cenário.

Duas causas, as duas de arquitetura:

1. `apps/web/lib/internal-api.ts` fazia `createApp()` em escopo de módulo, com
   import estático da API. Cada isolate novo instanciava a API inteira, com
   todas as rotas e o driver do PostgreSQL. Virou import dinâmico e preguiçoso:
   em staging e produção o Service Binding sempre existe, então esse caminho
   nunca é tocado.

2. A home tinha `revalidate = 300` e mesmo assim respondia
   `cache-control: no-store` com `cf-cache-status: BYPASS`. O cliente da API
   lia cookie em toda chamada para repassar sessão, e ler cookie marca a rota
   como dinâmica no Next — o que desliga o cache da página inteira. Leitura de
   dado público passou a não tocar em cookie.

Efeito somado, em 100 usuários:

| | antes | depois |
|---|---|---|
| vazão | 137 req/s | 1454 req/s |
| p50 | 307ms | 19ms |
| erro de servidor | 4,03% | 0,00% |

A home agora é classificada `◐ ISR (300s)` no build e responde `public`.
