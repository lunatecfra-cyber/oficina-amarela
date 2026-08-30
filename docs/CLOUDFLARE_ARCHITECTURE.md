# Cloudflare Architecture — Oficina Amarela

> Branch: `infra/cloudflare-scale`
> Last verified against the repository: 2026-08-30 (commit `a37d94e`)
> Companion documents: `CLOUDFLARE_MIGRATION_BOARD.md`, `CLOUDFLARE_COST_MODEL.md`,
> `CLOUDFLARE_LOAD_TEST_PLAN.md`, `CLOUDFLARE_CUTOVER_PLAN.md`, `AI_HANDOFF.md`.

Everything in section 1 was read out of the repository during the Phase 0 audit.
Everything in section 2 onward is the approved target and is **not yet implemented**.

---

## 1. Current architecture (verified)

### 1.1 Repository shape

Turborepo workspace since 2026-08-30 (Phases 1, 2 and 4). `packages/` does not
exist yet — that is Phase 5.

```
oficina-amarela/
├── apps/
│   ├── web/            @oficina/web — Next.js 16
│   │   ├── app/        App Router — 32 pages, 3 layouts, 33 route handlers
│   │   ├── components/ 62 client/server components
│   │   ├── lib/        domain logic AND raw SQL, still mixed
│   │   ├── public/
│   │   ├── scripts/    test-alias-hooks.mjs (resolves "@/" for node:test)
│   │   ├── proxy.ts    Next.js 16 middleware (renamed from middleware.ts)
│   │   └── next.config.ts  security headers + CSP (Report-Only)
│   └── api/            @oficina/api — Hono on Cloudflare Workers
│       ├── src/app.ts  request id, structured logs, PT-BR errors, /health
│       └── wrangler.jsonc  nodejs_compat, observability; no bindings yet
├── scripts/            11 .mjs operational scripts (migrations, seeds, backup)
├── supabase/           schema.sql (canonical) + 5 migrations
├── docs/
├── turbo.json
├── biome.json          covers the whole repository from the root
└── package.json        workspace root — oficina-amarela
```

`apps/api` has no business routes yet and nothing calls it. Route extraction is
Phase 6.

### 1.2 Runtime stack (from `package.json`)

| Dependency | Version | Role |
|---|---|---|
| `next` | 16.3.3 | App Router, RSC, SSR |
| `react` / `react-dom` | 19.2.8 | UI |
| `typescript` | ^5 | strict mode on (`tsconfig.json`) |
| `tailwindcss` | ^4 | styling, via `@tailwindcss/postcss` |
| `@biomejs/biome` | 2.5.11 | lint + format (ESLint fully removed) |
| `postgres` | ^3.4.9 | native PG driver, `prepare: false` |
| `jose` | ^6.2.10 | HS256 JWT sessions |
| `bcryptjs` | ^3.0.3 | password hashing |
| `@aws-sdk/client-s3` + `s3-request-presigner` | ^3.1121.0 | R2 presigned uploads |
| `@vercel/blob` | ^2.8.0 | **one call site only** (see 1.7) |
| `resend` | ^6.25.0 | transactional email |
| `@sentry/nextjs` | ^10.72.0 | error tracking |

No route handler declares `export const runtime`. Everything runs on the default
Node.js server runtime.

### 1.3 Data layer

`lib/db.ts` exports a single template-tag function `sql`. It lazily builds one
`postgres()` client cached on `globalThis.__workshopSql`, with `prepare: false`
(required by the transaction pooler). When `DATABASE_URL` is absent it returns a
Proxy stub that resolves every query to `[]` — a build-time convenience that
**silently hides a missing database at runtime**.

There is no repository layer, no query builder, and no ORM. SQL is written inline
in 15 `lib/*-db.ts` modules and read directly from Server Components.

Canonical schema: `supabase/schema.sql` (19 tables, PT-BR named).

