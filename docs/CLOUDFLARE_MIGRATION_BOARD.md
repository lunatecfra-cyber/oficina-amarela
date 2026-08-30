# Cloudflare Migration Board — Oficina Amarela

> **This file is the engineering source of truth for the Cloudflare scale initiative.**
> Branch: `infra/cloudflare-scale` · Jira: ONCA-117 (architecture), ONCA-116 (audit), ONCA-58 (launch readiness)
> Target: safely support **5,000 simultaneous users** at low, predictable cost.

Statuses: `DONE` · `IN PROGRESS` · `READY` · `WAITING FOR REVIEW` · `BLOCKED` · `BACKLOG`
Priorities: `P0` data loss / security / production / irreversible · `P1` migration + 5k scale ·
`P2` cost / reliability / performance / maintainability · `P3` cleanup

---

## Baseline (verified 2026-08-30, commit `a37d94e`)

| Check | Command | Result |
|---|---|---|
| Tests | `npm test` | **18 passed** without a database, **47 passed** with `TEST_DATABASE_URL` |
| Typecheck | `npx tsc --noEmit` | **clean** |
| Lint | `./node_modules/.bin/biome check .` | **clean** — 194 files |
| Build | `next build` | **succeeds** — 32 pages, 33 route handlers, middleware |
| Workers compat | `npx vinext check` | **97% compatible** — 0 issues, 1 partial (`@sentry/nextjs` server) |

> `npm run lint` output is mangled by the local RTK shell hook, which parses Biome
> output as ESLint and reports phantom errors. Run the Biome binary directly
> (`./node_modules/.bin/biome check .`) to get the truth.

Phase 0 is complete. Implementation started 2026-08-30: every P0 that could be
resolved from the repository is `DONE`, plus P1-01, P1-02, P1-05 and P1-06.
Nothing has been deployed and no provider has been removed.

**Database-backed tests** need a throwaway PostgreSQL:

```bash
docker run -d --rm --name oficina-pg -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=oficina -p 5439:5432 postgres:16-alpine
DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" node scripts/migrar.mjs
TEST_DATABASE_URL="postgres://postgres:test@127.0.0.1:5439/oficina" npm test
```

Without `TEST_DATABASE_URL` those suites skip and `npm test` still passes.

---

## Phase board

| Phase | Scope | Status |
|---|---|---|
| 0 | Repository audit and baseline | **DONE** |
| 1 | Turborepo / workspace setup | IN PROGRESS |
| 2 | Move existing app to `apps/web` | BACKLOG |
| 3 | Validate Next.js on Cloudflare Workers | BACKLOG |
| 4 | Create `apps/api` with Hono | BACKLOG |
| 5 | Introduce shared packages | BACKLOG |
| 6 | Extract APIs progressively | BACKLOG |
| 7 | Introduce database abstractions | BACKLOG |
| 8 | Audit PostgreSQL → D1 compatibility | BACKLOG (findings below already collected) |
| 9 | Create D1 schema and migration tooling | BACKLOG |
| 10 | Migrate data and repositories to D1 | BACKLOG |
| 11 | Introduce Queues | IN PROGRESS — outbox pattern landed on PostgreSQL (`P1-06`), Cloudflare Queues pending |
| 12 | Introduce Durable Objects | BACKLOG |
| 13 | Caching and KV | BACKLOG |
| 14 | Workflows where justified | BACKLOG |
| 15 | Consolidate R2 | BACKLOG |
| 16 | Evaluate Stream and Images | BACKLOG |
| 17 | Test Cloudflare Email Service | BACKLOG |
| 18 | Harden observability and security | BACKLOG |
| 19 | 5,000-user load tests | BACKLOG |
| 20 | Cost analysis | BACKLOG |
| 21 | Production readiness | BACKLOG |
| 22 | Production cutover | BACKLOG |
| 23 | Controlled legacy removal | BACKLOG |

---

## P0 — correctness, security, irreversibility

