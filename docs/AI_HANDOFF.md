# AI Handoff — Oficina Amarela · Cloudflare Scale Migration

## Session

```
date:                   2026-08-30
current model:          GPT-5.6 Sol
repository:             github.com/lunatecfra-cyber/oficina-amarela
branch:                 infra/cloudflare-scale  (38 commits ahead of master after this handoff)
base commit audited:    a37d94e  chore: migra linter e formatador de ESLint para Biome
last implementation:    58a9916  feat(api): adiciona consumidores de manutenção agendada
working tree:           clean after the handoff commit
```

---

## Read first

`docs/CLOUDFLARE_MASTER_PROMPT.md` is the canonical brief for this initiative —
mission, language rules, completed work, execution policy, model routing and the
`NEXT 1..6` order. Read it before this file.

---

## Objective

Migrate Oficina Amarela to `Turborepo + Next.js + Hono + Cloudflare` so it safely
supports **5,000 simultaneous users** at low, predictable cost — without rewriting
working product behaviour.

Done so far: **Phase 0** (audit and baseline), **Phase 1** (Turborepo workspace),
**Phase 2** (application moved to `apps/web`), **Phase 4** (Hono Worker),
**Phase 5** (shared packages), the editor queue and six mission lifecycle actions
in Hono. Local work now includes Hyperdrive wiring, the complete mission queue
repository on D1, a Durable Object claim coordinator and scheduled consumers.
Nothing has been deployed and no provider has been removed.

---

## Current architecture

Turborepo workspace with two applications:

- **`apps/web`** (`@oficina/web`) — Next.js 16.3.3 / React 19.2.8, App Router.
  The editor queue route is a thin Hono adapter; the mission route delegates six
  migrated actions and keeps approval, chat and report on Next/PostgreSQL.
- **`apps/api`** (`@oficina/api`) — Hono on Cloudflare Workers. It serves
  `/editor/queue/next` and mission reserve/cancel/deliver/re-edit/accept/adjust,
  with shared session/role checks, PT-BR HTTP errors and injected repositories.
  Its Worker config includes a local `mission:{id}` Durable Object prototype.
- **`packages/db`** (`@oficina/db`) — PostgreSQL client with Hyperdrive binding
  configuration, atomic queue/lifecycle repositories, scheduler, email outbox,
  session revocation, and D1 queue/lifecycle adapters with native parity tests.
- **`packages/domain`** (`@oficina/domain`) — thirteen framework-free modules
  (electoral ranking, mission transitions, limits, validators, mission types,
  guide, tutorials, cities, news, candidates, schedule, profile, navigation)
  plus `roles.ts`.
- **`packages/auth`, `packages/config`, `packages/email`** — shared JWT/session,
  fail-closed dev gates, and provider/outbox dispatch boundaries.

Workspace packages publish TypeScript source with **no build step**, consumed by
subpath export and `transpilePackages`. `scripts/`, `supabase/` and `docs/` are
at the root. TypeScript strict, Tailwind 4, Biome 2.5.11 from the root.
Sessions are `jose` HS256 JWTs in the `confraria_sessao` cookie. Data access is
raw SQL through the `postgres` driver, inline in `apps/web/lib/*-db.ts` and
called directly from Server Components. Object storage is Cloudflare R2 via
presigned S3 URLs. Email is Resend, now behind a persisted outbox for broadcast.
Hosting is still Vercel Hobby.

Full detail: `docs/CLOUDFLARE_ARCHITECTURE.md` §1.

---

## Target architecture

`apps/web` (Next.js on Workers, presentation only) and `apps/api` (Hono on
Workers, the API boundary) connected by a **Service Binding**, over
`packages/{domain,db,auth,contracts,config,shared}`. D1 for relational business
state, Durable Objects for mission claim / chat / presence, Queues for email and
recalculation, R2 as canonical object storage, KV for flags and config, Analytics
Engine for telemetry, WAF + rate limiting + Turnstile for security.

Full detail: `docs/CLOUDFLARE_ARCHITECTURE.md` §2.

---

## Completed work

### Phase 0 — audit and baseline (`e73ced7`)

Full repository audit; all 33 route handlers inventoried; the 18 Server
Components with direct SQL identified; 23 categories of PostgreSQL→D1
incompatibility catalogued; storage paths and the single `@vercel/blob` call
site located; authentication and its dev bypasses mapped; Next.js/Workers
compatibility verified with `npx vinext check`; the six required documents
written.