| Table | Purpose |
|---|---|
| `users` | all roles (`papel` ∈ `voz`, `editor`, `admin`), profile, gamification counters |
| `pautas` | missions — brief, status machine, reservation, delivery links |
| `ofertas` | mission offers to editors (the dispatch queue) |
| `mensagens` | mission chat |
| `avaliacoes` | delivery ratings |
| `denuncias` | reports |
| `portfolio`, `conquistas` | editor showcase and badges |
| `musicas`, `novidades` | tools library, news |
| `gamificacao_regras`, `gamificacao_eventos` | XP rules and idempotent XP events |
| `ranking_ciclos`, `ranking_aprovacoes` | Electoral Ranking cycles and scored approvals |
| `convites_porta_voz` | spokesperson invitations (hashed tokens) |
| `indicacoes_recompensas` | referral rewards |
| `bloqueios_constancia` | consistency shields |
| `auditoria_admin` | admin audit log |
| `tentativas_login` | login throttling |

**Where the database actually lives is contradictory.** The directory is named
`supabase/`, but `docs/INFRA.md` (verified against production on 2026-08-13)
records the live database as **Neon** Postgres 18, `us-east-2`, via the pooler.
No Supabase client library is installed — only the raw `postgres` driver — so the
code is provider-agnostic and either is plausible. This must be confirmed against
the live Vercel `DATABASE_URL` before any migration planning is finalised.

### 1.4 The mission lifecycle (the core domain flow)

```
porta-voz creates pauta          status = 'disponivel'
        │
        ▼
dispatchMissions()               picks up to 20 available missions,
  lib/queue-db.ts                for each picks ONE eligible editor
        │                        → INSERT ofertas, status = 'oferecida'
        ▼
editor polls GET /api/editor/queue/next  (every 15 s, mission-offer.tsx)
        │
        ├── accept  → status = 'reservada', reservada_por_id = editor
        └── decline → offer 'rejeitada', dispatchMissions() runs again
        │
        ▼
editor submits delivery          status = 'em_revisao'
        │
        ├── inspector/porta-voz requests changes → 'reedicao'
        └── approval → oficina_private.aprovar_edicao()
                       → 'aprovada' / 'finalizada'
                       → +1 entregues, +25 reputacao, +1 streak
                       → INSERT ranking_aprovacoes (scores the Electoral Ranking)
                       → INSERT auditoria_admin
```

Editor eligibility inside `getNextEditor()` (`lib/queue-db.ts`) is a single
correlated query filtering on presence (`ultimo_visto_em` within 3 minutes),
reservation lock, weekly availability JSONB indexed by São Paulo weekday/period,
absence of an active mission, absence of a pending offer, and no prior offer for
the same mission — ordered by prior history with that spokesperson, then
deliveries, then least-recently-seen.

### 1.5 Authentication and authorization

- `lib/session.ts` — `jose` HS256 JWT, 30-day expiry, signed with `AUTH_SECRET`.
  Cookie `confraria_sessao`, `httpOnly`, `sameSite=lax`, `secure` in production.
  The payload carries both English (`handle`, `name`, `role`) and legacy PT-BR
  (`apelido`, `nome`, `papel`) claims; `verifySessionToken` accepts either and
  normalises `voz` → `spokesperson`. **This dual-claim format must be preserved**
  until every live token has expired (30 days after cutover).
- Separate signed tokens exist for OAuth state, pending Google identity, and
  password recovery, all using the same key.
- `lib/server-session.ts` — `getSession()` reads the cookie, verifies the JWT,
  then issues `SELECT sessoes_validas_apos FROM users WHERE id = ?` on **every
  call** to enforce global session revocation. On a DB error it fails *open* and
  trusts the JWT signature.
- `proxy.ts` — edge middleware doing role-based route protection for
  `/porta-voz`, `/editor`, `/inspetor`, `/perfil`, `/agenda`, `/ranking`,
  `/aulas`, `/ferramentas` and their English aliases.