### `P0-01` · Mission claim has a TOCTOU race on the one-mission-per-editor rule
**Status:** **DONE** (2026-08-30, `51597e5` + `210f681`) · **File:** `lib/missions-db.ts:338-368`

`reserveMission()` checks "does this editor already hold a mission?" with a
`SELECT`, then reserves with a separate `UPDATE`. Two concurrent requests from the
same editor against two different available missions both pass the check and both
succeed. Nothing in `supabase/schema.sql` enforces the invariant — there is no
partial unique index on `pautas (reservada_por_id) WHERE status IN ('reservada',
'em_revisao','reedicao')`.

The mission side *is* safe: `UPDATE ... WHERE id = ? AND status = 'disponivel'` is
a single atomic statement, so two editors cannot claim the same mission.

**Resolved:** `idx_pautas_missao_ativa_por_editor`, a partial unique index on
`pautas (reservada_por_id) WHERE status IN ('reservada','em_revisao','reedicao')`.
`reserveMission()` keeps the pre-check for the message and treats the unique
violation as authoritative. Reproduced against real PostgreSQL both ways: with
a warm connection pool and no index, three simultaneous claims left one editor
holding three missions; with the index, one.

### `P0-02` · `acceptOffer` can leave an editor holding an offer but no mission
**Status:** **DONE** (2026-08-30, `5bf9c48`) · **File:** `lib/queue-db.ts:205-227`

The offer row is closed atomically (`status='pendente' → 'aceita'`, checked via
`RETURNING`), but the follow-up `UPDATE pautas ... WHERE id = ? AND status =
'oferecida'` has **no rowcount check**. If `expireTimedOutOffers()` has already
flipped the mission back to `'disponivel'`, or another path changed it, the offer
is consumed, the function returns `{ ok: true }`, and the editor is told they
accepted a mission they do not hold.

**Resolved:** the order is inverted. The mission is reserved first, gated on
`EXISTS (… oferta pendente e não expirada)`, and only then is the offer closed.
`ok: true` now means the editor actually holds the mission. The failure path
leaves a pending offer that expires on its own without returning a mission that
is already reserved.

### `P0-03` · `dispatchMissions` writes an offer and the mission status non-atomically
**Status:** **DONE** (2026-08-30, `5bf9c48` + `210f681`) · **File:** `lib/queue-db.ts:102-137`

`INSERT INTO ofertas` and `UPDATE pautas SET status='oferecida'` are separate
statements with no transaction. If the second is lost or raced, a pending offer
exists against a mission still marked `'disponivel'`, which another editor can
claim directly through `reserveMission()` — producing two editors on one mission.

The code catches unique violations (`isUniqueViolation`, code `23505`) as if a
uniqueness guard existed, but **no unique constraint on `ofertas` exists anywhere
in `supabase/`**. The `NOT EXISTS` guards inside `getNextEditor()` are the only
protection and they are not race-safe.

**Resolved:** `idx_ofertas_missao_editor` (`UNIQUE (pauta_id, editor_id)`) plus a
single statement — a data-modifying CTE claims the mission out of `'disponivel'`
and inserts the offer from its `RETURNING`, so either both happen or neither
does. A unique violation now rolls the whole statement back and the mission
stays claimable, which is what the existing `isUniqueViolation` catch always
assumed. `rejectOffer()` got the same treatment: it used to be able to strand a
mission in `'oferecida'` with no pending offer, which the expiry sweep never
rescued.

### `P0-04` · Development authentication bypasses must never reach a Worker
**Status:** **DONE** (2026-08-30, `9682f05`) · **Files:** `lib/server-session.ts:9-40`, `proxy.ts:6-24`

Three bypasses exist, each guarded by `process.env.NODE_ENV === "development"`
and some additionally by `!process.env.VERCEL`:
1. cookie `dev_god_mode=true` → returns a fabricated **admin** session;
2. no cookie at all → returns a fabricated **admin** session (`id: 1`);
3. `proxy.ts` lets unauthenticated requests through entirely.

