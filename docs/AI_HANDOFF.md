# AI Handoff — Oficina Amarela · Cloudflare Scale Migration

## Session

```
date:                   2026-08-30
current model:          Claude Opus 5
recommended next model: GPT-5.6 Sol  (see "Next Actions" for why)
repository:             github.com/lunatecfra-cyber/oficina-amarela
branch:                 infra/cloudflare-scale
base commit audited:    a37d94e  chore: migra linter e formatador de ESLint para Biome
HEAD:                   the documentation commit on this branch — run `git log -1`
working tree:           clean except untracked .omc/ (local OMC state, not part of this work)
```

---

## Objective

Migrate Oficina Amarela to `Turborepo + Next.js + Hono + Cloudflare` so it safely
supports **5,000 simultaneous users** at low, predictable cost — without rewriting
working product behaviour. This session executed **Phase 0 only**: audit, baseline
and documentation. Nothing was migrated, removed or deployed.

---

## Current architecture

Single Next.js 16.3.3 / React 19.2.8 App Router application at the repository
root. No workspace. 32 pages, 3 layouts, 33 route handlers, 62 components,
38 `lib/` modules. TypeScript strict. Tailwind 4. Biome 2.5.11 (ESLint fully
removed). Sessions are `jose` HS256 JWTs in the `confraria_sessao` cookie.
Data access is raw SQL through the `postgres` driver, written inline in
`lib/*-db.ts` and called directly from Server Components. Object storage is
Cloudflare R2 via presigned S3 URLs. Email is Resend. Hosting is Vercel Hobby.

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

1. Created branch `infra/cloudflare-scale` from a clean, in-sync `master` (`a37d94e`).
2. Full repository audit — architecture, routes, data layer, auth, storage, email, observability.
3. Inventoried all 33 `app/api/*` route handlers.
4. Identified the 18 Server Components that query the database directly.
5. Catalogued every PostgreSQL-specific construct that has no D1 equivalent (23 categories).
6. Located all storage paths, including the single remaining `@vercel/blob` call site.
7. Mapped authentication and its dev bypasses.
8. Identified synchronous work that must become asynchronous.
9. Identified concurrency-sensitive operations and found **three real races** (`P0-01`, `P0-02`, `P0-03`).
10. Identified realtime and cacheable workloads.
11. Verified Next.js compatibility with the Cloudflare runtime by running `npx vinext check` — **92% compatible**.
12. Ran the full baseline validation suite — all green.
13. Wrote the six required documents.

Files created (all new, none modified):

```
docs/CLOUDFLARE_MIGRATION_BOARD.md   the engineering source of truth
docs/CLOUDFLARE_ARCHITECTURE.md      current (verified) + target architecture
docs/CLOUDFLARE_COST_MODEL.md        unit prices, traffic model, two scenarios, scaling curve
docs/CLOUDFLARE_LOAD_TEST_PLAN.md    six scenarios, thresholds, verification queries
docs/CLOUDFLARE_CUTOVER_PLAN.md      prerequisites through legacy removal
docs/AI_HANDOFF.md                   this file
```

---

## Current task

Phase 0 — repository audit, baseline and documentation.

## Task state

```
COMPLETE
```

Phase 0 is finished. Phase 1 has not started. No application code was touched.

---

## Files changed

Six new files under `docs/`. **Zero changes to `app/`, `lib/`, `components/`,
`scripts/`, `supabase/`, `package.json`, `next.config.ts`, `proxy.ts` or
`biome.json`.** The application is byte-identical to `master`.

