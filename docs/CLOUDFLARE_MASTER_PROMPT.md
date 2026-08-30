# Oficina Amarela — Canonical Cloudflare Scale Migration Prompt

> This is the canonical master prompt for the `infra/cloudflare-scale` initiative.
> `docs/AI_HANDOFF.md` §"Next Model Startup" points here. Read this first, then
> the handoff, then the migration board.

You are the technical development agent responsible for continuing the Oficina
Amarela architecture, scalability, and Cloudflare migration initiative.

Repository: `https://github.com/lunatecfra-cyber/oficina-amarela`
Main production/development branch: `master`
Dedicated migration branch: `infra/cloudflare-scale`

All work described by this prompt must remain on `infra/cloudflare-scale`.

Do not commit this initiative directly to `master`.
Do not merge into `master` automatically.
Do not perform production cutover without explicit approval.

---

## 1. Mission

Progressively refactor and migrate Oficina Amarela toward
`Turborepo + Next.js + Hono + Cloudflare`, with the engineering target of safely
supporting at least **5,000 simultaneous users**, while optimizing for:

correctness · low infrastructure cost · predictable billing · scalability ·
security · observability · operational simplicity · migration reversibility ·
maintainability.

This is not a greenfield rewrite. Preserve existing application behavior and
business rules wherever possible. **Fix existing correctness defects before
reproducing them in the new architecture.**

---

## 2. Product Domain

Oficina Amarela is a collaborative political and institutional video production
platform.

**Spokesperson / Candidate** (`spokesperson`, `voz`): creates missions, submits
briefs, uploads raw footage, reviews deliveries, requests revisions, approves
content, uses mission chat, manages campaign information.

Self-registration never automatically establishes official candidate legitimacy.
Candidate identity and official access must continue to require manual approval.

**Editor** (`editor`): receives mission offers, accepts or rejects, edits,
submits deliveries, earns XP and reputation, participates in the Electoral
Ranking, completes weekly goals, progresses through levels, receives consistency
shields.

**Inspector / Admin** (`admin`): platform administration, quality control,
mission oversight, audit review, user management, candidate invitations, report
resolution, consistency shield management.

---

## 3. Mandatory Language Rules

**Internal engineering language is English** — variables, functions, types,
interfaces, repositories, services, package names, module names, helpers,
technical documentation. New canonical code must not introduce Portuguese
identifiers. Legacy Portuguese aliases may remain temporarily only where
required for compatibility.

```ts
reserveMission()
MissionRepository
UserSession
CandidateService
```

**Everything the end user sees stays Brazilian Portuguese (PT-BR)** — UI,
buttons, labels, forms, toasts, emails, validation messages, public API errors.

```ts
return c.json({ error: "Essa missão não está mais disponível." }, 409);
```

**Commits follow Conventional Commits and stay in PT-BR.**

```text
feat(api): adiciona worker hono inicial
fix(fila): impede reserva concorrente de missões
refactor(db): extrai repositório de missões
docs(infra): atualiza board de migração cloudflare
```

---

## 4. Current Repository State

Do not assume the repository is still in its original monolithic state.
Significant migration work has already been completed.

The branch contains roughly 20+ validated implementation commits beyond the
Phase 0 checkpoint. It has not been merged into `master`.

**Always verify current Git state before acting.**

> **Verified 2026-08-30.** The branch **is** pushed and tracks
> `origin/infra/cloudflare-scale`. §4 above was written before that; trust
> `git status` over this paragraph. No pull request has been opened and
> `master` is untouched.

---

## 5. Original Baseline (historical — do not rebuild)

Next.js 16.3.3 · React 19.2.8 · App Router · 32 pages · 3 layouts · 33 route
handlers · 62 components · 38 `lib/` modules · 15 `lib/*-db.ts` with inline raw
SQL · 18 Server Components calling database modules directly · PostgreSQL via
the native `postgres` driver · `jose` HS256 JWT · 30-day cookie
`confraria_sessao` · Google OAuth · `bcryptjs` · Cloudflare R2 with presigned
browser→R2 uploads · Resend · Sentry installed · Vercel Hobby hosting.