The `!process.env.VERCEL` half of the guard becomes meaningless the moment the app
leaves Vercel. On Workers, `NODE_ENV` is set by the build, not the platform.

**Resolved:** `lib/dev-mode.ts` holds both gates. Each requires `NODE_ENV !==
"production"` **and** its env var set to exactly `"1"`; nothing looks at the
hosting provider. `ALLOW_DEV_AUTH_BYPASS` covers god mode, the fabricated
session, the demo-role session, the proxy passthrough, `/api/auth/dev-login` and
the fallback JWT secret; `ALLOW_DEMO_CONTENT` covers sample missions and
profiles. `lib/dev-mode.test.ts` pins the matrix, including a build with
`NODE_ENV` unset. Client components keep the `NODE_ENV` check — server env never
reaches them and the production bundle hardcodes `"production"`. Both flags are
documented in the README.

### `P0-05` · `lib/db.ts` silently returns empty results when `DATABASE_URL` is missing
**Status:** **DONE** (2026-08-30, `52bcc2a`) · **File:** `lib/db.ts:10-24`

The Proxy stub resolves every query to `[]`. Intended for build-time module
evaluation, it also makes a misconfigured production deployment look like an empty
but healthy database — empty rankings, no missions, "user not found" logins —
instead of failing loudly. This gets more dangerous during a cutover, when a
wrong or missing binding is exactly the failure mode being watched for.

**Resolved:** the stub now exists only during `next build`
(`NEXT_PHASE=phase-production-build`, needed because static generation runs
pages that query) or locally with `DATABASE_STUB=1` and `NODE_ENV !==
"production"`. Anything else throws with instructions. The stub is no longer
cached on `globalThis`, so it cannot outlive the phase that allowed it, and it
logs once when used. `lib/db-config.test.ts` pins all five cases, each in its
own process.

### `P0-06` · Confirm which database is actually in production
**Status:** BLOCKED — needs access to the live `DATABASE_URL` · **Owner:** human

The directory is `supabase/`, but `docs/INFRA.md` (verified against production
2026-08-13) records **Neon** Postgres 18 in `us-east-2`. No Supabase SDK is
installed. Section 12 of the initiative brief treats Supabase and Neon
differently. Every data-migration plan depends on knowing which one holds the
data, what the row counts are, and where backups live.

**Fix:** read the production `DATABASE_URL` host, record it here, and take a
verified backup before Phase 10 begins.

### `P0-07` · Preserve the dual-claim JWT format across the cutover
**Status:** READY · **File:** `lib/session.ts:5-90`

Live session tokens carry both `handle/name/role` and `apelido/nome/papel`, are
signed HS256 with `AUTH_SECRET`, and last **30 days**. Any change to the claim
shape, the cookie name (`confraria_sessao`), or the secret logs out every user.

**Fix:** `packages/auth` must accept the existing payload unchanged. The secret
must be carried to Workers verbatim. Do not rotate `AUTH_SECRET` as part of the
cutover; schedule it separately, after a 30-day overlap.

### `P0-08` · Candidate approval gate must survive the migration
**Status:** READY · **Files:** `supabase/migrations/20260829_add_electoral_ranking.sql`,
`lib/invitations-db.ts`

`voz` accounts can only be created through
`oficina_private.criar_porta_voz_com_convite()`, which consumes a single-use
hashed invitation under `FOR UPDATE` and writes an audit row. D1 has neither
stored procedures nor `FOR UPDATE`. Re-implementing this naïvely in application
code reopens the invitation to double-redemption.

**Fix:** re-implement as a conditional single-statement claim
(`UPDATE convites_porta_voz SET usado_em=... WHERE token_hash=? AND usado_em IS
NULL AND revogado_em IS NULL AND expira_em > ? RETURNING id`) followed by the
insert, inside a D1 batch — or serialise through a Durable Object. Cover it with
a concurrency test before cutover.

---