---

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
tests run:      npm test · npx tsc --noEmit · ./node_modules/.bin/biome check . · next build
tests passed:   7/7 unit · typecheck clean · lint clean (194 files) · build succeeds
tests failed:   0
tests remaining: everything that matters — see below
```

Exact commands:

```bash
npm test                              # 7 passed, 0 failed
npx tsc --noEmit                      # No errors found
./node_modules/.bin/biome check .     # Checked 194 files, exit 0
./node_modules/.bin/next build        # exit 0 — 32 pages, 33 handlers, middleware
npx vinext check                      # 92% compatible
```

> **Do not trust `npm run lint`.** The local RTK shell hook parses Biome's output
> as ESLint and reports phantom errors ("Lint: 2 errors"). Biome is clean. Run the
> binary directly, or `rtk proxy` to bypass the filter.

Coverage gap: the only test file is `lib/electoral-ranking.test.ts` — 7 assertions,
all pure functions (weekly goals, awards, tiebreak, invitation validity, shields,
referrals). **There is no test coverage of authentication, authorization, mission
claim, mission approval, or anything touching the database.** `P2-09` on the board
requires closing this before critical infrastructure is changed.

---

## Known issues

Three genuine concurrency defects were found in the existing code. They are
current production bugs, not migration artifacts, and they get worse on D1:

- **`P0-01`** `lib/missions-db.ts:338` — `reserveMission()` checks "editor already has a mission" with a `SELECT` and reserves with a separate `UPDATE`. Two concurrent claims by one editor on two missions both succeed. No database invariant prevents it.
- **`P0-02`** `lib/queue-db.ts:205` — `acceptOffer()` consumes the offer atomically but does not check the rowcount of the follow-up `UPDATE pautas`. If the mission already reverted to `'disponivel'`, the function returns `{ok:true}` for a mission the editor does not hold.
- **`P0-03`** `lib/queue-db.ts:102` — `dispatchMissions()` inserts the offer and updates the mission status in two unwrapped statements, and catches unique-violation `23505` as though a constraint existed. **No unique constraint on `ofertas` exists anywhere in `supabase/`.**

Also outstanding:

- **`P0-04`** Development auth bypasses (`dev_god_mode` cookie, and a fabricated admin session when no cookie is present) are guarded by `NODE_ENV === "development"` and `!process.env.VERCEL`. The `VERCEL` half becomes meaningless off Vercel.
- **`P0-05`** `lib/db.ts` returns a Proxy stub resolving every query to `[]` when `DATABASE_URL` is missing — a misconfigured production looks like an empty healthy database.
- **`P1-01`** Every 15 s, every editor's poll runs `markEditorActive` (a write), `expireStaleOffers`, and `dispatchMissions` (20 × an unindexed correlated scan). This is the largest scalability blocker.
- **`P1-02`** `getSession()` issues a database read on every authenticated request.
- **`P1-05`** The presign rate limit is a module-level `Map` — meaningless across Worker isolates.
- **`P1-06`** `POST /api/admin/broadcast` awaits one Resend call per recipient inside the request.
- **`P1-11`** `@sentry/nextjs` server integration needs manual setup on Workers (partial per `vinext check`).
- **`P2-05`** Sentry DSN is not configured in production — it records nothing today.
- **`P2-07`** `oficinaamarela.com.br` publishes `v=spf1 -all` and a null MX. No provider can deliver from the domain.

Temporary implementations left in place deliberately: the PT-BR legacy aliases
exported alongside every English name (`lib/session.ts`, `lib/missions-db.ts`,
`lib/queue-db.ts`, others). They are `P3-01` — retire only when no call site remains.

---

## Database state

```
source database:    PostgreSQL — Neon (per docs/INFRA.md, verified 2026-08-13)
                    ⚠ contradicted by the supabase/ directory name; ARCH-02 / P0-06 is open
target database:    Cloudflare D1
schema status:      canonical schema at supabase/schema.sql — 19 tables, PT-BR names,
                    4 migrations under supabase/migrations/
                    Postgres-specific: 2 plpgsql functions in schema oficina_private,
                    RLS on 6 tables, a STORED generated column, TEXT[] arrays, JSONB,
                    a GIN index, UUID, partial and expression indexes,
                    FOR UPDATE and FOR UPDATE SKIP LOCKED
migration status:   NOT STARTED — no D1 schema written, no migration tooling built
validation status:  NOT STARTED — validation checklist drafted in CLOUDFLARE_CUTOVER_PLAN.md §3
rollback status:    documented in CLOUDFLARE_CUTOVER_PLAN.md §8, not yet rehearsed
```

---

## Cloudflare state

| Service | State |
|---|---|
| Workers | NOT STARTED |
| D1 | NOT STARTED |
| R2 | **PRODUCTION** — already the object store for video uploads (`lib/r2.ts`, presigned PUT, browser→R2 direct) |
| Durable Objects | NOT STARTED |
| Queues | NOT STARTED |
| Workflows | NOT STARTED |
| KV | NOT STARTED |
| Stream | NOT STARTED |
| Images | NOT STARTED |
| Email Service | NOT STARTED |
| Analytics Engine | NOT STARTED |
| Workers Logs | NOT STARTED |
| Turnstile | NOT STARTED |
| WAF | NOT STARTED |

R2 is the only Cloudflare service already carrying production traffic.

---

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
HEAD:                 the documentation commit on this branch — run `git log -1`
base:                 a37d94e (master, in sync with origin/master at audit time)
last relevant commit: docs(infra): adiciona auditoria e plano de migração cloudflare
uncommitted files:    none
untracked files:      .omc/  (local OMC state — do not commit; P2-10 adds it to .gitignore)
not pushed:           this branch has not been pushed to origin
```

---

## Next actions

### NEXT 1 — immediately executable

Add `"type": "module"` to `package.json` (`P1-09`). This is the single blocking
issue reported by `npx vinext check`, and it is the smallest change that moves
Phase 1 forward.