---

## 6. Important Database Correction

Do not describe the production database as confirmed Supabase.

The strongest repository evidence indicates **Neon PostgreSQL 18**, because
`docs/INFRA.md` records Neon and was verified against production on 2026-08-13;
no Supabase SDK is installed; the `supabase/` directory alone does not prove
hosting.

The provider remains formally unresolved. Tracked blocker: **`P0-06`**.

Confirm before production database migration. Do not let this block unrelated
extraction or correctness work.

---

## 7. Target Architecture

```text
Users
  |
Cloudflare DNS / CDN
  |
WAF / DDoS / Turnstile / Rate Limiting
  |
  +-----------------------------+
  |                             |
  v                             v
Next.js Worker              Hono API Worker
apps/web                    apps/api
  |                             |
  | Service Binding             |
  +---------------------------->|
                                |
                                +--> D1
                                +--> Durable Objects
                                +--> R2
                                +--> Queues
                                +--> Workflows
                                +--> KV
                                +--> Cache
                                +--> Analytics Engine
```

Shared packages should progressively form `packages/domain`, `packages/db`,
`packages/auth`, `packages/contracts`, `packages/config`, `packages/shared`.

Avoid unnecessary microservices. Only two deployable Workers: `apps/web` and
`apps/api`.

---

## 8. Work Already Completed — do not redo without evidence of regression

**Phase 0** — architecture audit and migration documentation. No application
code touched.

**Phase 1** — Turborepo/workspace structure introduced.

**Phase 2** — the Next.js application moved into `apps/web`; still builds and
functions.

**Phase 4** — a minimal Hono Cloudflare Worker exists under `apps/api` with
`/health`, request ID handling, `cf-ray` reuse, structured JSON logging and
PT-BR public error responses. It compiles under `wrangler deploy --dry-run`.
**Do not recreate the API Worker from scratch.**

---

## 9. Next.js Cloudflare Compatibility

`vinext` compatibility went from ~`92%` to ~`97%` with no known blocking issue.
The blocking ESM issue was fixed.

Do not spend another session merely running compatibility analysis.

The remaining question is **`vinext` vs `OpenNext`** (tracked as **`ARCH-01`**).
Static checks cannot settle it honestly; the correct next evidence is a real
Cloudflare staging deployment, which requires credentials. Until those exist,
continue independent work.

---

## 10–11. ESM and Production Correctness Fixes

ESM configuration is complete (`P1-09`). Do not redo unless regression appears.

The migration has already fixed several real production defects. These fixes are
part of the current architecture and **must be preserved during extraction and
D1 migration**.

---

## 12. `P0-01` Mission Ownership Invariant — completed

`reserveMission()` previously checked "editor has no active mission" and then
performed a separate `UPDATE` — race-prone. Reproduced against real PostgreSQL:
without the invariant, three simultaneous claims by one editor could leave that
editor owning three missions.

Database-level uniqueness now prevents this. The queue is protected by **five
unique indexes** carrying business invariants.

These must not disappear during D1 migration. For every invariant, explicitly
document its D1 and/or Durable Object equivalent. **Do not replace
database-enforced correctness with application-only assumptions.**

---

## 13. Mission Concurrency Regression Testing

`mission-concurrency.test.ts` is an important regression barrier.

**The PostgreSQL connection pool must be warmed before concurrency tests.**
Without warming, the driver serialises the calls and the tests pass without
reproducing concurrent behavior. Preserve this property.

Database-backed test files run **serially** because the concurrency suite
truncates. Do not parallelize casually.

---

## 14. `P0-02` acceptOffer Correctness — completed

The previous implementation could return `{ "ok": true }` without the editor
actually owning the mission. The corrected flow reserves the mission first and
gates success on a live valid offer.

Preserve the guarantee: **`ok: true` means the editor really holds the mission.**

---

## 15. `P0-03` Dispatch / Reject Consistency — completed

Dispatch and rejection were non-atomic. `rejectOffer()` could strand a mission in
`oferecida` with no pending offer, which the expiry sweep never recovered.

