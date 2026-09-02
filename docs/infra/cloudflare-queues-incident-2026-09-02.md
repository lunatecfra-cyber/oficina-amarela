# Cloudflare Queues Incident — 2026-09-02

**Status:** root cause confirmed; remediation applied and verified in production on
2026-09-02 — see [Remediation record](#remediation-record--applied-2026-09-02) at
the end. The investigation below is the read-only forensic pass, kept as written.
**Account:** `casamarela` (`53878b12fbc280f03fc30b5875f3522f`)
**Branch:** `infra/cloudflare-scale`
**Investigated:** 2026-09-02 ~14:20 UTC · **Remediated:** 2026-09-02 19:57–20:56 UTC

---

## Executive summary

**What happened.** Two Cloudflare Workers — `oficina-amarela-api` (production) and
`oficina-amarela-api-staging` — each run a Cron trigger set to `* * * * *` (every
minute). Each tick publishes **2 messages** to its maintenance queue. That is
5,760 messages/day across the account, and since Cloudflare bills 3 operations per
message (write + read + delete), **17,280 Queue operations/day**.

The Workers **Free** plan allows **10,000 Queue operations/day, account-wide**.
So the architecture consumes **172.8%** of the entire daily allowance.

**Why.** This is not user traffic. Production has **zero users, zero missions,
zero offers and zero queued emails**. The web Workers served **8 requests in two
days**. 100% of the consumption is a fixed-rate timer publishing no-op sweeps
against an empty database. Consumption is a perfectly flat **720 operations/hour,
24 hours a day**, with no diurnal variation whatsoever.

**Is production at risk?** No — it is **already failing, and has been since
2026-09-01.** This is not a warning about the future. The allowance is exhausted
at roughly **13:53 UTC every day**, after which:

- every `.send()` from the Cron rejects,
- the `scheduled()` handler has no `try`/`catch` on that path, so the Worker throws,
- **production logged 0 successful invocations and 100% exceptions from 14:00 to
  23:59 UTC on 2026-09-01** — a 10-hour total maintenance outage,
- the same thing is happening right now, today.

During that window nothing expires offers, nothing dispatches missions to editors,
and nothing drains the email outbox. And because `maintenanceIsScheduled()` returns
`true` whenever the queue binding merely *exists*, the per-request fallback sweep
stays disabled — **there is no degradation path.** A queue budget problem becomes a
complete stoppage of all background work.

**Primary root cause.** A once-per-minute Cron in **two environments** publishing
**two separate messages per tick** to do periodic polling work that (a) almost
always has nothing to do and (b) does not need a queue at all. Ranked contributions
are in [Root cause](#root-cause).

**Immediate action recommended.** Remove the Cron trigger from
`oficina-amarela-api-staging` (halves consumption instantly, one command, zero code)
and reduce the production Cron to `*/5 * * * *`. That alone takes the account from
173% to 17% while the proper fix ships. See [Immediate](#immediate).

> **Note on the plan assumption.** `docs/CLOUDFLARE_COST_MODEL.md:189` models Queues
> at `$0.40/M ops` with 1M/month included — those are **Workers Paid** numbers. The
> account is on **Workers Free**. The architecture was designed against a plan the
> account is not on. That mismatch is the reason a "reasonable" design became a
> 173% overrun.

---

## Current Queue architecture

Verified against `wrangler queues list`, `wrangler queues info`, and the Workers
scripts/schedules API — not just source code.

| Queue | Env | Producer | Consumer | Messages | Batch | Retries | DLQ | DLQ consumer |
|---|---|---|---|---|---|---|---|---|
| `oficina-amarela-manutencao` | production | `oficina-amarela-api` | `oficina-amarela-api` | `mission-queue-sweep`, `email-drain` | size 10 / timeout 5s | 3 | `…-dlq` | **none (0)** |
| `oficina-amarela-manutencao-dlq` | production | — | — | — | — | — | — | **none (0)** |
| `oficina-amarela-manutencao-staging` | staging | `oficina-amarela-api-staging` | `oficina-amarela-api-staging` | same | size 10 / timeout 5s | 3 | `…-staging-dlq` | **none (0)** |
| `oficina-amarela-manutencao-staging-dlq` | staging | — | — | — | — | — | — | **none (0)** |

### Producers — the complete call graph

There are exactly **two** producer call sites in the entire repository. Verified by
grepping `.send(`, `.sendBatch(`, `BACKGROUND_QUEUE` across `apps/` and `packages/`;
the Durable Object, the web Worker, and the ranking service produce nothing.

```
[1] Cron  * * * * *  (BOTH production AND staging)
      apps/api/src/index.ts:51  scheduled()
        └─ enqueueScheduledMaintenance()            background.ts:64
             └─ Promise.all(MAINTENANCE_TASKS.map(q.send))   ← 2 separate .send() calls
                  ├─ { type: "mission-queue-sweep" }  →  oficina-amarela-manutencao
                  └─ { type: "email-drain" }          →  oficina-amarela-manutencao
                        └─ consumer: index.ts:99 queue()
                             └─ runBackgroundTask()   background.ts:11
                                  ├─ missionQueue.expireOffers()   → D1 UPDATE … RETURNING
                                  ├─ missionQueue.dispatchOffers() → D1 SELECT LIMIT 20 (+INSERT)
                                  └─ drainEmailQueueNow()          → D1 outbox claim
                             (no secondary queue — the consumer never enqueues)

[2] POST /missions  (user action, spokesperson creates a mission)
      apps/api/src/routes/missions-crud.ts:32
        └─ requestMissionDispatch()                  background.ts:53
             └─ BACKGROUND_QUEUE.send({ type: "mission-queue-sweep" })
```

**The consumer never enqueues.** No recursion, no fan-out, no secondary queue.
Cause (J) — recursive re-enqueue — is ruled out.

| Property | Finding |
|---|---|
| Expected messages/day, per env | 2,880 (2/min × 1440) |
| Operations per message | 3 (write + read + delete), messages are ~140 bytes ≪ 64 KB |
| Can the consumer enqueue? | **No** |
| Is processing idempotent? | **Yes**, but incidentally — see [Retry/ack audit](#retryack-audit) |

---

## Cloudflare operation accounting

Sources, retrieved 2026-09-02:

- <https://developers.cloudflare.com/workers/platform/pricing/> § Queues
- <https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/>
- <https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/>

| Question | Answer |
|---|---|
| Free-tier daily allowance | **10,000 operations/day**, account-wide, across reads + writes + deletes |
| What counts as an operation | One op per **64 KB** written, read, or deleted |
| Are send and delivery separate? | **Yes.** Typical message = 1 write + 1 read + 1 delete = **3 ops** |
| Message size accounting | KB = 1,000 bytes; ~100 bytes internal metadata per message. Ours ≈ 140 bytes → 1 chunk → exactly 3 ops |
| Effect of batch sends | **None.** "Operations are per message, not per batch." A batch of 10 = 10 writes + 10 reads + 10 deletes. **Batching does not reduce operations.** |
| Effect of retries | Each retry = **1 read op per message**. A retried batch of 10 costs 10 ops per retry |
| Effect of delayed messages | No extra op for the delay itself |
| Effect of DLQ | Reaching max retries and writing to DLQ = **1 write per 64 KB**. Docs' example: retried 3×, fails on the 4th, lands in DLQ ⇒ **5 read operations** |
| Do failed deliveries count again? | **Yes** — every redelivery attempt is a fresh read op |
| Expired messages | Write + delete only (never read) |
| Daily reset | **00:00 UTC** |
| What happens at 100% | Further operations **fail with an error** until reset |
| Do messages stay queued? | Retention on free tier is **24 h, non-configurable** |
| Do producers keep accepting? | **No.** Observed: `.send()` rejects, and the throw propagates out of `scheduled()` |

**Key consequence for this incident:** because ops are counted *per message*, the
common instinct — "batch the sends" — would have changed **nothing**. The only
levers are *fewer messages* or *fewer operations per message*.

---

## Observed production usage

All figures from the Cloudflare GraphQL Analytics API
(`queueMessageOperationsAdaptiveGroups`, `workersInvocationsAdaptive`,
`d1AnalyticsAdaptiveGroups`).

### Daily billable operations, account-wide

| Date | Operations | % of 10,000/day | Note |
|---|---:|---:|---|
| 2026-08-31 | 9,339 | **93.4%** | partial day — both envs deployed mid-day |
| 2026-09-01 | 10,044 | **100.4%** | **limit hit, clipped** |
| 2026-09-02 | 10,020 | **100.2%** | **limit hit by 14:00 UTC** (day still in progress) |

### Hourly shape — the signature of a timer, not of users

```
hour(UTC)      PROD.W PROD.R PROD.D  STG.W  STG.R  STG.D  total   cumulative
2026-09-01T00     122    120    118    122    120    118    720          720
2026-09-01T04     116    120    124    128    120    112    720        3,600
2026-09-01T08     112    120    128    120    120    120    720        6,480
2026-09-01T12     114    120    126    114    120    126    720        9,360
2026-09-01T13     118    114    110    116    114    112    684       10,044  ← ALLOWANCE EXHAUSTED
2026-09-01T14        (no further operations recorded — delivery stopped)
   … through 23:59
2026-09-02T00     114    118    122    116    118    120    708          708  ← reset
2026-09-02T13     108    112    116    114    112    110    672       10,020  ← EXHAUSTED AGAIN
```

**720 operations/hour, flat, every hour, both days, zero variance.** That is
120 writes + 120 reads + 120 deletes per queue per hour — exactly 2 messages/minute
per environment. There is no traffic-shaped curve because there is no traffic.

### Worker invocations, 2026-09-01 → 2026-09-02

| Script | Status | Requests | Errors |
|---|---|---:|---:|
| `oficina-amarela-api-staging` | success | 3,323 | 0 |
| `oficina-amarela-api` | success | 3,285 | 0 |
| `oficina-amarela-api` | **scriptThrewException** | **639** | **639** |
| `oficina-amarela-api-staging` | **scriptThrewException** | **630** | **630** |
| `oficina-amarela-web` | success | **3** | 0 |
| `oficina-amarela-web-staging` | success | **5** | 0 |

The web Workers served **8 requests in two days**. There are no users.

### The outage, hour by hour (`oficina-amarela-api`)

| hour (UTC) | success | threw |
|---|---:|---:|
| 2026-09-01 00:00 – 12:00 | ~120/h | **0** |
| 2026-09-01 13:00 | 113 | 3 |
| **2026-09-01 14:00** | **0** | **78** |
| 2026-09-01 15:00 – 23:00 | **0** | 48–72 each hour |
| 2026-09-02 00:00 | 109 | 1 |
| 2026-09-02 01:00 – 12:00 | ~120/h | 0 |
| 2026-09-02 13:00 | 102 | 3 |
| **2026-09-02 14:00** | **0** | **29** (ongoing) |

Exception onset coincides **exactly** with allowance exhaustion, and recovery
coincides **exactly** with the 00:00 UTC reset. This is causation, not correlation.

### Useful work performed — the denominator

Production D1 (`oficina-amarela`, `a9ac89e5-…`), queried live:

| missions | available | offers | pending | emails | unsent | users |
|---:|---:|---:|---:|---:|---:|---:|
| **0** | **0** | **0** | **0** | **0** | **0** | **0** |

Corroborated by D1 analytics — **`writeQueries` = 0 on both 2026-09-01 and
2026-09-02** for production. The sweeps ran ~1,643 times/day and wrote nothing,
because there was nothing to write.

Staging holds seed data (7 missions, 7 offers, 16 users) and equally performed
0 write queries on those days.

*(D1 itself is not a constraint: 41,852 rows read/day on staging against a
5M/day free allowance. Queues is the sole binding limit.)*

---

## Expected vs actual usage

**Expected**, for a pre-launch product with no users:

```
0 user actions/day
  → 0 queue messages
  → 0 Queue operations
plus a modest heartbeat for periodic maintenance.
```

**Actual:**

```
0 user actions/day
  → 5,760 queue messages/day
  → 17,280 Queue operations/day   (172.8% of the free-tier allowance)
```

**Difference: ≈ 17,280 unexpected operations/day**, of which **≈ 7,280/day are
physically unservable** — they exceed the allowance and simply fail.

### Where every operation comes from

| Source | Messages/day | Ops/day | % of consumption | % of allowance |
|---|---:|---:|---:|---:|
| Cron `* * * * *` → **production** | 2,880 | 8,640 | 50.0% | 86.4% |
| Cron `* * * * *` → **staging** | 2,880 | 8,640 | 50.0% | 86.4% |
| User-driven (`POST /missions`) | **0** | **0** | 0.0% | 0.0% |
| Retries | **0** | **0** | 0.0% | 0.0% |
| Dead-letter queues | **0** | **0** | 0.0% | 0.0% |
| **Total** | **5,760** | **17,280** | **100%** | **172.8%** |

### The headline ratio

```
TOTAL QUEUE OPERATIONS ÷ USEFUL LOGICAL JOBS COMPLETED
        =   17,280  ÷  0
        =   undefined (no useful work was performed at all)
```

Being maximally generous and counting every *attempted* sweep as a "job":

```
17,280 ops ÷ 2,880 sweeps = 6.0 ops per sweep
```

…but all 2,880 sweeps were no-ops against an empty database. The honest reading is
that **the entire allowance is spent on polling for work that does not exist.**

Amplification factors, in order:

1. **×2** — the same workload runs in two environments sharing one account quota.
2. **×2** — each tick sends two *separate* messages instead of one unit of work.
3. **×3** — Cloudflare's write + read + delete accounting per message.
4. **×1440** — once per minute, unconditionally, whether or not there is work.

`2 × 2 × 3 × 1440 = 17,280`. That is the whole incident in one line.

---

## Root cause

Ranked by contribution. Using the taxonomy from the brief, this is **P — a
combination**, specifically **F + H + L**, with **N and O as latent multipliers**.

### 1. (F + L) Cron polling through a queue, once per minute — 100% of consumption

`apps/api/wrangler.jsonc` sets `"triggers": {"crons": ["* * * * *"]}`. Each tick
publishes 2 messages that poll an empty database. This is **polling implemented
through queues (L)** at a **frequency far above what the work requires (F)**.

The queue adds nothing here. Its stated justification —
`apps/api/src/background.ts:38-44`, *"on the queue each task has a retry and, once
exhausted, lands in the dead letter queue instead of vanishing"* — does not hold for
this workload:

- The tasks are **idempotent periodic sweeps**. The next tick, 60 seconds later,
  *is* the retry. A retry mechanism is redundant.
- The DLQ has **zero consumers** (verified). Nothing that lands there is ever read.
  It is not a safety net; it is a black hole with a 24-hour expiry.

So the queue hop costs 3 operations per message to buy a retry that already exists
and a DLQ nobody reads.

### 2. (H) Staging duplicates production against a shared account quota — 50%

Both API Workers carry an identical `* * * * *` trigger. The resources are correctly
isolated (separate queues, separate D1, separate Workers) — but **the 10,000 ops/day
limit is per account, not per environment.** Staging, holding 7 seed missions,
consumes 86.4% of production's daily allowance by itself.

### 3. (K) One logical task split across two messages — ×2 multiplier

`MAINTENANCE_TASKS` (`background.ts:29-32`) is two messages dispatched via
`Promise.all` (`background.ts:67`). They are always produced together, always
consumed together, in the same batch, against the same database. They are one
logical maintenance tick represented as two billable messages.

Note that `sendBatch()` would **not** help — operations are counted per message.
Only *merging the two tasks into one message* halves this.

### 4. (N + O) No error handling on the publish path — converts overspend into outage

`apps/api/src/index.ts:58-68`:

```ts
if (env?.BACKGROUND_QUEUE) {
  const count = await enqueueScheduledMaintenance(env.BACKGROUND_QUEUE);  // ← no try/catch
  …
  return;
}
```

The non-queue branch below it is wrapped in `try/catch/finally` (lines 72-97). The
queue branch is not. When `.send()` rejects at the limit, the throw escapes
`scheduled()` — this is the direct cause of all 639 + 630 `scriptThrewException`
invocations.

### 5. (N) No degradation path when the queue is unavailable

`apps/api/src/routes/editor-queue.ts:28`:

```ts
export function maintenanceIsScheduled(env: Bindings | undefined): boolean {
  return Boolean(env?.BACKGROUND_QUEUE);   // presence of a binding ≠ a working queue
}
```

The per-request fallback sweep is disabled whenever the binding *exists*, regardless
of whether the queue is actually functioning. So for 10 hours a day, with the queue
refusing every operation, nothing runs the maintenance the request path is perfectly
capable of running. The reasoning in the comment (avoid double-processing) is sound;
the signal it keys on is wrong.

### Explicitly ruled out, with evidence

| Hypothesis | Verdict | Evidence |
|---|---|---|
| (A) Legitimate volume | **Ruled out** | 0 users, 0 missions, 0 rows written; 8 web requests in 2 days |
| (B) Duplicate production | **Ruled out** | writes = reads = deletes, exactly 1:1:1 |
| (C) Excessive retries | **Ruled out** | ReadMessage == WriteMessage every hour; a retry would show reads > writes |
| (D) Consumer failures | **Ruled out** | `DeleteMessage` outcome = `success` for 100% of messages |
| (E) Accidental loop | **Ruled out** | Consumer has no producer call; rate is exactly 2/min, not growing |
| (G) Maintenance workers | **Confirmed — this is it** | see #1 |
| (I) Dev/staging → prod queues | **Ruled out** | Bindings correctly separated; the sharing is of *quota*, not of queues |
| (J) Recursive re-enqueue | **Ruled out** | `runBackgroundTask` never enqueues |
| (M) Poison message | **Ruled out** | 0 DLQ operations on either DLQ |
| Abandoned Workers/triggers | **Ruled out** | Account holds exactly 4 Workers, all current; exactly 2 cron triggers |

---

## Evidence

### Configuration

- `apps/api/wrangler.jsonc` — `env.staging.triggers.crons = ["* * * * *"]`
- `apps/api/wrangler.jsonc` — `env.production.triggers.crons = ["* * * * *"]`
- `apps/api/wrangler.jsonc` — both envs: `max_batch_size: 10`, `max_batch_timeout: 5`, `max_retries: 3`, DLQ configured
- `docs/CLOUDFLARE_COST_MODEL.md:189` — models Queues on **Workers Paid** pricing; account is on **Free**

### Code

- `apps/api/src/index.ts:51-98` — `scheduled()`; queue branch (58-68) unprotected
- `apps/api/src/index.ts:99-147` — `queue()` batch consumer; no per-message `ack()`, rethrows on any failure
- `apps/api/src/background.ts:29-32` — `MAINTENANCE_TASKS`, two messages
- `apps/api/src/background.ts:64-69` — `enqueueScheduledMaintenance`, two `.send()` calls
- `apps/api/src/background.ts:11-27` — `runBackgroundTask`; throws on unknown/invalid message
- `apps/api/src/routes/editor-queue.ts:28-36` — `maintenanceIsScheduled` / `sweepQueueIfDue`
- `apps/api/src/routes/missions-crud.ts:32` — the only user-driven producer
- `packages/db/src/d1/mission-queue.ts:169-229` — `dispatchOffers` (`LIMIT 20`), `expireOffers` (set-based UPDATE)

### Live infrastructure (read-only commands)

```
wrangler queues list          → 4 queues; both DLQs have 0 consumers
wrangler queues info oficina-amarela-manutencao
                              → producer & consumer both worker:oficina-amarela-api
GET /workers/scripts          → exactly 4 workers, no abandoned deployments
GET /workers/scripts/*/schedules
                              → oficina-amarela-api          : ["* * * * *"]
                                oficina-amarela-api-staging  : ["* * * * *"]
                                oficina-amarela-web          : none
                                oficina-amarela-web-staging  : none
wrangler d1 execute oficina-amarela --remote
                              → missions 0, offers 0, emails 0, users 0
```

### Analytics (GraphQL API)

- `queueMessageOperationsAdaptiveGroups` — per-hour billableOperations by queue/action/outcome
- `workersInvocationsAdaptive` — success vs `scriptThrewException` per hour per script
- `d1AnalyticsAdaptiveGroups` — `writeQueries` = 0 for production on 09-01 and 09-02

### Incidental finding (not a cause — but a live deployment hazard)

Production D1 still uses the Portuguese schema (`pautas`, `ofertas`, `fila_emails`).
The deployed Worker (2026-08-31) matches it. Commit `04af182`
*"identificador do schema em inglês"* renames these to `missions`, `offers`. **The
current branch will not run against the current production database.** Deploying
`infra/cloudflare-scale` without first applying the rename migration will make every
query fail with `no such table: missions` — confirmed by direct query. Track this
separately from the Queue incident; it is a P0 for the next deploy.

---

## Retry/ack audit

Current retry behaviour is **clean** — 0 retries, 0 DLQ messages, 100% delete
success. Nothing below is currently firing. All of it is latent risk that becomes
expensive the moment real traffic arrives.

| # | Finding | Location | Risk |
|---|---|---|---|
| R1 | **Batch-level failure semantics.** The handler loops over `batch.messages` with no per-message `try`/`catch` and rethrows. One failing message retries **the entire batch** — including messages already processed successfully. | `index.ts:106-127` | With `max_batch_size: 10`, one poison message costs 10 reads per retry × 3 retries = **30 extra ops**, plus 10 DLQ writes. A 4× amplifier on any failure. |
| R2 | **No explicit `ack()`.** The consumer relies on implicit whole-batch acknowledgement. There is no `message.ack()` to protect messages that already succeeded. | `index.ts:109-121` | Successful work is replayed on every batch retry. |
| R3 | **Unknown message types throw.** `runBackgroundTask` throws `"Unknown background task message"` / `"Invalid background task message"`. | `background.ts:16,26` | Adding a message type and deploying **producer before consumer** creates a poison batch that retries 3× then silently dies in a DLQ nobody reads. |
| R4 | **Publish path unprotected.** No `try`/`catch` around `enqueueScheduledMaintenance`. | `index.ts:58-68` | **Actively firing** — cause of all 1,269 exceptions. |
| R5 | **DLQs have no consumers.** | `wrangler queues list` | Anything that fails 3× disappears after 24 h with no alert and no record. |

### Can one logical job be processed more than once?

**Yes — but it is currently safe, incidentally rather than by design.**

Duplicate-processing paths:

1. A batch retry replays already-succeeded messages (R1/R2).
2. `POST /missions` enqueues `mission-queue-sweep` while the Cron independently
   enqueues one every minute — two messages, same work, arbitrarily interleaved.

Why it is harmless today:

- `expireOffers()` is a single set-based `UPDATE … WHERE status='pendente'` —
  re-running it matches nothing the second time.
- `dispatchOffers()` re-reads `status='disponivel'` each run; a mission already
  offered is no longer selected.
- The email outbox uses a claim-with-backoff plus a stable idempotency key
  (`packages/db/src/email-queue.ts:15-36`).

**This safety is a property of the SQL, not of the queue layer.** There is no
idempotency key on the queue messages themselves. Any future task that is not
naturally set-based will duplicate silently. Worth making explicit before launch.

---

## Cron audit

| Property | `oficina-amarela-api` | `oficina-amarela-api-staging` |
|---|---|---|
| Schedule | `* * * * *` (every minute) | `* * * * *` (every minute) |
| What it does | Publishes 2 maintenance messages | Identical |
| Messages per execution | **2** | **2** |
| Scans whole tables? | **No** — `dispatchOffers` uses `LIMIT 20`; `expireOffers` is a bounded set-based UPDATE | Same |
| Enqueues unchanged records? | **N/A** — it enqueues *tasks*, not records. But it enqueues **unconditionally**, whether or not work exists | Same |
| Paginates safely? | Yes, `LIMIT 20` per run | Same |
| Cursor/checkpoint? | Not needed — set-based, self-limiting via status transitions | Same |
| Overlapping executions? | No — work completes in milliseconds; ticks are 60 s apart | Same |
| Two runs on the same entity? | Possible, but idempotent (see above) | Same |

**The Cron is not the "scan 2,000 rows, enqueue 2,000 messages" antipattern.** The
per-execution work is small and well-bounded. The problem is purely **frequency ×
environments × messages-per-tick**, and that it publishes even when there is
demonstrably nothing to do (0 write queries across two full days).

The single highest-value change here is **conditionality**: do not pay 6 operations
per minute to discover that an empty table is still empty.

---

## Environment isolation audit

| Check | Result |
|---|---|
| Dev uses production queues? | **No.** The default (dev) environment defines no queue binding at all. `maintenanceIsScheduled()` returns `false`, and maintenance runs inline per request. Correct. |
| Preview uses production queues? | **No preview environments configured.** |
| Staging uses production queues? | **No.** `oficina-amarela-manutencao-staging` is a distinct queue with a distinct D1 and DLQ. |
| Local tests can write to production? | **No.** No queue binding locally; D1 bindings are env-scoped. |
| Old Workers still running Cron? | **No.** Account holds exactly 4 Workers, all deployed 2026-08-30/31, all current. |
| Abandoned deployments with live triggers? | **No.** `/schedules` confirms only the 2 API Workers carry triggers. |
| Duplicate consumers on a queue? | **No.** Each queue reports exactly 1 producer and 1 consumer. |
| Bindings match intended environment? | **Yes.** Verified end to end. |

**Resource isolation is correct. Quota isolation does not exist and cannot be
configured.** This is the finding that matters: the free-tier limit is enforced at
the *account* level, so a correctly-isolated staging environment still consumes half
of production's operational budget. Cloudflare provides no per-environment Queue
quota. The only controls are *fewer messages in staging* or *a separate account*.

Full Worker/Queue relationship map:

```
oficina-amarela-web         --service binding-->  oficina-amarela-api
                                                    ├─ cron * * * * *  --> oficina-amarela-manutencao
                                                    ├─ consumer        <-- oficina-amarela-manutencao
                                                    ├─ D1  oficina-amarela  (a9ac89e5…)
                                                    └─ DO  MissionCoordinator

oficina-amarela-web-staging --service binding-->  oficina-amarela-api-staging
                                                    ├─ cron * * * * *  --> oficina-amarela-manutencao-staging
                                                    ├─ consumer        <-- oficina-amarela-manutencao-staging
                                                    ├─ D1  oficina-amarela-staging (b667d137…)
                                                    └─ DO  MissionCoordinator

oficina-amarela-manutencao-dlq          (0 producers, 0 consumers — unreachable)
oficina-amarela-manutencao-staging-dlq  (0 producers, 0 consumers — unreachable)
```

---

## Capacity model

### Fan-out per user action (measured, not assumed)

| User action | Queue messages | Deliveries | Total ops |
|---|---:|---:|---:|
| Page view / any web request | 0 | 0 | **0** |
| Login, browse missions, read profile | 0 | 0 | **0** |
| **Spokesperson creates a mission** (`POST /missions`) | 1 | 1 | **3** |
| Editor polls `GET /queue/next` | 0 | 0 | **0** |
| Editor accepts an offer | 0 | 0 | **0** (inline `dispatchOffers` + inline drain) |
| Editor declines an offer | 0 | 0 | **0** (inline `dispatchOffers`) |
| Cron tick (per environment) | 2 | 2 | **6** |

Only **one** user action produces queue traffic. Page views and editor polling
produce none — so traffic volume is a poor proxy for queue cost here.

### Formulas

```
ops_per_day  =  (missions_created_per_day × 3)  +  (1440 / cron_period_minutes × messages_per_tick × 3 × environments)

maintenance_floor  =  (1440 / period) × msgs_per_tick × 3 × envs
mission_headroom   =  (10,000 − maintenance_floor) / 3
```

### Maintenance floor under different configurations

| Configuration | Msgs/day | Ops/day | % allowance | Mission headroom/day |
|---|---:|---:|---:|---:|
| **Current** (1 min, 2 msgs, 2 envs) | 5,760 | **17,280** | **172.8%** | **−2,427 (already negative)** |
| Staging cron removed | 2,880 | 8,640 | 86.4% | 453 |
| + merge to 1 message | 1,440 | 4,320 | 43.2% | 1,893 |
| + every 5 min | 288 | 864 | **8.6%** | **3,045** |
| Every 5 min, 1 msg, **prod only, cron does work inline (no queue)** | 0 | **0** | **0%** | **3,333** |

### Traffic scenarios, after the recommended fix (864 ops/day floor, 9,136 ops free)

Assumption stated explicitly: in an editorial workflow only spokespeople create
missions, and a given spokesperson creates well under one per day. I model
**5% of active users create 1 mission/day** — deliberately generous.

| Scenario | Active users/day | Missions/day | Mission ops | + floor | Total | % allowance |
|---|---:|---:|---:|---:|---:|---:|
| Today | 0 | 0 | 0 | 864 | 864 | **8.6%** |
| Soft launch | 200 | 10 | 30 | 864 | 894 | **8.9%** |
| Target | 2,000 | 100 | 300 | 864 | 1,164 | **11.6%** |
| Growth | 10,000 | 500 | 1,500 | 864 | 2,364 | **23.6%** |
| Large | 50,000 | 2,500 | 7,500 | 864 | 8,364 | **83.6%** ⚠ |
| Viral | 200,000 visits, 2% register, 5% create | 200 | 600 | 864 | 1,464 | **14.6%** |

**Ceiling: ≈ 3,045 missions/day**, i.e. roughly **60,000 active users** at the
modelled 5% creation rate.

### Is the free tier fundamentally sufficient?

**Yes — comfortably, once the inefficiency is corrected.** The free tier supports
around 3,000 missions/day. The current architecture fails at *zero* missions/day.
The gap is entirely self-inflicted; it is not a Cloudflare capacity problem and
upgrading the plan is not the fix. Upgrading would merely convert a visible outage
into an invisible recurring charge for work that accomplishes nothing.

The point at which Workers Paid becomes genuinely warranted is around **50,000
daily active users** — and by then the $5/month is trivially justified.

---

## Recommended fixes

### Immediate

Halt the daily outage. Config-only, no code, no deploy of application logic.

**P0-1 — Remove the staging Cron trigger.** Instantly halves account-wide
consumption: 172.8% → 86.4%, below the limit.
*File:* `apps/api/wrangler.jsonc`, delete `"triggers": {"crons": ["* * * * *"]}`
from `env.staging`. Staging maintenance still runs — the request path handles it
once P0-3 lands, and staging has no real traffic to maintain anyway.

**P0-2 — Reduce the production Cron to `*/5 * * * *`.** 86.4% → 17.3%.
*File:* `apps/api/wrangler.jsonc`, `env.production.triggers.crons`.
Offers expire on a 5-minute granularity instead of 1-minute. Given
`OFFER_MINUTES` is measured in minutes and new missions already dispatch
event-driven via `requestMissionDispatch`, this is not user-visible.

**P0-3 — Wrap the publish path and fall back to inline execution.**
*File:* `apps/api/src/index.ts:58-68`. Put the queue publish in `try`/`catch`; on
failure, run `runScheduledMaintenance()` inline — the code path already exists and
is already exercised by dev and tests. This alone would have prevented all 1,269
exceptions and both 10-hour outages. **Ship this even if nothing else ships.**

**P0-4 — Base `maintenanceIsScheduled()` on queue health, not binding presence.**
*File:* `apps/api/src/routes/editor-queue.ts:28`. A binding that exists but rejects
every operation must not disable the fallback. `claimPeriodicTask` already prevents
double-processing, as its own comment notes — so the fallback is safe to re-enable.

> Together P0-1 and P0-2 take the account to **17.3%** and can be applied with a
> config change alone. P0-3 and P0-4 remove the failure mode permanently.

### Before launch

**P1-1 — Merge `MAINTENANCE_TASKS` into a single message.** Two messages that are
always produced together, consumed together, and operate on the same database are
one logical job. Halves whatever the maintenance floor ends up being.
*Files:* `apps/api/src/background.ts:29-32,64-69`; consumer handles one
`{ type: "maintenance" }` running both sweeps.

**P1-2 — Reconsider whether Cron maintenance needs the queue at all.** *(Recommended.)*
The stated benefits — retry and DLQ — do not materialise: the next tick *is* the
retry for an idempotent sweep, and the DLQ has no consumer. Having `scheduled()`
call `runScheduledMaintenance()` directly takes the maintenance floor to **0
operations** and removes an entire failure mode. **Keep the queue for
`requestMissionDispatch`**, where it earns its cost: user-facing, event-driven, and
genuinely benefits from durability and retry. This is a targeted removal backed by
the evidence above — not a rollback of the queue architecture.

**P1-3 — Make the Cron conditional.** Have the sweep check cheaply for pending work
before enqueuing (or before doing anything). Two full days produced **0 write
queries**; paying for a round trip to learn that is pure waste.

**P1-4 — Per-message error isolation in the consumer.** Wrap each message in
`try`/`catch`; `message.ack()` on success, `message.retry()` only on the failure.
*File:* `apps/api/src/index.ts:106-127`. Prevents one poison message from replaying
a whole batch of 10 — a 4× cost amplifier and a duplicate-processing source.

**P1-5 — Tolerate unknown message types.** `runBackgroundTask` should log-and-ack an
unrecognised type rather than throw, so a producer-before-consumer deploy cannot
poison a batch. *File:* `apps/api/src/background.ts:16,26`.

**P1-6 — Attach a consumer (or an alert) to the DLQs.** A DLQ nobody reads is not a
safety net. Even a handler that just logs would be an improvement.

**P1-7 — Apply the schema rename to production before deploying this branch.**
Unrelated to Queues, but the current branch will fail against the current production
database on every query. See [Evidence](#incidental-finding-not-a-cause--but-a-live-deployment-hazard).

### Later optimization

**P2-1 — Give staging its own Cloudflare account** if it ever needs a real
heartbeat. It is the only way to get true quota isolation.

**P2-2 — Add idempotency keys to queue messages**, so correctness stops depending on
every task happening to be set-based SQL.

**P2-3 — Move to Workers Paid ($5/month)** — but only on evidence, at roughly
50,000 DAU. **Not now.** Upgrading today would hide a defect that wastes 100% of its
budget rather than fixing it.

**P2-4 — Consider Durable Object alarms** for offer expiry. `MissionCoordinator`
already exists; an alarm set at an offer's actual expiry time replaces polling
entirely with exact-time execution and no queue operations. Worth it only if
maintenance ever becomes hot again.

---

## Proposed monitoring

Keep it Cloudflare-native and cheap. The telemetry plumbing already exists —
`recordBackgroundTelemetry()` (`apps/api/src/telemetry.ts`) already writes to an
Analytics Engine binding (`env.TELEMETRY ?? env.ANALYTICS`) on every cron and queue
invocation. Reuse it rather than building anything new.

### 1. Cloudflare notifications (zero code)

Dashboard → Notifications → Usage Based Billing, on the Queues metric:
**50% / 75% / 90%**. Already partially configured — this is what fired today.

### 2. Burn-rate alert (the one that actually helps)

The 75% daily alert is structurally too late: at a flat 720 ops/hour it arrives
around 10:25 UTC with only 3.5 hours of budget left. A **rate** alert catches it on
day one instead of after exhaustion:

```
projected_daily = ops_last_hour × 24
alert if projected_daily > 10,000        # today: 720 × 24 = 17,280 → fires at 01:00 UTC
```

This single check would have caught the incident **within an hour of deploy**,
rather than after two 10-hour outages.

### 3. Daily budget model

Cheap to compute from the same GraphQL query used in this investigation:

```
allowance          = 10,000 ops/day
consumed_today     = Σ billableOperations since 00:00 UTC
burn_rate          = ops in the last 60 min
hours_to_exhaustion = (allowance − consumed_today) / burn_rate
```

Alert when `hours_to_exhaustion < hours_remaining_in_day`. On 2026-09-01 at 01:00
UTC that read `13.9 < 23.0` — an unambiguous same-day signal.

### 4. Metrics worth having

Available from `queueMessageOperationsAdaptiveGroups` with no instrumentation:
messages produced/hour, consumed/hour, retries/hour (reads − writes), failures/hour
(`outcome != success`), backlog, ops/message.

Available from the existing Analytics Engine writes: ops per logical job, producer
source, consumer latency (`durationMs`), D1 queries per task.

Worth adding: a duplicate/idempotency rejection counter, once P2-2 lands.

### 5. One guardrail worth more than any dashboard

A test asserting the **maintenance floor** — cron period × messages per tick ×
3 × environments must stay under a stated fraction of 10,000/day. The existing
`queue-config.test.ts` is the natural home. A unit test would have caught
`17,280 > 10,000` before this ever deployed. No dashboard catches a
misconfiguration at review time; an assertion does.

---

## Open questions

1. **Is staging meant to run unattended at all?** If it only needs to be alive
   during active testing, removing its Cron permanently (P0-1) costs nothing. If it
   must mirror production behaviour continuously, it needs its own account (P2-1).
   *This determines whether P0-1 is permanent or temporary.*

2. **What is the real required latency for offer expiry?** `*/5` is proposed as
   obviously-safe. If 15 minutes is acceptable the floor drops further; if
   sub-minute precision is genuinely required, Durable Object alarms (P2-4) are the
   right mechanism rather than a faster poll.

3. **Was the account ever intended to be on Workers Paid?** `CLOUDFLARE_COST_MODEL.md`
   models Paid pricing throughout. If a paid upgrade was always planned for launch,
   the urgency of P1-1/P1-2 drops — though the fixes remain correct on their merits,
   since the current design would burn ~518,000 ops/month achieving nothing.

4. **Is the production database empty by design?** It holds the schema but no data,
   and `migrar-para-d1.mjs` is described as pending "P0-06 confirming the origin".
   Confirming this is intended pre-launch state (rather than data loss) is worth
   five minutes before launch planning proceeds.

---

*Investigation was strictly read-only: no deploys, no configuration changes, no
queue purges, no production data modified, no plan changes. Every number is
reproducible from the Cloudflare GraphQL Analytics API and the read-only `wrangler`
commands listed under [Evidence](#evidence).*

---

# Remediation record — applied 2026-09-02

Executed in two isolated phases. Commit `b2dd16b`.

## Phase 1 — Cron hotfix (19:56–19:57 UTC), no code deployed

Applied with `wrangler triggers deploy`, which updates triggers **without
re-uploading Worker code**. Both Workers had zero routes configured (verified via
the routes API) and the repo declares none, so no route was affected.

| worker | before | after | active version |
|---|---|---|---|
| `oficina-amarela-api` | `* * * * *` | `*/5 * * * *` | `0e19ac6b…` **unchanged** |
| `oficina-amarela-api-staging` | `* * * * *` | `*/15 * * * *` | `a49a52c6…` **unchanged** |

Verified remotely: schedules via the schedules API; active version IDs identical
before and after; production D1 table list byte-identical to the pre-change
baseline; `/health` 200 and `/news` 200. Cron invocation rate fell from ~60/hour
to 12/hour (production) and 4/hour (staging), observed in `workersInvocationsAdaptive`.

## Phase 2 — D1 migration and full deploy

Rehearsed on staging first (58 rows of real data). **The rehearsal caught a defect
that would have silently damaged production.**

### Two defects found in `scripts/aplicar-schema-d1.mjs`

1. **`CREATE TRIGGER` was sent via `--command`, which wrangler splits at the first
   `;`.** Every trigger failed with `incomplete input: SQLITE_ERROR`. Because the
   `DROP TRIGGER` statements run first, the database was left with **zero
   triggers** — losing all five concurrency invariants
   (`claim_mission_on_pending_offer`, `reserve_mission_on_offer_accept`,
   `release_mission_on_offer_close`, `apply_mission_approval`,
   `apply_invitation_redemption`) while the schema still *looked* correct.
   Fixed: trigger statements now go through a temporary `--file`.

2. **Not re-runnable.** SQLite answers a repeated `ALTER TABLE pautas RENAME TO
   missions` with `there is already another table or index with this name`, which
   the "already applied" tolerance list did not match, so re-running a completed
   migration failed. Re-running is exactly what happens when a first attempt stops
   partway. Fixed by adding that phrasing.

### Production migration result

189 statements applied, 8 already-applied, **0 failures**, 18 table renames,
161 column renames, 5 triggers recreated. Verified remotely afterwards:
22 application tables in English, 5 triggers, 23 indexes, and the 2 pre-existing
`login_attempts` rows preserved. Smoke queries using the real application SQL
(mission dispatch, offer expiry, offer insert shape, editor queue join, email
outbox claim, news, ranking, admin audit) all returned `success: true`.

### Deployed

| worker | version | schedule |
|---|---|---|
| `oficina-amarela-api` | `27970af4-d062-43cf-b761-d37e2ce9af89` | `*/5 * * * *` |
| `oficina-amarela-api-staging` | `3183e3a4-bb52-4982-acfb-b99b64265054` | `*/15 * * * *` |

## Runtime proof of the fallback

Today's allowance was already spent before the fix landed, so the first ticks on
the new code ran against a genuinely exhausted queue — the exact condition that
caused the outage:

```
"*/5 * * * *" @ 20:45:34Z - Ok
  (error) [cron-enqueue-error] publicando falhou, executando em linha
          Error: You have exceeded the daily write operations limit in Queues free tier
  (log) {"event":"cron-executed","durationMs":585,"success":true, ...}
```

Three consecutive production ticks (20:45, 20:50, 20:55) and the staging tick at
20:45: **status `Ok`, inline fallback used, maintenance completed, zero
exceptions.** Before the fix this condition produced `scriptThrewException` and no
maintenance at all, for ten hours a day.

## Burn rate

| | operations/day | % of 10,000 |
|---|---:|---:|
| Before | 17,280 | 172.8% |
| After (`*/5` + `*/15`, one message per tick) | 1,152 | 11.5% |

Reduction 93.3%. The 1,152/day figure is arithmetic from the deployed schedules;
it becomes directly observable after the 00:00 UTC reset, since today's counter
was already exhausted at 13:00 UTC by the old configuration.

## Known gap, not fixed

`requestMissionDispatch` (`apps/api/src/background.ts:95`) still has no inline
fallback: when the queue rejects a send, the caller in `missions-crud.ts` catches
and logs, so a mission created during an outage is not dispatched immediately. It
is picked up by the next Cron tick, so the degradation is bounded at ~5 minutes
rather than lost work. Fixing it would mirror the Cron pattern exactly, but it was
outside the validated change set for this deployment.

## Cosmetic

Index names kept their Portuguese spelling (`idx_pautas_fila` now sits on
`missions`) because SQLite's `ALTER TABLE … RENAME TO` retargets indexes without
renaming them. Functionality is unaffected; a database created fresh from `0001`
would differ only in these labels.