## P1 — required for Cloudflare and 5,000 concurrent users

### `P1-01` · Offer polling is the dominant load and it is all writes
**Status:** **DONE** (2026-08-30, `9de7246`) · **Files:** `app/api/editor/queue/next/route.ts:28-32`, `components/mission-offer.tsx:17`

Every editor polls `GET /api/editor/queue/next` every **15 seconds**. Each poll
runs, unconditionally:
1. `markEditorActive()` — an `UPDATE users` (a write, per editor, per poll);
2. `expireStaleOffers()` — an `UPDATE ... FROM users` join across pending offers;
3. `dispatchMissions()` — scans up to 20 available missions and runs the expensive
   `getNextEditor()` correlated query for each;
4. `getPendingOffer()` — a three-table join.

With 1,000 concurrent editors that is ~67 req/s, each doing several writes and a
scan — against a database D1 processes **single-threaded**. This does not survive
the target load in its current shape and is the single largest scalability item.

**Resolved for now:** the global sweep is claimed through a periodicity lock
(`lib/scheduler-db.ts`) — a conditional upsert on `tarefas_periodicas` lets at
most one request per 5s window run `expireStaleOffers()` + `dispatchMissions()`.
Everything else goes straight to the pending offer. `markEditorActive()` only
writes when `ultimo_visto_em` is older than 60s (the presence window is 3
minutes, so the decision is unchanged). `POST /api/missions` dispatches
immediately, so a new mission does not wait for the window. Rows read per poll
drop from ~20,000 to ~10.

**Still open for Phase 12:** presence and offer delivery as a Durable Object
push instead of polling (`ARCH-05`). The periodicity lock is deliberately
written to be replaceable by a Cron Trigger or Queue consumer without touching
the sweep itself.

### `P1-02` · `getSession()` issues a database read on every authenticated request
**Status:** **DONE** (2026-08-30, `11d14be`) · **File:** `lib/server-session.ts:46-64`

`SELECT sessoes_validas_apos FROM users WHERE id = ?` runs on every session read —
every page, every API call. At 5,000 concurrent users this alone is thousands of
D1 reads per second for a value that changes almost never.

**Resolved:** `lib/session-revocation.ts` caches the cutoff for 30s per process
(per isolate on Workers) and is invalidated on the spot by password change, ban
and account deletion. The residual staleness only affects instances that did not
perform the write, and is documented in the module. The transient-database
fail-open behaviour is unchanged.

### `P1-03` · Twenty pages are `force-dynamic` with no caching classification
**Status:** READY

`app/page.tsx` sets `revalidate = 300`. Twenty other pages set
`dynamic = "force-dynamic"`, including `/ranking` and `/candidato/[slug]`, which
are read-heavy and largely identical across users.

**Fix:** classify every route against the table in `CLOUDFLARE_ARCHITECTURE.md`
§2.8 before Phase 13, and record the classification in this board.

### `P1-04` · Server Components query the database directly
**Status:** READY

18 pages import `lib/*-db` modules and run SQL inline. This is the coupling that
blocks the Hono extraction.

Affected: `app/page.tsx`, `app/ranking/page.tsx`, `app/agenda/page.tsx`,
`app/editor/page.tsx`, `app/editor/criar-perfil/page.tsx`, `app/perfil/page.tsx`,
`app/perfil/editar/page.tsx`, `app/candidato/[slug]/page.tsx`,
`app/porta-voz/{page,criar-perfil,nova-pauta}/page.tsx`,
`app/porta-voz/perfil/{page,editar}/page.tsx`,
`app/porta-voz/missao/[id]/page.tsx`,
`app/inspetor/{page,novidades,panorama,denuncias}/page.tsx`.

**Fix:** route them through `packages/db` repository interfaces first (Phase 7),
then through the `apps/api` Service Binding (Phase 6).

### `P1-05` · In-memory rate limiting does not work on Workers
**Status:** **DONE** (2026-08-30, `274142d`) · **File:** `app/api/upload/presign/route.ts:14-29` (the `presignsByUser` map, line 16)