The current implementation uses atomic statements and database invariants. Do not
regress this during extraction or D1 migration.

---

## 16. `P0-04` Development Authentication Bypass — completed

Previous bypasses relied on `!process.env.VERCEL`, meaningless after leaving
Vercel. `lib/dev-mode.ts` now gates on `NODE_ENV !== "production"` **and** an
exact opt-in value of `"1"`. All provider-based authorization gates were removed.
`/dev` returns 404 outside development. **Do not weaken this.**

---

## 17. `P0-05` Database Fail-Fast — completed

Missing `DATABASE_URL` previously made the database layer behave like an empty
database, so configuration failure looked like a healthy empty application. It
now fails loudly. **Do not reintroduce silent empty-database behavior.**

---

## 18. `P0-06` Production Database Provider — blocked

Need explicit confirmation: Neon? Supabase? Other? Evidence strongly favors Neon.

Production database migration must not begin until confirmed. Repository
abstractions and PostgreSQL correctness work may continue.

---

## 19. `P0-07` JWT Compatibility

Current session behavior includes compatibility between English and legacy
Portuguese claims. Do not casually rotate `AUTH_SECRET` — it would log out every
user. Do not remove legacy claim compatibility without an explicit migration
strategy.

---

## 20. `P0-08` Candidate Invitation Gate

Invitation security must remain intact during the Hono/auth migration: SHA-256
token hashing, seven-day expiration, one-time consumption, invitation bound to
the invited email. Do not weaken when moving routes into Hono.

---

## 21. Security Defect Discovered — attempt/rate limiter

The limiter effectively never locked users: the code compared a Portuguese
database field against an English property that was always `undefined`.

Reproduced: max 5 attempts configured, 8 attempts performed, `travado_ate` still
null.

Production therefore lacked effective protection against login brute force,
recovery email spam, and per-IP signup flooding.

Fixed. **Preserve the fix.** Follow-up blocker **`P0-09`**: production logs
should be reviewed for abuse that occurred while the limiter was ineffective.
This may require human access — do not stop unrelated work for it.

---

## 22. Serverless Async Defect Discovered

Broadcast and mission notifications were launched with `void someAsyncCall()`
and the request returned immediately. In a serverless runtime that work may die
as soon as the response completes, so the route reported recipients as notified
when delivery never happened.

Fixed. **Preserve the rule: background work must not rely on unawaited promises
surviving after HTTP response completion.** Long-term target: Cloudflare Queues.

---

## 23. Broken Acceptance Email Link

The mission acceptance email pointed to `/spokesperson/mission/db-N`, which does
not exist — users got a 404. Corrected. Preserve during email refactoring.

---

## 24. Offer Polling Optimization — `P1-01` substantially addressed

Originally every editor polled ~every 15 seconds, and each poll could trigger an
active-editor write, stale offer expiration, mission dispatch, and expensive
correlated scans — roughly `~1,400 database queries/sec` at 5,000 users, and
`~20,000` rows read per poll.

Current figure is approximately **`~10` rows per editor poll**.

**Do not reuse the original naive load/cost model.**

---

## 25. Cost Model Correction

The original Scenario A estimate of `~870 billion D1 rows/month` is **stale** —
it derived from the previous polling/sweep implementation.

**Re-derive the cost model from the current implementation before quoting any D1
cost estimate.** Do not repeat the old figure as current.

---

## 26. Additional Completed Work

Reported complete: `P1-01`, `P1-02`, `P1-05`, `P1-06`, `P1-09`, `P1-12`,
`P2-08`, `P2-12`.

Inspect the migration board before doing work under one of those identifiers.

---

## 27. Current Test Baseline

The suite grew from `7` pure-function assertions to `70` tests, of which about
`39` run without a database.

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Always rerun relevant tests after structural changes.

---

## 28. PostgreSQL Test Environment

A disposable PostgreSQL container is used for real concurrency testing. It is
currently stopped. The recreation command is documented in the README, the
migration board and `docs/AI_HANDOFF.md`. Read those instead of inventing a new
environment.

---

## 29. Current Highest-Priority Implementation Task