### Correctness and security fixes

| Commit | What |
|---|---|
| `605c88c` | `"type": "module"` — the only blocker `vinext check` reported. 92% → **97%**, 0 issues. |
| `210f681` | Database invariants: `idx_pautas_missao_ativa_por_editor` (one active mission per editor) and `idx_ofertas_missao_editor`. `isUniqueViolation(error, constraint)` added to `lib/db.ts` — the single translation point when the target becomes D1. |
| `51597e5` | `reserveMission()` — the check/act race is closed by the index; the pre-check stays only for the message. |
| `5bf9c48` | `acceptOffer()` reserves first, gated on a live offer, so `ok: true` means the editor holds the mission. `rejectOffer()` and `dispatchMissions()` became single statements. |
| `c09d352` | Ten PostgreSQL-backed concurrency tests, plus `scripts/test-alias-hooks.mjs` so `node:test` can resolve the `@/` alias at all. |
| `52bcc2a` | Missing `DATABASE_URL` throws instead of silently answering `[]`. The stub survives only during `next build` or with `DATABASE_STUB=1` outside production. |
| `9682f05` | `lib/dev-mode.ts`: `ALLOW_DEV_AUTH_BYPASS` and `ALLOW_DEMO_CONTENT`, both requiring `NODE_ENV !== "production"` **and** an exact `"1"`. Every `!process.env.VERCEL` check is gone. |
| `274142d` | **The attempt limiter never locked anything** — `RETURNING tentativas` compared against `row.attempts`. Login brute force, recovery spam and per-IP signup flooding were all unthrottled in production. Fixed, and the presign limit moved off its per-isolate `Map` onto the same table. |
| `c257098` | `idx_ofertas_pendente_por_missao` and `idx_ofertas_pendente_por_editor` — invariants `scripts/testar-trava.mjs` claimed existed but never did. `/dev` now `notFound()`s outside development. Six dead scripts removed, two ported to real tests. |

### Performance and scale

| Commit | What |
|---|---|
| `9de7246` | The global sweep left the per-poll path. `lib/scheduler-db.ts` claims it through a conditional upsert on `tarefas_periodicas`, so at most one request per 5s window runs `expireStaleOffers()` + `dispatchMissions()`. Presence writes coarsened to 60s. `POST /api/missions` dispatches on the spot. **Rows read per poll: ~20,000 → ~10.** |
| `11d14be` | `lib/session-revocation.ts` caches the revocation cutoff for 30s per process, invalidated on password change, ban and account deletion. Removes a database read from every authenticated request. |
| `7a9963f` | Broadcast email moved to a persisted outbox (`fila_emails`) with an idempotency key, 5-minute backoff and a 5-attempt ceiling. The old loop fired `void notify…()` per recipient, which dies with the response in a serverless runtime — most of that mail was never sent while the route reported success. |

### Structure

| Commit | What |
|---|---|
| `ad2b60f` | Turborepo workspace. Application moved to `apps/web`; `scripts/`, `supabase/`, `docs/` stay at the root. Behaviour preserved. |
| `e82ccf4` | `apps/api` — minimal Hono Worker with `/health`, request id (reusing `cf-ray`), structured JSON logs and PT-BR error shape. Compiles under `wrangler deploy --dry-run` (62.9 KiB). |
| `1f076a9` | All four mission notifications moved onto the outbox. Found on the way: the acceptance email linked to `/spokesperson/mission/db-N`, a route that does not exist, and `recordGamificationEvent` was `void`-fired on delivery, so XP could vanish in a serverless runtime. |
| `2f16d47` | `supabase/README.md` — `schema.sql` is the operative idempotent artifact; `migrations/*.sql` record `ALTER TABLE`-style changes and are run by hand. Nothing applied those files, and this branch added three. |
| `896bb64` | `docs/CLOUDFLARE_MASTER_PROMPT.md` — the canonical brief, versioned so the startup protocol's "read this master prompt" is satisfiable. |
| `dd24439` | `packages/db` — client, scheduler, email outbox, session revocation. `apps/web/lib/db.ts` stays as a two-line re-export on purpose (see `P3-05`). |
| `558eb64` | `packages/domain` — thirteen pure modules plus `roles.ts`, which took `Role` out of `lib/session.ts`. Subpath-only exports: `cities.ts` is 111 KB and a barrel would risk dragging it into bundles that do not need it. |
| `913b299` + `f1185fd` | Extracted `packages/auth`, `packages/config` and `packages/email` without changing the public contracts. |
| `f8b6ac6` + `36014d7` | Extracted the atomic `MissionQueueRepository`, moved the editor queue to Hono and reduced the Next route to an adapter. |
| `c19df92` | Moved six mission lifecycle actions to Hono with typed repository failures, shared auth and PostgreSQL-backed route/concurrency tests. |
| `48d9b95` | Made PostgreSQL initialization accept a Hyperdrive connection string; no credential or production URL is committed. |
| `cca8e89` | Added the first local D1 schema/lifecycle adapter and native parity tests, including all five uniqueness invariants. |
| `840e6a5` | Added the narrow `mission:{missionId}` Durable Object claim coordinator with stale/duplicate/conflict coverage. |
| `9104ba4` | Completed the native D1 mission queue adapter, preserving atomic dispatch/accept/reject/expiry and all five uniqueness invariants. |
| `58a9916` | Added typed scheduled/queue maintenance consumers; the Worker cron now drains mission sweeps and email independently. |