`presignsByUser` is a module-level `Map`. On Workers each isolate has its own
copy and isolates are created and evicted constantly, so the "10 presigns per
hour" ceiling effectively disappears.

**Resolved:** the presign limit now uses the `tentativas_login` table through
`recordAttempt`/`isRateLocked`, so it holds across instances, and its refusal
message is PT-BR like the rest.

**And the adjacent review found a live defect:** `recordAttempt()` did
`RETURNING tentativas` but compared `row.attempts` — the English name, which is
never present. The comparison was always `undefined >= max`, so `travado_ate`
stayed null forever and **login brute force, password-recovery spam and per-IP
signup flooding were all completely unthrottled**. Reproduced against the
database: eight attempts against a maximum of five, never locked. Fixed, and
`lib/rate-limit.test.ts` covers locking, expiry, window reset, key isolation and
per-call window/lock. Cloudflare edge Rate Limiting is still the Phase 18 target
in front of this.

### `P1-06` · Broadcast fans out emails synchronously inside the request
**Status:** **DONE** (2026-08-30, `7a9963f`) · **File:** `app/api/admin/broadcast/route.ts:58-80` (two loops, lines 59 and 72)

`POST /api/admin/broadcast` loops over every editor or every candidate and awaits
each Resend call in the request. This will exceed Worker CPU and wall-clock limits
long before the recipient list is interesting.

**Resolved:** the loop did not even await — it fired `void notify…()` per
recipient, which in a serverless runtime dies with the response, so most of the
mail was never sent while the route reported every recipient as notified.

Broadcast now writes one row per recipient into `fila_emails` and answers with
how many are new. Delivery happens outside the request: `after()` drains right
after the response (which becomes `waitUntil` on Workers), and the periodic
mission sweep drains the remainder so retries advance with traffic. The
idempotency key is group + email + hour. Claiming uses a 5-minute backoff, a
5-attempt ceiling, and repeats its conditions in the outer `WHERE` instead of
`FOR UPDATE SKIP LOCKED` — which D1 does not have. `lib/email-dispatch.ts` is
the seam that becomes a Cloudflare Queue consumer.

**Still open:** the single-recipient notifications elsewhere in the app are
still `void`-fired and share the same serverless delivery problem. Move them
onto the same outbox in Phase 11.

### `P1-07` · PostgreSQL features with no D1 equivalent
**Status:** READY · **Sources:** `supabase/schema.sql`, `supabase/migrations/*`

D1 is SQLite. Every item below is a required reimplementation, not a syntax tweak.