- Google OAuth 2.0 (`lib/oauth-google.ts`), password auth with `bcryptjs`
  (`lib/accounts.ts`), login throttling via the `tentativas_login` table.

Candidate legitimacy is gated by `convites_porta_voz`: a `voz` account can only
be created through `oficina_private.criar_porta_voz_com_convite()`, which
consumes a single-use hashed invitation under `FOR UPDATE`. Self-registration
cannot produce a spokesperson. **This rule survives the migration unchanged.**

### 1.6 Storage

`lib/r2.ts` builds an `S3Client` against
`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` and returns a presigned
`PutObject` URL valid for 1 hour. `POST /api/upload/presign` gates it on session,
MIME type (`video/mp4|quicktime|x-msvideo|webm`), 2 GB size ceiling and an
in-process rate limit. Browsers upload straight to R2 — Workers never carry the
video bytes. This is already the target pattern.

### 1.7 Vercel Blob

Exactly one call site: `app/api/tools/music/route.ts` imports `put` from
`@vercel/blob` for the music library upload. Everything else is on R2. Removing
this dependency is a small, self-contained change.

### 1.8 Email

`lib/email.ts` wraps Resend directly. Notifications are fired from route handlers.
Some are fire-and-forget (`void (async () => …)` in
`app/api/editor/queue/next/route.ts`), but `POST /api/admin/broadcast` sends to
every editor or every candidate in a **sequential `for` loop inside the request**.

### 1.9 Observability

Sentry via `instrumentation.ts` / `instrumentation-client.ts`.
`docs/INFRA.md` records the DSN as **not configured in production** — the library
is installed but recording nothing.

### 1.10 Hosting today

Vercel Hobby (`oficina-amarela-woad.vercel.app`), Neon Postgres, Resend sandbox
sender, domain `oficinaamarela.com.br` registered at registro.br with DNS still
pending. Recorded monthly cost: R$ 0.

---

## 2. Target architecture

```
                             ┌───────────────────────────┐
        browser  ──────────► │ Cloudflare edge           │
                             │ WAF · Rate Limiting ·     │
                             │ Turnstile · Cache         │
                             └────────────┬──────────────┘
                                          │
                             ┌────────────▼──────────────┐
                             │ apps/web   (Worker)       │
                             │ Next.js 16 · RSC · SSR    │
                             │ MPA — pages, layouts, UI  │
                             └────────────┬──────────────┘
                                          │ Service Binding (internal, no public hop)
                             ┌────────────▼──────────────┐
                             │ apps/api   (Worker)       │
                             │ Hono — validate · authn · │
                             │ authz · domain · dispatch │
                             └──┬────┬────┬────┬────┬────┘
                                │    │    │    │    │
              ┌─────────────────┘    │    │    │    └──────────────┐
              ▼                      ▼    ▼    ▼                   ▼
        ┌──────────┐        ┌────────────┐  ┌────────┐     ┌──────────────┐
        │ D1       │        │ Durable    │  │ Queues │     │ R2 / Stream  │
        │ relational│       │ Objects    │  │ email  │     │ Images       │
        │ business │        │ mission:{} │  │ ranking│     │ media        │
        │ state    │        │ chat:{}    │  │ audit  │     └──────────────┘
        └──────────┘        └────────────┘  └────────┘
              ▲                                  │
              │                            ┌─────▼──────┐   ┌──────────────────┐
        ┌─────┴──────┐                     │ Workflows  │   │ Analytics Engine │
        │ KV          │                    │ approvals  │   │ telemetry        │
        │ flags/config│                    └────────────┘   └──────────────────┘
        └─────────────┘
```

### 2.1 Workspace layout