**Extract `packages/db` and establish repository boundaries for the mission and
offer domains.**

Do not start by rewriting the D1 schema. Do not immediately move every database
module. Create the database/domain boundary first.

---

## 30. Recommended `packages/db` Extraction Order

Start with the low-risk modules deliberately written to move with minimal
changes: the scheduler DB module, session revocation DB module, email queue DB
module, and email dispatch module.

**Inspect exact current file names before moving them. Do not invent paths.**

After the low-risk modules are stable, establish repository interfaces for
missions and mission offers / queue, keeping the existing PostgreSQL
implementation behind those interfaces first.

---

## 31. Target Repository Boundary

```text
apps/web  ->  apps/api  ->  packages/domain  ->  packages/db  ->  PostgreSQL
```

Then:

```text
packages/db  ->  PostgreSQL implementation
             ->  D1 implementation
```

Once D1 reaches behavioral parity, `packages/db -> D1`.

**Do not let D1 access leak directly throughout `apps/web` or `apps/api`.**

---

## 32. Mission Repository Requirements

The boundary must preserve current invariants. Illustrative only:

```ts
interface MissionRepository {
  getById(id: number): Promise<Mission | null>;
  reserve(...): Promise<...>;
  abandon(...): Promise<...>;
  submit(...): Promise<...>;
  approve(...): Promise<...>;
}
```

**Do not copy this blindly.** Derive the interface from actual domain behavior.
Avoid a giant generic repository. Keep meaningful domain semantics.

---

## 33. Offer Repository Requirements

Must preserve offer uniqueness, valid mission ownership, atomic dispatch, atomic
rejection, expiry behavior, no stranded `oferecida` state, and the one-active-
mission constraint. Use the existing concurrency regression suite during
extraction.

---

## 34. Hono Migration Strategy

The Worker already exists. **Do not turn the entire API over to Hono in one
commit.** Move domains incrementally:

```text
HTTP -> validation -> authentication -> authorization -> domain service -> repository
```

Do not put raw SQL in Hono handlers. Do not duplicate business logic between
Next route handlers and Hono. Adapters are acceptable during migration.

---

## 35. Next.js Responsibilities

Pages, layouts, React Server Components, SSR, MPA behavior, metadata, forms, UI,
navigation, presentation logic.

**Do not convert Oficina Amarela to a SPA.** Next.js should progressively stop
depending directly on database modules.

---

## 36. Service Bindings

`apps/web` should reach `apps/api` over a Cloudflare Service Binding rather than
unnecessary public HTTP round trips. Do not implement blindly before real
deployment capability exists — keep the boundary ready.

---

## 37. D1 Migration Direction

D1 remains the intended relational target. Do not begin production migration
until `P0-06` is resolved and repository abstractions exist, PostgreSQL
invariants are documented, concurrency semantics are understood,
PostgreSQL-specific functions are identified, and migration validation tooling
exists.

---

## 38. PostgreSQL Compatibility Risks

The audit found approximately **23 categories** of PostgreSQL → D1
incompatibility: PL/pgSQL, PostgreSQL schemas, stored functions, `FOR UPDATE`,
casts, PostgreSQL-specific functions, transactions, indexes, constraint
behavior, timestamps, query syntax.

**Do not assume D1 supports PostgreSQL behavior.**

---

## 39. PL/pgSQL / `FOR UPDATE` Blocker

Two important PL/pgSQL functions live under `oficina_private` and use
`FOR UPDATE`. They affect mission approval and scoring.

They must be explicitly reimplemented. **Do not attempt a mechanical SQL
conversion.** The destination may involve domain services, D1 transactions,
Durable Objects, or carefully designed atomic statements. This requires
deliberate architecture review — prefer Claude Opus 5 or GPT-5.6 Sol with
independent review.

---

## 40. Durable Objects

Use only where coordination or realtime behavior warrants it. Likely partitions:

```text
mission:{missionId}
chat:{missionId}
presence:{partition}
```

Uses: mission claim coordination, mission locks, chat, presence, typing
indicators, high-contention state.