```bash
git checkout infra/cloudflare-scale
# edit package.json: add "type": "module"
npm test && npx tsc --noEmit && ./node_modules/.bin/biome check . && ./node_modules/.bin/next build
```

If any of the four fails, the ESM switch has a real consequence (the 17
`scripts/*.mjs` files and `instrumentation*.ts` are the likely places) — fix it
before committing. Commit as `chore(infra): habilita esm no pacote raiz`.

### NEXT 2

Add the two missing database invariants as a new PostgreSQL migration under
`supabase/migrations/`, so they exist **before** the D1 schema is derived rather
than being invented there:

- partial unique index on `pautas (reservada_por_id) WHERE status IN ('reservada','em_revisao','reedicao')` — closes `P0-01`;
- `UNIQUE (pauta_id, editor_id)` on `ofertas` — closes `P0-03` and makes the existing `isUniqueViolation` check meaningful.

Then fix the rowcount check in `acceptOffer()` (`P0-02`). Write a concurrency test
for each before changing the code.

### NEXT 3

Phase 1 — Turborepo/workspace setup, then Phase 2 — move the application to
`apps/web` with behaviour preserved. Do **not** combine these with Phase 3
(Workers validation) or any Hono work. Structural migration lands before
infrastructure rewrites.

**Recommended next model: GPT-5.6 Sol** — NEXT 1 and NEXT 2 are concrete
implementation with edge cases and tests, which is where Sol is strongest. Route
back to Claude Opus 5 for the D1 schema design, the Durable Object concurrency
model, and the cutover. Use Gemini 3.7 Flash for the mechanical file moves in
Phase 2.

---

## Do not redo

- The repository audit. It is complete and recorded in `CLOUDFLARE_ARCHITECTURE.md` §1 and the migration board. Re-derive only if the repository materially changed.
- The baseline validation. Tests, typecheck, lint and build were all green at `a37d94e`.
- The `vinext check` compatibility run. 92% compatible; 1 blocking issue (`"type": "module"`), 1 partial (`@sentry/nextjs` server).
- The PostgreSQL → D1 incompatibility catalogue. 23 categories are enumerated in `P1-07` on the board with file references.
- The concurrency analysis of `reserveMission`, `acceptOffer` and `dispatchMissions`. Three defects are located and explained with line numbers.
- The unit-price table in the cost model. Verified against Cloudflare docs on 2026-08-30.

---

## Warnings

**Data loss**
- Do not run any `scripts/migrar-*.mjs` against production without a verified restorable backup. They connect via `DATABASE_URL` and write directly.
- `lib/db.ts` returns `[]` for every query when `DATABASE_URL` is unset. A misconfigured deployment will look like an empty, healthy database rather than failing (`P0-05`).

**Broken authentication**
- `AUTH_SECRET` must be carried to Workers **verbatim**. Rotating it invalidates every session; tokens live 30 days.
- The JWT payload carries both English and PT-BR claims and the cookie is named `confraria_sessao`. Changing either logs out every user (`P0-07`).
- The dev bypasses in `lib/server-session.ts` and `proxy.ts` grant a fabricated **admin** session. They are guarded by `NODE_ENV` and `!process.env.VERCEL`; the second half stops meaning anything off Vercel (`P0-04`).

**Race conditions**
- `P0-01`, `P0-02` and `P0-03` are live today. Moving to D1 without fixing them makes them worse: D1 has no `FOR UPDATE`, so the multi-statement patterns lose even their partial protection.
- `oficina_private.aprovar_edicao()` and `criar_porta_voz_com_convite()` rely on `FOR UPDATE`. Reimplementing them naïvely in application code allows double-scoring an approval and double-redeeming an invitation (`P0-08`).

**Duplicate email delivery**
- `POST /api/admin/broadcast` sends in a loop inside the request. If it is queued without an idempotency key, a retry re-sends to everyone (`P1-06`).
- Cloudflare Email Service and Resend must never both send the same message.

**Security regression**
- Row Level Security is enabled on 6 tables today. D1 has no RLS. All of that authorization must move explicitly into `apps/api` — losing it silently is the most likely security regression in this whole migration (`P1-07`).
- The presign rate limit is per-isolate and effectively disappears on Workers (`P1-05`).
- CSP is still `Report-Only` and permits `'unsafe-inline'` and `'unsafe-eval'` (`P2-04`).

**Duplicate infrastructure / downtime**
- Do not remove Vercel, Neon/Supabase, Resend or Sentry before their replacements are validated in production. Phase 23 is a separate approval.
- Do not merge `infra/cloudflare-scale` into `master` automatically. Do not tag, release or deploy migration work to production without explicit human approval.