```
apps/web        Next.js 16 on Workers — presentation only
apps/api        Hono on Workers — the API boundary
packages/domain framework-free business rules (state machine, ranking, gamification)
packages/db     repository interfaces + Postgres and D1 implementations
packages/auth   session tokens, claim compatibility, role checks
packages/contracts request/response schemas and shared types
packages/config shared tsconfig / biome / build config
packages/shared genuinely cross-cutting utilities only
```

Two deployables. No microservices.

### 2.2 Division of responsibility

**`apps/web` keeps** pages, layouts, RSC, SSR, metadata, forms, navigation and
presentation logic. Oficina Amarela stays an MPA/SSR application; it is not
becoming an SPA because the backend moved.

**`apps/api` takes** route handling, validation, authn/authz, mission/candidate/
editor/ranking/gamification/chat/upload-authorization/admin operations, and all
Cloudflare bindings. Handlers stay thin:
`HTTP → validate → authenticate → authorize → domain service → repository`.

Server Components in `apps/web` reach `apps/api` over a **Service Binding**, not
the public internet. Only browser-facing endpoints are exposed publicly.

### 2.3 Next.js on Workers — verified compatibility

`npx vinext check`, run against this repository on 2026-08-30:

```
Imports:            7/7 supported   (next/headers, next/server, next/cache,
                                     next/image, next/link, next/navigation,
                                     next/font/local)
Config:             1/1 supported   (headers)
Libraries:          1/2 compatible  (tailwindcss ✓; @sentry/nextjs partial —
                                     client works, server needs manual setup)
Project structure:  App Router, 32 pages, 3 layouts, 33 route handlers,
                    loading/error/not-found boundaries, proxy.ts recognised
Blocking issue:     package.json lacks "type": "module" (vinext init adds it)

Overall: 92% compatible — 17 supported, 1 partial, 1 issue
```

Cloudflare now recommends **vinext** (Vite plugin reimplementing the Next.js API
surface, currently beta) as the default path for Next.js on Workers, and
positions **OpenNext** (`@opennextjs/cloudflare`) as the path for maintaining
existing applications. Both are viable here. The decision is **open** and is
tracked as `ARCH-01` on the migration board — Phase 3 must prototype both and
decide on evidence, not preference.

`node:crypto` is used in `lib/invitations-db.ts` (`createHash`, `randomBytes`);
this requires `compatibility_flags = ["nodejs_compat"]`.

### 2.4 D1 as the target database

D1 holds durable relational business state: users, editors, candidates, missions,
offers, submissions, approvals, rankings, goals, gamification, invitations,
permissions, audit data, notification state, business configuration.

D1 does **not** hold high-volume operational telemetry — that goes to Analytics
Engine.

Relevant verified D1 constraints (Cloudflare docs, 2026-08-30):

| Limit | Workers Paid |
|---|---|
| Max database size | 10 GB (hard, cannot be raised) |
| Storage per account | 1 TB |
| Queries per Worker invocation | 1,000 |
| Max bound parameters per query | 100 |
| Max query duration | 30 s |
| Max columns per table | 100 |
| Max row / string / BLOB | 2 MB |
| Concurrency | **single-threaded per database**, queries processed one at a time |

That last row is the design constraint that matters most. Throughput is roughly
`1 / query_duration` — about 1,000 queries/s at 1 ms, about 10 queries/s at
100 ms. Every hot query must be indexed to a `SEARCH ... USING INDEX` plan, and
work that does not need transactional consistency must leave the D1 path
entirely. Billing is by rows *scanned*, not rows returned.

`users` currently has 45 columns — within the 100-column limit, but it mixes
account, editor and candidate concerns and should be reviewed during Phase 9.

### 2.5 Mission claim concurrency

Mission claiming is the highest-risk operation in the product. The target:

```
editor → apps/api → Durable Object  mission:{missionId} → D1
```

The Durable Object serialises claim attempts per mission; D1 persists the result
and keeps the invariant with a conditional write. Database-level invariants are
kept as defence in depth — the Durable Object is an optimisation for contention,
never the only guard. Frontend state is never authoritative.