| Postgres feature | Where | D1 answer |
|---|---|---|
| `plpgsql` stored functions (2) | `oficina_private.criar_porta_voz_com_convite`, `oficina_private.aprovar_edicao` | reimplement in `packages/domain` + D1 batch; see `P0-08` |
| Custom schema `oficina_private` | ranking migration | no schemas in SQLite — flatten |
| `SELECT ... FOR UPDATE` | both functions | conditional single-statement writes or Durable Object |
| `FOR UPDATE SKIP LOCKED` | `lib/electoral-ranking-db.ts:320` (shield consumption) | conditional `UPDATE ... WHERE consumido_em IS NULL RETURNING` |
| `GENERATED ALWAYS AS (...) STORED` | `users.nivel` | compute in `packages/domain`, or a maintained column |
| `TEXT[]` arrays | `users.softwares/estilos/nicho/bandeiras/palavras_chave`, `musicas.tags` | JSON columns or join tables |
| `JSONB` + `jsonb_build_object` + `->`/`->>` | `users.disponibilidade`, `users.redes_sociais`, `auditoria_admin.detalhes` | SQLite `json_*` functions; `disponibilidade` indexing in `getNextEditor()` must be redesigned |
| `GIN` index | `musicas.tags` | FTS5 or a tag join table |
| `UUID` type + `gen_random_uuid()` | `users.codigo_indicacao`, `musicas.id` | TEXT + `crypto.randomUUID()` |
| `SERIAL` / `BIGSERIAL` | every table | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `TIMESTAMPTZ` + `now()` | everywhere | TEXT ISO-8601 or INTEGER epoch — pick one and enforce it |
| `NUMERIC(3,2)` | `users.nota` | REAL with explicit rounding |
| Partial and expression indexes | `idx_users_apelido` on `lower(apelido)`, `idx_ranking_ciclo_aberto`, `idx_convites_porta_voz_email_aberto`, and 5 more | SQLite supports both — verify each plan with `EXPLAIN QUERY PLAN` |
| `ON CONFLICT ... DO UPDATE ... WHERE` | `aprovar_edicao` | SQLite supports upsert; re-verify the `WHERE` clause semantics |
| `= ANY(${array})` | `lib/queue-db.ts:51` | expand to `IN (?, ?, …)`, watch the 100-parameter cap |
| `(x || ' minutes')::interval` | `lib/queue-db.ts` | compute timestamps in TypeScript |
| `EXTRACT(DOW/HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo')` | `getNextEditor()` | compute in the Worker; SQLite has no timezone database |
| `ROW LEVEL SECURITY` on 6 tables | ranking migration | no RLS in D1 — authorization moves entirely into `apps/api`; treat as a **security regression risk** |
| `RAISE EXCEPTION ... ERRCODE` | both functions | typed domain errors |
| Unique-violation code `23505` | `lib/queue-db.ts:21` | SQLite reports `SQLITE_CONSTRAINT_UNIQUE` — the detector must be rewritten |

### `P1-08` · Mission chat polls every 5 seconds
**Status:** READY · **File:** `components/mission-chat.tsx:39`

Every open mission chat issues a request every 5 s. At scale this is the second
realtime workload after offer polling.

**Fix:** Durable Object `chat:{missionId}` with WebSockets (Phase 12).

### `P1-09` · Add `"type": "module"` to `package.json`
**Status:** **DONE** (2026-08-30)

`"type": "module"` added; the now-redundant
`--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` flag removed from the `test`
script. No `.js` files and no CommonJS (`require`, `module.exports`, `__dirname`)
exist anywhere in `app/`, `lib/`, `components/`, `scripts/` or the config files,
so nothing else needed changing. All 17 `scripts/*.mjs` still parse.

Validation: `npm test` 7/7 · `tsc --noEmit` clean · Biome clean · `next build` ok ·
`npx vinext check` **92% → 97% compatible, 0 issues remaining**.

### `P1-10` · Decide vinext vs OpenNext (`ARCH-01`)
**Status:** READY · Cloudflare recommends vinext (beta) for new work and OpenNext
for maintaining existing apps. `vinext check` reports 92% compatibility here.
Phase 3 must prototype both and decide on measured evidence.

### `P1-11` · `@sentry/nextjs` server integration on Workers
**Status:** READY · Reported as partial by `vinext check`: client-side works,
server integration needs manual setup. Sentry must not be removed during early
phases — see `P2-05`.

---

## P2 — cost, reliability, performance, maintainability

