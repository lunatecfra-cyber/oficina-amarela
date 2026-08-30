# Cloudflare Cost Model — Oficina Amarela

> Branch: `infra/cloudflare-scale` · Written 2026-08-30
> **Everything here is modelled, not measured.** No Cloudflare service is deployed
> yet. Replace each projection with real usage data as soon as Phase 19 produces it;
> the method matters more than these numbers.

---

## 1. Unit prices (Cloudflare, verified 2026-08-30)

| Service | Included on Workers Paid ($5/mo) | Overage |
|---|---|---|
| Workers requests | 10 M / month | $0.30 / M |
| Workers CPU | 30 M CPU-ms / month | $0.02 / M CPU-ms |
| D1 storage | 5 GB | $0.75 / GB-month |
| D1 rows read | 25 G / month | $0.001 / M rows |
| D1 rows written | 50 M / month | $1.00 / M rows |
| Durable Objects requests | 1 M / month | $0.15 / M |
| Durable Objects duration | 400,000 GB-s / month | $12.50 / M GB-s |
| Durable Objects SQLite storage | 5 GB-month | $0.20 / GB-month |
| Queues operations | 1 M / month | $0.40 / M (≈3 ops per message: write, read, delete) |
| KV reads | 10 M / month | $0.50 / M |
| KV writes / deletes | 1 M / month | $5.00 / M |
| KV storage | 1 GB | $0.50 / GB-month |
| R2 storage | — | $0.015 / GB-month |
| R2 Class A ops (writes) | — | $4.50 / M |
| R2 Class B ops (reads) | — | $0.36 / M |
| R2 egress | — | **free** |
| Workflows | shares the Workers request + CPU allocation | storage $0.20 / GB-month above 1 GB |

Cloudflare Email Service and Analytics Engine pricing must be confirmed against
the account's own plan before Phase 17 and Phase 20; they are left out of the
totals below rather than guessed.

Current external providers, for comparison (`docs/INFRA.md`, verified 2026-08-13):
Vercel Hobby **R$ 0**, Neon Free **R$ 0**, Resend Free **R$ 0**, Sentry **R$ 0**.
The project pays nothing today and is on plans that forbid or throttle the target
load — Vercel Hobby prohibits commercial use, Neon Free caps at 0.5 GB and
100 CU-h/month.

---

## 2. Traffic model

Assumptions, all explicit and all adjustable:

| Assumption | Value | Basis |
|---|---|---|
| Peak concurrency | 5,000 | initiative target |
| Mix at peak | 3,800 public visitors · 1,000 editors · 200 spokespersons/admins | product shape: public ranking and candidate pages are the wide surface |
| Peak duration | 4 h/day | campaign-hours pattern |
| Off-peak load | 10% of peak, 20 h/day | assumption — **verify against real analytics** |
| Public page view rate | 1 per 45 s per visitor | assumption |
| Editor page navigation | 1 per 120 s per editor | assumption |
| Offer poll interval | **15 s** | measured — `components/mission-offer.tsx:17` |
| Chat poll interval | **5 s** | measured — `components/mission-chat.tsx:39` |
| Editors with a chat open | 20% | assumption |
| Days per month | 30 | — |

Derived request rate at peak:

| Source | Rate |
|---|---|
| Public page views | 84 req/s |
| Editor offer polling | 67 req/s |
| Chat polling (200 editors + 50 spokespersons) | 50 req/s |
| Editor + spokesperson navigation | 12 req/s |
| **Total at peak** | **≈ 213 req/s** |

Monthly requests ≈ (213 × 3600 × 4 + 21 × 3600 × 20) × 30 ≈ **138 M requests/month**,
of which roughly 60% (≈ 83 M) are authenticated.

**Offer polling and chat polling together are 55% of all traffic** and produce
almost no user-visible value per request. That is the first thing to fix, and it
is what the two scenarios below are built to contrast.

---

## 3. Scenario A — naive port (current query patterns, unchanged, on D1)

This is what happens if the code moves to Workers + D1 without addressing
`P1-01` and `P1-02` on the migration board.

Per offer poll, today's `GET /api/editor/queue/next` runs:

| Step | Cost per poll |
|---|---|
| `markEditorActive()` | 1 row written |
| `expireStaleOffers()` | ~200 rows read (join across pending offers × users) |
| `dispatchMissions()` | up to 20 missions × `getNextEditor()`, each an unindexed correlated scan of the editor population — **≈ 20,000 rows read** |
| `getPendingOffer()` | ~5 rows read (3-table join) |

At ≈ 43 M polls/month that is **≈ 870 billion rows read per month**.

| Line | Monthly |
|---|---|
| Workers requests (138 M) | $5 base + 128 M × $0.30/M = **$43** |
| Workers CPU (≈ 1.47 G CPU-ms) | (1,468 − 30) M × $0.02/M = **$29** |
| D1 rows read (≈ 870 G) | (870,000 − 25,000) M × $0.001/M = **$845** |
| D1 rows written (≈ 45 M) | just inside the 50 M allowance — **$0** |
| D1 storage (< 1 GB) | included — **$0** |
| **Total** | **≈ $917 / month** |

The cost is not the real problem. **D1 processes queries single-threaded.** At peak
this design asks for roughly **1,400 queries per second** against one database —
66.7 polls/s × ~21 queries each. Section 2.4 of `CLOUDFLARE_ARCHITECTURE.md` puts
practical D1 throughput at roughly `1 / query_duration`: about 1,000 q/s for 1 ms
queries, 10 q/s for 100 ms ones. `getNextEditor()` is not a 1 ms query.

**Scenario A does not reach 5,000 concurrent users at any price.** It is included
to size the gap, not as an option.

---