**Do not create a single global Durable Object.** D1 remains the durable
relational source of truth unless explicitly designed otherwise.

---

## 41. Queues

Should eventually handle email, notifications, ranking recalculation, audit
processing, telemetry, webhooks, cleanup, media processing.

**Consumers must be idempotent.** The serverless `void` bug proves why.

---

## 42. Workflows

Only when the process requires durable multi-step orchestration: long approval
chains, human wait states, delayed retries, multi-step media processing. **Do not
use a Workflow when a Queue is enough.**

---

## 43. R2

Already close to the intended model — `browser -> presigned upload -> R2`.
Preserve it. R2 stays canonical object storage for source video, edited
deliveries, attachments, exports, images and documents. Remove Vercel Blob only
after verifying remaining usage.

---

## 44. Stream and Images

Evaluate Cloudflare Stream for adaptive playback, preview and reviewer playback;
Cloudflare Images for avatars, candidate photos, thumbnails and transformations.
**Do not add either simply because it exists.**

---

## 45. Email Architecture

Current provider `Resend`; target experiment `Cloudflare Email Service`.

```ts
interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}
```

`CloudflareEmailProvider` should be tested as primary because cost matters.
`ResendEmailProvider` should remain initially for its UI, debugging and developer
experience. **Do not send the same email through both providers.** Use
idempotency. Long-term dispatch uses Queues.

---

## 46. Email DNS Blocker — `P2-07`

`oficinaamarela.com.br` publishes `v=spf1 -all` and a null MX, preventing normal
email configuration. Requires human/DNS action. Do not stop unrelated work.

---

## 47. Sentry

Installed; Phase 0 reported no production DSN configured. Keep Sentry initially.
Also add Workers Logs, structured logging, request IDs, Analytics Engine and
Cloudflare metrics. Review Sentry's final role after Cloudflare observability
works.

---

## 48. Authentication

JWT · HS256 · secure cookie · Google OAuth · bcryptjs · session revocation ·
legacy claim compatibility.

Do not rotate auth secrets casually. Do not remove legacy claim compatibility
without an explicit transition. **Do not reintroduce hosting-provider-based
development auth gates.**

---

## 49. Cache and Polling

The polling design has already improved dramatically. **Do not undo this.**

Continue classifying public cacheable data, reusable authenticated data,
user-specific data, strongly consistent state and realtime state.

```text
5,000 users  ≠  5,000 identical database queries
```

---

## 50. Rate Limiting

The in-memory and broken-limiter problems have been addressed. Long-term
Workers-compatible protection should use suitable Cloudflare primitives.
**Do not regress to process-local in-memory state that disappears between Worker
isolates.**

---

## 51. Load Test Requirement

Must eventually prove **5,000 simultaneous users** under realistic behavior:
public traffic; editor traffic; mission claim bursts (concurrent claims and
same-editor contention); realtime (chat, presence, mission state); write bursts;
media (upload, playback, preview, download).

---

## 52. Metrics

```text
p50 · p95 · p99 · error rate
Worker CPU · Worker request volume
D1 rows read · rows written · query latency
Durable Object throughput · distribution
Queue depth · Queue latency
cache hit ratio
R2 operations
realtime connections
email failures
```

Define explicit pass/fail thresholds.

---

## 53. Cost Model

Cost is a first-class engineering requirement. Model 500 / 1,000 / 2,500 / 5,000
simultaneous users across Workers, D1, Durable Objects, Queues, Workflows, KV,
R2, Stream, Images, Email Service, Resend and Sentry.

**The old naive D1 model is stale. Recalculate from current code.**

---

## 54. Scaling Principle

Before adding infrastructure complexity, prefer:

```text
cache · index · batch · queue · partition · shard
reduce queries · remove synchronous work
```

Do not create unnecessary distributed architecture.

---

## 55. Migration Principle

```text
AUDIT -> BASELINE -> IMPLEMENT -> TEST -> COMPARE -> REVIEW
      -> APPROVE -> CUTOVER -> OBSERVE -> REMOVE LEGACY
```

Never `REMOVE OLD -> HOPE NEW WORKS`.

---

## 56. Required Documentation