| ID | Item | Status |
|---|---|---|
| `P2-01` | Remove `@vercel/blob` — single call site, `app/api/tools/music/route.ts:1`. Migrate the music upload to R2, then drop the dependency. | READY |
| `P2-02` | `users` has 45 columns mixing account, editor and candidate concerns. Review the split before the D1 schema is frozen (`ARCH-04`). | BACKLOG |
| `P2-03` | 15 `lib/*-db.ts` modules hold SQL inline with no repository boundary. Extract interfaces in Phase 7 so Postgres and D1 implementations can run side by side. | BACKLOG |
| `P2-04` | Promote CSP from `Content-Security-Policy-Report-Only` to enforcing (`next.config.ts:34`). It still contains `'unsafe-inline'` and `'unsafe-eval'` in `script-src`. | BACKLOG |
| `P2-05` | Sentry DSN is not configured in production (`docs/INFRA.md`). The library records nothing today. Turn it on before load testing so the tests produce evidence. | READY |
| `P2-06` | 17 `scripts/*.mjs` operational scripts connect via `DATABASE_URL`. They need D1 equivalents (`wrangler d1 execute`) or explicit retirement. | BACKLOG |
| `P2-07` | Domain `oficinaamarela.com.br` still has `v=spf1 -all` and a null MX. Email cannot be delivered from the domain by any provider until DNS is fixed. Blocks Phase 17. | BLOCKED — human |
| `P2-08` | Test coverage went from 7 pure-function assertions to 47, including PostgreSQL-backed suites for mission concurrency, the periodicity lock, the session-revocation cache, the attempt limiter and the email outbox. `scripts/test-alias-hooks.mjs` resolves the `@/` alias so `node:test` can import `lib/` modules at all. Database suites run serially (`--test-concurrency=1`) because the concurrency suite truncates. | **DONE** |
| `P2-09` | Covered so far: mission claim/offer concurrency, session revocation, rate limiting, dev-mode gates, database configuration, email outbox. **Still uncovered:** authorization by role, mission abandon/submit/approve/revise, ranking mutation, gamification, invitation redemption, candidate approval. | IN PROGRESS |
| `P2-10` | Add `.omc/` to `.gitignore` (currently untracked noise in `git status`). | BACKLOG |

---

## P3 — cleanup

| ID | Item | Status |
|---|---|---|
| `P3-01` | Legacy PT-BR aliases are exported alongside every English name in `lib/session.ts`, `lib/missions-db.ts`, `lib/queue-db.ts` and others. Retire them once no call site remains. | BACKLOG |
| `P3-02` | `parceiros-screenshot.png` (766 KB) sits at the repository root. | BACKLOG |
| `P3-03` | `tsconfig.tsbuildinfo` (452 KB) is tracked but `*.tsbuildinfo` is in `.gitignore`. | BACKLOG |
| `P3-04` | `ARCH-03`: decide whether D1 keeps PT-BR table/column names or renames to English with a mapping layer. Cheapest at the D1 cut, expensive after. | BACKLOG |

---

## New items found during implementation

| ID | Item | Status |
|---|---|---|
| `P0-09` | **The attempt limiter never locked anything.** Detail under `P1-05`. Fixed in `274142d`, but production has been running without brute-force, recovery-spam or signup-flood protection — worth checking `auditoria_admin` and access logs for abuse that went unthrottled. | **DONE** (code) · **BLOCKED** (log review needs production access) |
| `P1-12` | Single-recipient notifications (`lib/email.ts` → `sendNotification`) are still fired with `void` from route handlers. Same serverless delivery loss as the broadcast had. Move them onto `fila_emails`. | READY |
| `P2-11` | The `fila_emails` and `tarefas_periodicas` drains are triggered by request traffic, since there is no scheduler. On Cloudflare these become Cron Triggers or Queue consumers; until then, a quiet site does not retry failed email. | BACKLOG |
| `P2-12` | `supabase/migrations/*.sql` are not applied by any runner — `scripts/migrar.mjs` applies `supabase/schema.sql` only. The migration files are documentation unless run by hand. Decide on one mechanism before Phase 9. | BACKLOG |

---

## Immediate next actions

1. **Phase 1 / Phase 2** — Turborepo workspace, then move the application into
   `apps/web` preserving behaviour. Structural migration lands before any
   infrastructure rewrite.
2. **`P1-10` / Phase 3** — prototype vinext and OpenNext side by side and record
   the result under `ARCH-01`. `vinext check` now reports 97% with no blocking
   issues.
3. **`P0-06`** — confirm the production database provider and take a verified
   backup. Blocks Phase 8 onward; needs human access.
4. **`P0-09` follow-up** — review production logs for abuse that the dead
   limiter allowed. Needs human access.
