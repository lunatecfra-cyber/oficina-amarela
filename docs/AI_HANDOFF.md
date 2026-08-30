# AI Handoff — Oficina Amarela · Cloudflare Scale Migration

## Session

```
date:                   2026-08-30
current model:          Claude Opus 5
recommended next model: GPT-5.6 Sol  (see "Next Actions" for why)
repository:             github.com/lunatecfra-cyber/oficina-amarela
branch:                 infra/cloudflare-scale  (16 commits ahead of master, not pushed)
base commit audited:    a37d94e  chore: migra linter e formatador de ESLint para Biome
HEAD:                   e82ccf4  feat(api): adiciona worker hono inicial
working tree:           clean (.omc/ is now gitignored)
```

---

## Objective

Migrate Oficina Amarela to `Turborepo + Next.js + Hono + Cloudflare` so it safely
supports **5,000 simultaneous users** at low, predictable cost — without rewriting
working product behaviour.

Done so far: **Phase 0** (audit and baseline), **Phase 1** (Turborepo workspace),
**Phase 2** (application moved to `apps/web`), **Phase 4** (minimal Hono Worker),
plus every P0 that could be resolved from the repository and four P1 items.
Nothing has been deployed and no provider has been removed.

---

## Current architecture

Turborepo workspace with two applications:

- **`apps/web`** (`@oficina/web`) — Next.js 16.3.3 / React 19.2.8, App Router,
  32 pages, 3 layouts, 33 route handlers, 62 components, 44 `lib/` modules.
  Still the whole product.
- **`apps/api`** (`@oficina/api`) — Hono on Cloudflare Workers. `/health` plus
  request id, structured JSON logs and PT-BR error/404 shape. **No business
  routes yet and nothing calls it.**

`scripts/`, `supabase/` and `docs/` are at the root. `packages/` does not exist
yet (Phase 5). TypeScript strict, Tailwind 4, Biome 2.5.11 from the root.
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

---

## Current task

Phase 5 has not started. The last completed unit is the Hono Worker (`e82ccf4`).

## Task state

```
COMPLETE
```

Every commit on the branch is validated and self-contained. There is no
half-finished edit in the working tree.

---

## Files changed

Too many to list individually — see `git log master..HEAD`. The shape:

- **new modules** in `apps/web/lib`: `dev-mode.ts`, `scheduler-db.ts`,
  `session-revocation.ts`, `email-queue-db.ts`, `email-dispatch.ts`
- **new tests** in `apps/web/lib`: `mission-concurrency`, `scheduler`,
  `session-revocation`, `rate-limit`, `email-queue`, `db-config`, `dev-mode`,
  `mission-transitions`, `navigation`
- **new app**: `apps/api` (5 files)
- **schema**: `supabase/schema.sql` plus three migrations dated `20260830`
- **removed**: six broken `scripts/*.mjs`

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
| `ARCH-02` | Is the live database Neon or Supabase? `docs/INFRA.md` says Neon; the directory says `supabase/`; no Supabase SDK is installed | before Phase 8 — needs production access |
| `ARCH-03` | Keep PT-BR table/column names in D1, or rename to English with a mapping layer | Phase 9 — cheapest at the D1 cut |
| `ARCH-04` | Split the 45-column `users` table into `users` + `editor_profiles` + `candidate_profiles`? | Phase 9 |
| `ARCH-05` | Does offer polling stay HTTP or become a Durable Object push? | Phase 12 |
| `ARCH-06` | Cloudflare Stream adoption scope | Phase 16 |

---

## Tests

```
tests run:      npm test · npm run typecheck · biome check . · npm run build   (all via turbo)
tests passed:   39 without a database, 70 with TEST_DATABASE_URL
tests failed:   0
```

Exact commands, from the repository root:

```bash
npm test                              # 34 web + 5 api
npm run typecheck                     # both apps, clean
./node_modules/.bin/biome check .     # 212 files, clean
npm run build                         # web: 32 pages; api: wrangler dry-run 62.9 KiB
```

Database-backed suites need a throwaway PostgreSQL and are **skipped** without
`TEST_DATABASE_URL`:

```bash
docker run -d --rm --name oficina-pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=oficina -p 5439:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" node scripts/migrar.mjs
TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" npm test   # 70 passed
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

Coverage now includes mission claim/offer concurrency, the periodicity lock,
the session-revocation cache, the attempt limiter, the email outbox, database
configuration, dev-mode gates, mission transitions and navigation.
**Still uncovered:** authorization by role, mission abandon/submit/approve/
revise, ranking mutation, gamification, invitation redemption, candidate
approval.

## Known issues

The three concurrency defects found in Phase 0 are **fixed** (`P0-01`, `P0-02`,
`P0-03`), as are `P0-04`, `P0-05`, `P1-01`, `P1-02`, `P1-05`, `P1-06`, `P1-09`.

Open:

- **`P0-06`** — whether production runs on Neon or Supabase is still
  unconfirmed. `docs/INFRA.md` says Neon; the directory says `supabase/`; no
  Supabase SDK is installed. Blocks Phase 8 onward. Needs human access.
- **`P0-09` follow-up** — the attempt limiter was dead in production, so login
  brute force, recovery spam and per-IP signup flooding went unthrottled for as
  long as that code has been live. The code is fixed; **nobody has reviewed the
  production logs for abuse that got through**. Needs human access.
- **`P1-12`** — single-recipient notifications still use `void sendNotification(…)`
  from route handlers, with the same serverless delivery loss the broadcast had.
  Move them onto `fila_emails`.
- **`P2-11`** — the outbox and sweep drains are driven by request traffic
  because there is no scheduler. A quiet site does not retry failed email.
- **`P2-12`** — `supabase/migrations/*.sql` are applied by no runner;
  `scripts/migrar.mjs` applies `schema.sql` only. The migration files are
  documentation until someone runs them. Decide on one mechanism before Phase 9.
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
migration status:   NOT STARTED — no D1 schema, no migration tooling
validation status:  NOT STARTED — checklist drafted in CLOUDFLARE_CUTOVER_PLAN.md §3
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
| Workers | **LOCAL** — `apps/api` compiles under `wrangler deploy --dry-run`; never deployed |
| D1 | NOT STARTED |
| R2 | **PRODUCTION** — already the object store for video uploads (`apps/web/lib/r2.ts`, presigned PUT, browser→R2 direct) |
| Durable Objects | NOT STARTED |
| Queues | NOT STARTED — the outbox in `fila_emails` is the PostgreSQL stand-in, written to be swapped |
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
HEAD:                 e82ccf4  feat(api): adiciona worker hono inicial
base:                 a37d94e (master, in sync with origin/master at audit time)
commits ahead:        16
uncommitted files:    none
untracked files:      none (.omc/ is gitignored)
not pushed:           the branch has never been pushed to origin
```

One thing to know about this history: `e82ccf4` was amended to drop
`apps/api/node_modules`, which a `git add -A` staged because `.gitignore` had
`/node_modules` (root only). The pattern is now `node_modules/`. Nothing was
pushed, so no rewrite reached anyone.

## Next actions

### NEXT 1 — immediately executable

**Phase 5, first slice: `packages/db`.** Define repository interfaces for the
mission and offer domain and move `apps/web/lib/missions-db.ts` and
`queue-db.ts` behind them. This is the change that unblocks everything after
it — Phase 6 cannot extract routes, and Phase 10 cannot run PostgreSQL and D1
implementations side by side, until the SQL stops being written inline.

Start with the surface the tests already pin:

```
MissionRepository:  getById · listAvailable · reserve · abandon · submitDelivery
OfferRepository:    dispatch · accept · reject · expireStale · pendingFor
```

`lib/scheduler-db.ts`, `lib/session-revocation.ts`, `lib/email-queue-db.ts` and
`lib/email-dispatch.ts` were written to move with no changes — take them first
as the easy half.

Keep `apps/web/lib/mission-concurrency.test.ts` passing throughout; it is the
regression net for the whole extraction, and it is the one suite that will
catch a repository refactor quietly dropping an invariant.

### NEXT 2

**`P1-12`** — move single-recipient notifications onto `fila_emails`. The
outbox, the drain and the tests already exist; this is wiring `sendNotification`
call sites to `enqueueEmails` and is a good second task for the same session.

### NEXT 3

**Phase 3 / `ARCH-01`** — prototype vinext and OpenNext side by side and decide.
`vinext check` reports 97% with no blocking issues, but deciding honestly needs
a real deploy, which needs **Cloudflare credentials**. If those are unavailable,
skip to Phase 7 (database abstractions) instead of blocking.

**Recommended next model: GPT-5.6 Sol** — NEXT 1 and NEXT 2 are mechanical
extraction with edge cases and a test suite to keep green. Route back to Claude
Opus 5 for the D1 schema design, the Durable Object concurrency model and the
cutover. Gemini 3.7 Flash suits the repetitive import rewrites inside Phase 5.

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

The cost model's Scenario A is now **out of date in the good direction**: it
modelled ~870 billion D1 rows read per month from the per-poll sweep, which
`9de7246` removed. Re-derive it from the current code before quoting it.

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
- Single-recipient notifications are still `void`-fired and are being lost in serverless today (`P1-12`).

**Security regression**
- Row Level Security is enabled on 6 tables. D1 has no RLS. All of that authorization must move explicitly into `apps/api` — losing it silently is the most likely security regression in this migration (`P1-07`).
- The attempt limiter was dead in production until `274142d`. Production logs have not been reviewed for abuse that went unthrottled (`P0-09`).
- CSP is still `Report-Only` and permits `'unsafe-inline'` and `'unsafe-eval'` (`P2-04`).

**Duplicate infrastructure / downtime**
- Do not remove Vercel, Neon/Supabase, Resend or Sentry before their replacements are validated in production. Phase 23 is a separate approval.
- Do not merge `infra/cloudflare-scale` into `master` automatically. Do not tag, release or deploy migration work to production without explicit human approval.