---

## Current task

Phase 6 is in progress. Mission lifecycle transitions and the editor queue run
in Hono behind injected repositories; their PostgreSQL and native D1 adapters
now share typed outcomes. The next coherent slice is chat/report collaboration;
production approval remains deliberately untouched.

## Task state

```
SESSION CHECKPOINT COMPLETE
```

Every commit on the branch is validated and self-contained. There is no
half-finished edit in the working tree.

---

## Files changed

Too many to list individually — see `git log master..HEAD`. The shape:

- **Hono routes**: editor queue and mission lifecycle under `apps/api/src/routes`
- **repository boundaries**: `packages/db/src/mission-queue.ts` and
  `mission-lifecycle.ts`, injected through `apps/api/src/dependencies.ts`
- **temporary database path**: `HYPERDRIVE.connectionString` configures the
  existing PostgreSQL client without committing a connection string
- **local D1**: `packages/db/d1/0001_mission_slice.sql` and complete mission
  queue/lifecycle adapters with native Miniflare coverage
- **local Durable Object**: `MissionCoordinator`, keyed as `mission:{missionId}`
- **background work**: typed cron/queue consumers in `apps/api/src/background.ts`;
  no remote Queue binding was created
- **schema**: PostgreSQL invariants remain in `supabase/schema.sql`; no production
  migration was run

## Architecture decisions

Decided:

- Two deployables only — `apps/web` and `apps/api`. No microservices.
- Oficina Amarela stays MPA/SSR. It does not become an SPA because the backend moved.
- Internal web→api calls use a Cloudflare Service Binding, not a public hop.
- Repository interfaces in `packages/db` with parallel Postgres and D1 implementations during migration; Postgres implementations are removed only after D1 behaviour is verified.
- Durable Objects are partitioned (`mission:{id}`, `chat:{id}`, `presence:{partition}`) — never one global object.
- Durable Objects coordinate; database invariants remain as defence in depth. Frontend state is never authoritative.
- Email goes through an `EmailProvider` interface with Cloudflare Email Service as intended primary and Resend retained as secondary. Queue-dispatched with an idempotency key. Never both providers for one message.
- Sentry stays through the early phases; the retain/remove decision is Phase 18, on evidence.
- Internal code is English; all user-facing copy stays PT-BR; commits are PT-BR Conventional Commits.
- Self-registration can never produce an approved candidate. The invitation gate survives the migration.

## Unresolved decisions