Partitioning: `mission:{missionId}`, `chat:{missionId}`, `presence:{partition}`.
No global singleton object.

### 2.6 Queues

Moved off the request path: transactional email, broadcast fan-out, notifications,
ranking recalculation, audit processing, analytics forwarding, webhooks, cleanup,
media jobs, delivery-event handling. Every consumer must be idempotent — retries
must not double-send an email or double-score an approval.

### 2.7 Workflows

Reserved for durable multi-step processes that wait on a human: candidate
approval, mission review escalation, inspector approval, delayed tasks. Anything
a single idempotent Queue consumer can do stays a Queue consumer.

### 2.8 Caching model

Every route is classified before it is cached:

| Class | Examples | Strategy |
|---|---|---|
| PUBLIC CACHEABLE | `/`, `/parceiros`, `/termos`, `/privacidade`, `/candidato/[slug]` | edge cache with explicit TTL |
| AUTHENTICATED REUSABLE | `/ranking`, `/aulas`, news, music library | short server-side cache keyed by cycle/version, not by user |
| USER SPECIFIC | `/editor`, `/porta-voz`, `/perfil`, `/agenda` | no shared cache; reduce per-request queries instead |
| STRONGLY CONSISTENT | mission claim, approval, invitation consumption | never cached |
| REALTIME | chat, presence, offer polling | Durable Object / push, not cache |
| NEVER CACHE | auth, admin mutations, presign | explicit no-store |

The target this exists to prevent: 5,000 concurrent users producing 5,000
identical D1 queries for the same public page.

`app/page.tsx` already sets `revalidate = 300`. Twenty other pages set
`dynamic = "force-dynamic"`; each one needs a deliberate re-classification.

### 2.9 Email

An `EmailProvider` interface in `packages/domain` (or `packages/shared`) with two
implementations:

```ts
interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}
```

`CloudflareEmailProvider` (intended primary, on cost grounds) and
`ResendEmailProvider` (retained secondary/fallback for its UI and debugging
tooling). Dispatch goes through a Queue with an idempotency key so a message is
never delivered twice or by both providers. Resend is not removed until
Cloudflare Email Service has been compared on real production deliverability —
SPF, DKIM, DMARC, Gmail, Outlook, bounces, complaints, retries.

### 2.10 Observability

Sentry stays through the early phases. Workers Logs, structured logging with a
request ID, Analytics Engine and Cloudflare metrics are added alongside. The
retain-or-remove decision on Sentry happens in Phase 18 on evidence.

### 2.11 Security

Cloudflare WAF, rate limiting at the edge (replacing per-isolate in-memory
counters, which do not work on Workers), Turnstile on registration/login/recovery,
login throttling, signed R2 uploads with validation, API and admin authorization,
candidate approval checks, secret management via Wrangler secrets, environment
separation, CSP promoted from Report-Only to enforcing, audit logs, and
Cloudflare Access evaluated for `/inspetor`.

---

## 3. Open architecture decisions

| ID | Decision | Status |
|---|---|---|
| `ARCH-01` | vinext vs OpenNext for Next.js on Workers | **open** — decide in Phase 3 on prototype evidence |
| `ARCH-02` | Live database is Neon or Supabase | **open** — confirm against production `DATABASE_URL` |
| `ARCH-03` | Keep PT-BR table/column names in D1, or rename with a mapping layer | **open** — renaming is safer done once, at the D1 cut |
| `ARCH-04` | Whether `users` is split into `users` + `editor_profiles` + `candidate_profiles` | **open** — Phase 9 |
| `ARCH-05` | Offer polling stays HTTP polling or becomes a Durable Object push | **open** — Phase 12; polling cost is quantified in the cost model |
| `ARCH-06` | Cloudflare Stream adoption scope | **open** — Phase 16, only where it beats plain R2 playback |