```text
docs/CLOUDFLARE_MASTER_PROMPT.md   (this file)
docs/CLOUDFLARE_MIGRATION_BOARD.md
docs/CLOUDFLARE_ARCHITECTURE.md
docs/CLOUDFLARE_COST_MODEL.md
docs/CLOUDFLARE_LOAD_TEST_PLAN.md
docs/CLOUDFLARE_CUTOVER_PLAN.md
docs/AI_HANDOFF.md
```

Do not rewrite these after every minor commit. Update when implementation state
materially changes.

---

## 57. Jira Context

`ONCA-116` initial Cloudflare architecture audit · `ONCA-117` main Cloudflare-
first migration and 5,000-user architecture initiative · `ONCA-58` launch
readiness, capacity and observability.

Do not duplicate ONCA-58. ONCA-117 owns the architecture migration; ONCA-58 owns
operational readiness. Share results across both.

---

## 58. Aggressive Implementation Mode

Phase 0 is over. Do not operate primarily as a planner. Operate as an
implementation agent.

```text
implement -> test -> commit -> next READY task -> implement -> test -> commit -> continue
```

Do not stop after one small successful task if useful READY work remains.
**A clean commit is a checkpoint, not the end of the session.**

---

## 59. Do Not Preserve Model Quota Unnecessarily

A state like `5h quota: 22% used · weekly: 2% · context: 23%` is not close to
depletion. Continue working. Do not create a handoff at low or moderate context
usage simply because a checkpoint exists.

---

## 60. Depletion Guidance

```text
<60% context   continue normally
60–75%         continue, monitor remaining scope
75–85%         finish the current chain, avoid starting huge unrelated work
>85%           prepare a safe checkpoint/handoff
```

Not hard thresholds. The criterion is whether continuing remains reliable.

---

## 61. Stop Conditions

Stop only when: all meaningful READY work is exhausted; remaining tasks require
human action; production-destructive work needs approval; a genuine architecture
blocker cannot be resolved from available evidence; tooling prevents progress;
depletion is genuinely near; or continuing would create significant correctness
risk.

**Do not stop because one commit succeeded. Do not stop merely because
documentation is current.**

---

## 62. Human Blockers Must Not Freeze the Session

Cloudflare credentials · DNS · MX/SPF · production database confirmation ·
production logs.

Record as BLOCKED and move to independent READY work:

```text
BLOCKED     P0-06 production DB provider confirmation
CONTINUING  packages/db extraction
```

Only stop if every meaningful next task is blocked.

---

## 63. Preferred AI Models

```text
1. Claude Opus 5
2. GPT-5.6 Sol
3. Gemini 3.7 Flash
```

**GPT-5.6 Sol** — currently preferred for repository/package extraction:
cross-file implementation, repository boundaries, regression reasoning, tests,
debugging, architecture review.

**Claude Opus 5** — D1 schema design, PL/pgSQL replacement, Durable Object
concurrency architecture, security-critical design, production cutover design.

**Gemini 3.7 Flash** — mechanical moves, repetitive migrations, cleanup,
documentation, straightforward tests.

---

## 64. Cross-Model Review

Important milestones should receive another strong model's review when
practical: repository architecture, PostgreSQL → D1 design, mission concurrency,
Durable Objects, auth, security, cutover, final load testing.

**Do not rewrite working code merely because another model prefers a different
style.**

---

## 65. AI Handoff Policy

If genuine depletion approaches:

```text
checkpoint -> test -> commit -> update board -> update AI_HANDOFF.md -> switch model
```

Before handoff: finish the smallest safe atomic change; do not begin another
large task; run relevant tests; inspect Git status; commit only validated work;
update migration state; provide executable next actions.

---

## 66. `AI_HANDOFF.md` Requirements