| ID | Question | Resolve in |
|---|---|---|
| `ARCH-01` | vinext (Cloudflare's recommended default, beta) vs OpenNext (documented path for existing apps) | Phase 3, on prototype evidence |
| `ARCH-02` | Is the live database Neon or Supabase? `docs/INFRA.md` says Neon; the directory says `supabase/`; no Supabase SDK is installed | before production data migration — needs production access |
| `ARCH-03` | Keep PT-BR table/column names in D1, or rename to English with a mapping layer | Phase 9 — cheapest at the D1 cut |
| `ARCH-04` | Split the 45-column `users` table into `users` + `editor_profiles` + `candidate_profiles`? | Phase 9 |
| `ARCH-05` | Does offer polling stay HTTP or become a Durable Object push? | Phase 12 |
| `ARCH-06` | Cloudflare Stream adoption scope | Phase 16 |

---

## Tests

```
tests run:      npm test · npm run typecheck · biome check . · npm run build
tests passed:   120 with TEST_DATABASE_URL
tests failed:   0
```

Exact commands, from the repository root:

```bash
TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" npm test
npm run typecheck                     # all seven packages, clean
./node_modules/.bin/biome check .     # clean; use the binary directly
npm run build                         # Next production build + Worker dry-run
```

Database-backed suites need a throwaway PostgreSQL and are **skipped** without
`TEST_DATABASE_URL`:

```bash
docker run -d --rm --name oficina-pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=oficina -p 5439:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" node scripts/migrar.mjs
TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" npm test   # 120 passed
```

Two things about this setup are worth knowing before adding tests:

- **The pool must be warmed.** `beforeEach` in `mission-concurrency.test.ts`
  fires four throwaway queries first. Without open connections the `postgres`
  driver serialises the calls and the race never happens — the concurrency
  tests would pass without proving anything. Verified both ways: with the index
  dropped and a warm pool, three simultaneous claims give one editor three
  missions; with the index, one.
- **Database files run serially** (`--test-concurrency=1`). The concurrency
  suite does `TRUNCATE … CASCADE`, which wiped other files' data mid-run.

> **Do not trust `npm run lint`.** The local RTK shell hook parses Biome output
> as ESLint and reports phantom errors. Run the binary directly.

Coverage now includes mission claim/offer concurrency, mission lifecycle role
authorization and transitions, PT-BR API failures, gamification on delivery,
Hyperdrive-compatible configuration, native D1 queue/lifecycle parity, the
Durable Object claim coordinator and scheduled maintenance consumers. Approval,
invitation redemption and candidate approval still need concurrency coverage.

## Known issues

The three concurrency defects found in Phase 0 are **fixed** (`P0-01`, `P0-02`,
`P0-03`), as are `P0-04`, `P0-05`, `P1-01`, `P1-02`, `P1-05`, `P1-06`, `P1-09`.

Open:

- **`P0-06`** — whether production runs on Neon or Supabase is still
  unconfirmed. `docs/INFRA.md` says Neon; the directory says `supabase/`; no
  Supabase SDK is installed. Blocks production data migration, not local D1
  engineering. Needs human access.
- **`P0-09` follow-up** — the attempt limiter was dead in production, so login
  brute force, recovery spam and per-IP signup flooding went unthrottled for as
  long as that code has been live. The code is fixed; **nobody has reviewed the
  production logs for abuse that got through**. Needs human access.
- **`P2-11` staging remainder** — the Worker cron and typed consumer exist
  locally. The request fallback stays until the Worker is deployed; a real Queue
  binding still needs Cloudflare credentials.
- **`P2-12`** — documented rather than fixed: `schema.sql` is the operative
  idempotent artifact and `migrations/*.sql` are run by hand. See
  `supabase/README.md`. Revisit when Phase 9 needs D1 tooling.
- **`P2-07`** — `oficinaamarela.com.br` still publishes `v=spf1 -all` and a null
  MX. No provider can deliver. Blocks Phase 17. Needs human action.
- **`P1-11`** — `@sentry/nextjs` server integration on Workers needs manual
  setup (`vinext check` reports it as partial).
- **`P2-05`** — the Sentry DSN is still unset in production; it records nothing.

Deliberate, documented trade-offs (not bugs):

- The session-revocation cache is per process, so revocation reaches instances
  that did not perform the write within 30s.
- Presence timestamps are written at 60s granularity, which slightly coarsens
  the least-recently-seen ordering in `getNextEditor()`.
- `deliverEmail()` returns success when no provider is configured, so messages
  leave the outbox instead of retrying forever against missing configuration.

## Database state

```
source database:    PostgreSQL — Neon (per docs/INFRA.md, verified 2026-08-13)
                    ⚠ contradicted by the supabase/ directory name; ARCH-02 / P0-06 open
target database:    Cloudflare D1
schema status:      supabase/schema.sql — 21 tables, PT-BR names, 7 migrations
                    added 2026-08-30: tarefas_periodicas, fila_emails, and five
                    unique indexes carrying business invariants
migration status:   LOCAL ONLY — packages/db/d1/0001_mission_slice.sql covers
                    the relevant users/pautas/ofertas/fila_emails slice
validation status:  LOCAL ONLY — queue/lifecycle adapter parity and all five D1
                    uniqueness invariants run against native Miniflare D1
rollback status:    documented in CLOUDFLARE_CUTOVER_PLAN.md §8, not rehearsed
```

The five invariant indexes added this session must survive the D1 translation —
they are the only thing standing between the queue and the races described in
`P0-01`..`P0-03`:

```
idx_pautas_missao_ativa_por_editor   uma missão ativa por editor
idx_ofertas_missao_editor            uma oferta por (missão, editor)
idx_ofertas_pendente_por_missao      uma oferta viva por missão
idx_ofertas_pendente_por_editor      uma oferta viva por editor
(plus fila_emails.chave UNIQUE — idempotência de e-mail)
```

**Applying them to an existing database is not idempotent against dirty data.**
Use `scripts/migrar-invariantes-concorrencia.mjs`, which reports conflicting
rows and refuses rather than deleting anything.

## Cloudflare state

| Service | State |
|---|---|
| Workers | **LOCAL** — dry-run succeeds at 396 KiB / 95 KiB gzip; never deployed |
| Hyperdrive | **LOCAL CONFIG ONLY** — binding contract and PostgreSQL test pass; staging resource needs credentials |
| D1 | **LOCAL PROTOTYPE** — mission schema and queue/lifecycle adapters tested; no database created remotely |
| R2 | **PRODUCTION** — already the object store for video uploads (`apps/web/lib/r2.ts`, presigned PUT, browser→R2 direct) |
| Durable Objects | **LOCAL PROTOTYPE** — `mission:{missionId}` coordinates claims; Worker binding/migration dry-run clean |
| Queues | **LOCAL CONTRACT** — typed consumer tested; no remote Queue or binding created |
| Workflows | NOT STARTED |
| KV | NOT STARTED |
| Stream | NOT STARTED |
| Images | NOT STARTED |
| Email Service | NOT STARTED |
| Analytics Engine | NOT STARTED |
| Workers Logs | **LOCAL** — `observability` enabled in `wrangler.jsonc`; structured JSON logs already emitted by the Hono middleware |
| Turnstile | NOT STARTED |
| WAF | NOT STARTED |

No Cloudflare credentials have been used and nothing has been deployed.

## External providers

| Provider | State |
|---|---|
| Vercel | **PRODUCTION** — Hobby plan, `oficina-amarela-woad.vercel.app`. Hobby forbids commercial use. |
| Neon (or Supabase — `ARCH-02`) | **PRODUCTION** — Postgres 18, `us-east-2`, via the transaction pooler (hence `prepare: false`) |
| Vercel Blob | **PRODUCTION, one call site** — `app/api/tools/music/route.ts:1` only |
| Resend | **PRODUCTION, degraded** — free tier, sandbox sender `onboarding@resend.dev`, domain unverified, so it only delivers to the account owner |
| Sentry | **INSTALLED, INACTIVE** — no DSN configured in production |
| Google OAuth | **PRODUCTION** — openid/email/profile, callback `/api/auth/google/callback` |
| registro.br | domain registered, DNS incomplete (8 records missing) |
| GitHub | active |

No previously unknown infrastructure service was discovered during the audit.

---

## Git state

```
branch:               infra/cloudflare-scale
last implementation:  58a9916  feat(api): adiciona consumidores de manutenção agendada
base:                 a37d94e (master, in sync with origin/master at audit time)
commits ahead:        38 after this handoff commit
uncommitted files:    none
untracked files:      none (.omc/ is gitignored)
remote:               origin/infra/cloudflare-scale, pushed after validation
```

One thing to know about this history: `e82ccf4` was amended to drop
`apps/api/node_modules`, which a `git add -A` staged because `.gitignore` had
`/node_modules` (root only). The pattern is now `node_modules/`. Nothing was
pushed, so no rewrite reached anyone.

## Next actions

### NEXT 1 — immediately executable

**Keep shrinking `apps/web/app/api/missions/[id]/route.ts`.** Move chat/report as
the next coherent collaboration slice. Approval stays on
`oficina_private.aprovar_edicao` until its concurrency design is reviewed.

### NEXT 2

**Extend D1 only with the newly migrated slice.** Reuse the existing atomic
repository shape and native Miniflare checks; do not add table-oriented CRUD.

### NEXT 3

**Deploy the already-tested cron/consumer wiring in staging when credentials
exist.** Until then keep the request fallback. The same credential boundary
applies to Hyperdrive and the vinext/OpenNext staging comparison.

## Do not redo

- The Phase 0 audit. Recorded in `CLOUDFLARE_ARCHITECTURE.md` §1 and the board.
- The `vinext check` run — 97%, 0 issues, 1 partial (`@sentry/nextjs` server).
- The PostgreSQL → D1 incompatibility catalogue: 23 categories under `P1-07`.
- The concurrency analysis and its fixes. `reserveMission`, `acceptOffer`,
  `rejectOffer` and `dispatchMissions` are fixed, tested against a real database,
  and verified in both directions (with and without the indexes).
- The rate-limiter defect. Reproduced, fixed, covered by tests.
- The Turborepo move. `apps/web` and `apps/api` build, typecheck, lint and test
  from the root through turbo.
- The unit-price table in `CLOUDFLARE_COST_MODEL.md` — verified 2026-08-30.
- The mission D1 queue/lifecycle adapters and `mission:{id}` coordinator.
  Extend them; do not replace them with table CRUD or move mission state into DO.

The cost model projects at most 10.9 G D1 rows read/month under its explicit
bounds. The queue adapter now runs locally; replace the projection only after
instrumenting real D1 `meta.rows_read` in staging.

## Warnings

**Data loss**
- Do not run any `scripts/migrar-*.mjs` against production without a verified restorable backup. They connect via `DATABASE_URL` and write directly.
- `scripts/migrar-invariantes-concorrencia.mjs` refuses to run when rows already violate the invariants, and prints the offenders. **Do not "fix" that by deleting rows** — choosing which mission an editor loses is a human decision.

**Broken authentication**
- `AUTH_SECRET` must be carried to Workers **verbatim**. Rotating it invalidates every session; tokens live 30 days.
- The JWT payload carries both English and PT-BR claims and the cookie is named `confraria_sessao`. Changing either logs out every user (`P0-07`).
- The dev bypasses now require `ALLOW_DEV_AUTH_BYPASS=1` **and** `NODE_ENV !== "production"`. Do not reintroduce a provider-specific check (`!process.env.VERCEL`) as a shortcut — that is exactly what made the old gate meaningless off Vercel.
- Local development needs `ALLOW_DEV_AUTH_BYPASS=1` in `apps/web/.env.local`. Without it, `npm run dev` requires a real login. This is intended.

**Race conditions**
- Five unique indexes now carry business invariants that used to live only in application checks. **Losing any of them in the D1 translation silently reopens a race that no test outside `mission-concurrency.test.ts` will catch.**
- `oficina_private.aprovar_edicao()` and `criar_porta_voz_com_convite()` still rely on `FOR UPDATE`. D1 has neither stored procedures nor row locks. Reimplementing them naïvely allows double-scoring an approval and double-redeeming an invitation (`P0-08`).
- Concurrency tests only prove something with a warm connection pool. A test that skips the warm-up passes whether or not the invariant exists.

**Duplicate email delivery**
- `fila_emails.chave` is the only thing preventing a repeated broadcast from mailing everyone twice. Keep the key stable when moving to Cloudflare Queues.
- Cloudflare Email Service and Resend must never both send the same message.
- Password recovery is still a direct awaited send, deliberately: the user is waiting on it. Everything else goes through the outbox.

**Security regression**
- Row Level Security is enabled on 6 tables. D1 has no RLS. All of that authorization must move explicitly into `apps/api` — losing it silently is the most likely security regression in this migration (`P1-07`).
- The attempt limiter was dead in production until `274142d`. Production logs have not been reviewed for abuse that went unthrottled (`P0-09`).
- CSP is still `Report-Only` and permits `'unsafe-inline'` and `'unsafe-eval'` (`P2-04`).

**Duplicate infrastructure / downtime**
- Do not remove Vercel, Neon/Supabase, Resend or Sentry before their replacements are validated in production. Phase 23 is a separate approval.
- Do not merge `infra/cloudflare-scale` into `master` automatically. Do not tag, release or deploy migration work to production without explicit human approval.