## 4. Scenario B — target design

Changes assumed, each tracked on the board:

- Dispatch leaves the request path (`P1-01`): it runs on a schedule or on a Queue
  trigger, not once per editor poll. Estimated 50 k dispatch runs/month.
- `getNextEditor()` is indexed and denormalised (candidate-editor eligibility flags
  maintained on write) down to ~50 rows read per run.
- Presence moves to a Durable Object or a coarse KV write with TTL instead of an
  `UPDATE users` per poll.
- Session revocation is checked on mutations only, with a short cached cutoff for
  reads (`P1-02`), removing ~83 M D1 reads/month.
- Public pages are edge-cached (`P1-03`); assume an 85% hit ratio on the 84 req/s
  public tier, so those requests mostly never reach a Worker.
- Chat moves to a Durable Object with WebSockets (`P1-08`), replacing 50 req/s of
  polling with persistent connections.

| Line | Monthly |
|---|---|
| Workers requests (≈ 59 M after cache offload) | $5 base + 49 M × $0.30/M = **$20** |
| Workers CPU (≈ 450 M CPU-ms) | (450 − 30) M × $0.02/M = **$8** |
| D1 rows read (≈ 0.6 G) | within the 25 G allowance — **$0** |
| D1 rows written (≈ 5 M) | within the 50 M allowance — **$0** |
| D1 storage (< 1 GB) | included — **$0** |
| Durable Objects requests (≈ 65 M: presence + chat + mission claims) | 64 M × $0.15/M = **$10** |
| Durable Objects duration | to be measured — assumed within the 400 k GB-s allowance at this scale | **$0** |
| Queues (≈ 3 M ops) | 2 M × $0.40/M = **$1** |
| KV (config/flags, low volume) | included — **$0** |
| R2 (see §6) | **≈ $32** |
| **Total** | **≈ $71 / month** |

Roughly a **13× cost reduction against Scenario A**, and — more importantly — a
design that fits inside D1's single-threaded execution model.

---

## 5. Scaling curve

Same design as Scenario B, scaled by concurrency. Cloudflare-services only;
R2 media is broken out separately in §6 because it tracks content volume, not
concurrency.

| Concurrent users | Requests/month | Workers (req + CPU) | D1 | DO | Queues | **Total/month** |
|---|---|---|---|---|---|---|
| 500 | ≈ 6 M | $5 | $0 | $0 | $0 | **≈ $5** |
| 1,000 | ≈ 12 M | $7 | $0 | $1 | $0 | **≈ $8** |
| 2,500 | ≈ 30 M | $15 | $0 | $5 | $0 | **≈ $20** |
| 5,000 | ≈ 59 M | $28 | $0 | $10 | $1 | **≈ $39** |

D1 stays at zero marginal cost across the whole curve **only if** the row-read
work stays inside the 25 G/month allowance. That allowance is the single number to
watch: Scenario A consumes about 35× it. Instrument
`rows_read` from the D1 `meta` object on every hot query from day one.

---

## 6. R2 and media

Media cost tracks content, not concurrency. Assumptions:

| Assumption | Value |
|---|---|
| Missions per month | 500 |
| Raw upload per mission | 2 GB (the presign ceiling in `app/api/upload/presign/route.ts`) |
| Delivered edit per mission | 200 MB |
| Retention | 12 months |
| Steady-state stored volume | ≈ 13 TB after a year |

| Line | Monthly at steady state |
|---|---|
| R2 storage (13 TB) | 13,000 × $0.015 = **$195** |
| R2 Class A (uploads, ≈ 5 k ops) | **< $0.05** |
| R2 Class B (playback reads, ≈ 500 k ops) | **≈ $0.18** |
| R2 egress | **$0** |
| **Year-one average (ramping from 0)** | **≈ $32 / month** |

Egress being free is the reason R2 is the right home for raw footage. **Storage
retention policy is the dominant media lever** — raw footage kept forever is the
line item that eventually exceeds every compute cost on this page combined. Decide
a retention window before Phase 15.

Cloudflare Stream is evaluated in Phase 16 for browser previews only. It is priced
per minute stored and per minute delivered, so it only makes sense where adaptive
playback beats serving the R2 original — not as a blanket destination.

---

## 7. Email

| Provider | Today | Plan |
|---|---|---|
| Resend | Free tier, 3,000 emails/month, sandbox sender, domain **not verified** | keep as secondary/fallback through Phase 17 |
| Cloudflare Email Service | not started | test as primary; confirm pricing against the account plan |

Volume estimate at 5,000 concurrent users: mission offers, acceptances, delivery
notifications, approvals, recovery and broadcasts ≈ **50–100 k emails/month**,
which is far past Resend's free tier. This is the strongest cost argument for
Cloudflare Email Service, and the reason Phase 17 exists.

**Blocked:** `oficinaamarela.com.br` still publishes `v=spf1 -all` and a null MX
(`docs/INFRA.md`). No provider can deliver from the domain until DNS is fixed
(`P2-07`).

---

## 8. What to measure before trusting any number here

| Metric | Source |
|---|---|
| `rows_read` / `rows_written` per hot query | D1 `meta` object in the `D1Result` return value |
| Actual query plans | `EXPLAIN QUERY PLAN` — every hot query must show `SEARCH ... USING INDEX`, never `SCAN` |
| Worker CPU-ms per route | Workers Analytics |
| Cache hit ratio per route class | Cloudflare cache analytics |
| Durable Object GB-s | DO metrics |
| Queue depth and latency | Queues metrics |
| Real concurrency and request mix | Analytics Engine, replacing the assumptions in §2 |

Update this document at the end of Phase 19 with measured values, keeping the
modelled figures alongside so the size of the estimation error is visible.