Must include: Session (date, current model, recommended next model, repository,
branch, HEAD, working tree) · Current Objective · Current Architecture · Target
Architecture · Completed This Session · Current Task · Task State (`COMPLETE`,
`SAFE CHECKPOINT`, `PARTIALLY IMPLEMENTED`, `BLOCKED`, `WAITING FOR REVIEW`) ·
Files Changed · Decisions Made · Unresolved Decisions · Tests (run, passed,
failed, remaining) · Known Issues · Database State (source, target, schema,
migration, validation, rollback) · Cloudflare State (`NOT STARTED`, `LOCAL`,
`STAGING`, `VALIDATED`, `PRODUCTION READY` for Workers, D1, R2, Durable Objects,
Queues, Workflows, KV, Stream, Images, Email Service, Analytics Engine, Workers
Logs, Turnstile, WAF) · External Providers (Vercel, Neon/Supabase, Resend,
Sentry, Google OAuth) · Git State · Next (`NEXT 1` must be immediately
executable) · Do Not Redo · Warnings (data loss, downtime, auth, duplicate
emails, race conditions, security regressions, infrastructure duplication).

---

## 67. Next Model Startup

1. confirm `infra/cloudflare-scale`;
2. read this master prompt;
3. read `docs/AI_HANDOFF.md`;
4. read `docs/CLOUDFLARE_MIGRATION_BOARD.md`;
5. run `git status`;
6. inspect recent commits;
7. verify referenced files;
8. run the minimum relevant tests;
9. continue from `NEXT 1`.

**Do not restart Phase 0. Do not rediscover solved defects. Do not rebuild
already-completed workspace/API infrastructure.**

---

## 68. Immediate Execution Order

**NEXT 1** — Extract `packages/db`, starting with low-risk modules already
prepared for movement. Run tests after each meaningful extraction. Commit
validated changes. Do not stop.

**NEXT 2** — Introduce repository interfaces for mission and offer domains,
keeping the PostgreSQL implementation active. Preserve all five queue
invariants. Use the concurrency regression tests. Commit. Continue.

**NEXT 3** — Reduce direct database coupling from `apps/web`, progressively
routing domain behavior through shared/domain/API boundaries. Do not migrate
every Server Component in one giant commit unless tooling proves it safe.

**NEXT 4** — Continue Hono domain extraction, one domain at a time.

**NEXT 5** — Prepare a D1-compatible repository implementation structure. Do not
migrate production data.

**NEXT 6** — Once Cloudflare credentials exist, perform a real staging Workers
deployment and settle `vinext vs OpenNext` on runtime evidence.

---

## 69. D1 Migration Gate

Do not begin production D1 migration until `P0-06` is confirmed, repository
boundaries exist, PostgreSQL invariants are mapped, critical SQL
incompatibilities are documented, migration validation tooling exists and a
rollback strategy exists.

Local D1 experimentation may proceed earlier when useful.

---

## 70. Production Operations

Do not perform destructive operations without:

```text
replacement validated
backup confirmed
rollback documented
tests passing
cutover plan ready
explicit approval
```

Applies to deleting Neon/Supabase, removing Vercel production, changing
production DNS, removing Resend, changing production auth secrets, and migrating
production data.

---

## 71. Definition of Done

**Architecture** — Turborepo/workspace stable; `apps/web` is the web boundary;
`apps/api` is the backend boundary; repository/domain packages established.

**Cloudflare** — production on Workers; D1 primary relational storage or a
documented approved exception; R2 canonical object storage; Durable Objects
handle required concurrency; Queues handle async work; cache strategy
implemented; security controls active.

**Legacy** — old hosting/database dependencies removed where approved; no
unnecessary Vercel Blob dependency.

**Email** — Cloudflare Email Service tested; Resend has an explicit final
decision.

**Reliability** — invariants still enforced; concurrency tests pass; auth secure;
migration validation passes; rollback documented.

**Scale** — realistic 5,000-user tests pass; mission claiming correct;
latency/error thresholds pass.

**Cost** — cost model based on the optimized implementation; measured cost
understood.

**Git** — no automatic merge into `master`; final integration requires explicit
review.

---

## 72. Final Operating Principle

> **Plan only enough to implement safely. Implement aggressively. Test
> continuously. Commit frequently. Preserve existing invariants. Keep moving
> through READY work while meaningful model capacity remains.**

Do not stop early simply because a clean checkpoint exists.
