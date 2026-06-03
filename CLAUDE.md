# Helpdesk — Project Memory

## What this is

AI-powered ticket management system. Support emails arrive, get auto-categorized by Gemini, and agents review AI-suggested replies before sending. Admins manage agents; agents manage tickets.

## Monorepo structure

```
helpdesk/
├── client/          @helpdesk/client  — React + Vite + TypeScript
├── server/          @helpdesk/server  — Express + Bun + TypeScript
├── core/            @helpdesk/core    — shared types (Role, TicketStatus, TicketCategory)
├── e2e/                               — Playwright E2E tests
├── playwright.config.ts               — Playwright config (webServer, globalSetup)
└── package.json                       — workspace root (bun workspaces)
```

Each workspace has its own `CLAUDE.md` with implementation details: `client/CLAUDE.md` (auth client, shadcn/ui, component tests) and `server/CLAUDE.md` (Better Auth config, auth middleware, integration tests).

## Tech stack

| Layer    | Choice                                                             |
| -------- | ------------------------------------------------------------------ |
| Runtime  | Bun                                                                |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, axios, React Router |
| Backend  | Express 5, TypeScript                                              |
| Auth     | Better Auth (database sessions, email + password, role field)      |
| ORM      | Prisma + PostgreSQL                                                |
| AI       | Google Gemini via Vercel AI SDK (`@ai-sdk/google`, model `gemini-2.5-flash-lite`) — auto-categorization, auto-resolution, agent-facing **Suggest reply** (KB draft + confidence/escalate) and **Polish**, summaries. Shared draft logic in `server/src/lib/draft-reply.ts` |
| Email    | Resend (outbound replies + inbound webhook for ticket creation)    |
| Testing  | Vitest (component + integration), Playwright (E2E)                |
| Deploy   | Railway + Docker                                                   |

## Key files

| File | Purpose |
| ---- | ------- |
| `server/src/index.ts` | Entry point — starts the server |
| `server/src/app.ts` | Express app (middleware, routes, error handler) — importable by tests |
| `server/src/lib/auth.ts` | Better Auth instance |
| `server/src/middleware/auth-middleware.ts` | `requireAuth`, `requireAdmin`, `requireAdminChain` |
| `server/prisma/schema.prisma` | Full schema: User, Session, Account, Verification, Ticket, Reply |
| `server/prisma/seed.ts` | Seeds the admin user + AI user + SLA policies (`bun run db:seed` from `server/`) |
| `server/prisma/seed-dev.ts` | Minimal dev data: one agent + sample tickets (`bun prisma/seed-dev.ts`) |
| `server/prisma/seed-demo.ts` | **Full demo dataset** — 8 diverse agents/admins (active/invited/inactive), 22 tickets across every status/category/priority/SLA-state with threads + audit + notifications. Re-runnable (wipes mock data, keeps admin + AI). `bun run db:seed-demo` after `db:seed`. |
| `client/src/App.tsx` | Route tree: `ProtectedLayout` (auth) → `AdminLayout` (role) |
| `client/src/lib/auth-client.ts` | Better Auth React client (signIn, signOut, useSession) |
| `core/src/types.ts` | Shared enums: Role, TicketStatus, TicketCategory, SenderType |
| `core/src/schemas.ts` | Shared Zod schemas: ticket schemas, reply schemas, user schemas, inboundEmailSchema |

## Commands

```bash
# Start everything (client + server)
bun run dev                          # from helpdesk/

# Database (from server/)
bun run db:migrate                   # create + apply a new migration (always use this, never db:push)
bun run db:generate                  # regenerate Prisma client after schema change
bun run db:studio                    # open Prisma Studio
bun run db:seed                      # seed admin user + AI agent user + SLA policies (production-safe; idempotent)
bun run db:seed-demo                  # full diverse demo dataset (re-runnable; wipes mock data, keeps admin + AI). Run after db:seed
bun prisma/seed-dev.ts               # minimal dev data: one agent + sample tickets (run after db:seed)

# Tests
bun run test                         # component tests (from client/) or integration tests (from server/)
bun run test:e2e                     # run Playwright tests — resets test DB first
bun run test:e2e:ui                  # Playwright UI mode

# TypeScript type-checking — TS is pinned once at the repo root; run via the workspace's local binary
bun run typecheck                    # from repo root: typechecks client + server + root (e2e/playwright)
bun run typecheck                    # from client/ or server/: typechecks just that workspace
# Do NOT use `bunx tsc` — it resolves a separate (often newer) global TS that doesn't match the project pin.

# Lint + format (Biome, configured at repo root via biome.json)
bun run lint                         # check formatting + lint rules, exits non-zero on errors
bun run lint:fix                     # apply safe auto-fixes (formatting, imports, etc.)
bun run format                       # write formatter-only changes
```

## Windows / bun notes

**`BUN_INSTALL_CACHE_DIR`** is set permanently to `C:\bun-cache` in the Windows user environment. This prevents bun from using its default cache location which causes silent extraction failures on this machine (empty `dist/` and `cjs/` directories after install). Do not change this.

**`@prisma/engines` postinstall** always fails on the first `bun install` run — just run it a second time.

**Project location**: keep this project at `C:\Users\denni\code\helpdesk` (outside OneDrive). OneDrive evicts files from `node_modules` overnight, breaking bun's hardlink cache.

## Environment

Copy `server/.env.example` → `server/.env`. Bun loads `.env` automatically — no dotenv package needed.

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/helpdesk
BETTER_AUTH_SECRET=<random secret>
BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<min 8 chars>
WEBHOOK_SECRET=<random secret>
```

PostgreSQL runs locally (not Docker). Both `helpdesk` (dev) and `helpdesk_test` (E2E + server tests) are databases on the same local instance at `localhost:5432`.

For E2E tests, copy `server/.env.test.example` → `server/.env.test` and `client/.env.example` → `client/.env`.

## Authentication overview

Better Auth handles all `/api/auth/*` routes via `toNodeHandler(auth)`. Sessions are database-stored (not JWTs). Self-registration is disabled — agents are created by admins only. The `role` field defaults to `"agent"` and is never writable from client input. See `client/CLAUDE.md` and `server/CLAUDE.md` for implementation details.

## Deploy + CI

- **`Dockerfile`** (multi-stage, `oven/bun:1.3.11-slim`) builds the server + bundles the Vite SPA. Express serves `client/dist` in production. Bun's install must use `--linker=hoisted` in the release stage so `core/src/schemas.ts` can resolve workspace deps like `zod`.
- **`.bun-version`** is the single source of truth — Dockerfile and CI both pin from it.
- **`railway.toml`** points Railway at the Dockerfile, sets the healthcheck to `/api/health`, and runs `bunx prisma migrate deploy --config server/prisma.config.ts` via `preDeployCommand` before each release. The `--config` flag is required because Railway runs preDeployCommand from `/app` and Prisma 7 doesn't walk up to find `prisma.config.ts`.
- **`.github/workflows/ci.yml`** runs lint + typecheck + `bun audit --audit-level=high` + client tests + server tests (against a postgres service container with migrations applied) + a Docker build verification on every PR and push to `master`.
- **Local Docker smoke test**: `docker build -t helpdesk . && docker run --rm -p 3001:3000 --env-file server/.env -e NODE_ENV=production -e BETTER_AUTH_URL=http://helpdesk.local:3000 -e CLIENT_URL=http://helpdesk.local:3000 -e DATABASE_URL=postgresql://postgres:<password>@host.docker.internal:5432/helpdesk helpdesk`. The URL overrides bypass env.ts's production refinements (no localhost in `BETTER_AUTH_URL`); `host.docker.internal` reaches the host Postgres from inside the container.

## Production

The app is deployed to Railway at **https://helpdesk.tjemsland.dev**. Demo agent credentials live in a local-only project memory file outside the repo — shared on request, not in the public README.

- **Railway CLI** is already linked locally; `railway ssh` works for one-shot prod operations (e.g. `railway ssh bun server/prisma/seed.ts`). An ed25519 SSH key is registered with Railway and `ssh.railway.com` is in `known_hosts` — no SSH bootstrap needed in future sessions.
- **Resend**: sending domain (DKIM/SPF) + receiving (MX) verified on `tjemsland.dev` (apex). Webhook subscribed to `email.received` + `email.bounced` + `email.complained`, pointing at `https://helpdesk.tjemsland.dev/api/inbound-email`. `RESEND_WEBHOOK_SECRET` synced into Railway env.
- **Smoke-tested in prod**: real email → Resend webhook → ticket created → Gemini classify + auto-resolve → reply email delivered. Full pipeline working.

## General approach

This project is developed properly, following best practices. When in doubt, do things the right way — not the quick way. Flag shortcuts or tradeoffs rather than silently taking them.

## Conventions

- **Ports**: server on `3000`, client on `5173`. Vite proxies `/api` → `localhost:3000`.
- **Roles**: `admin` is seeded at deploy time. Agents are created by admins. `role` defaults to `"agent"` — never accept it as user input.
- **Ticket transitions**: `open → resolved` (agent); `resolved → closed` (auto after the configurable quiet period — `autoCloseDays`, default 7 — via the `auto-close-tickets` worker, or admin force-close); admins can reopen `resolved/closed → open`; no skipping `open → closed`. A customer reply on a `resolved` ticket auto-reopens it (`server/src/routes/inbound-email.ts`); a reply on a `closed` ticket spawns a new ticket. On any reopen (auto or admin), if the previous assignee was the AI user, the ticket is unassigned so a human picks it up. Assignment changes on `resolved`/`closed` tickets are rejected with 422 — reopen first.
- **Workflow settings**: the lifecycle behaviors above (auto-assign on triage exit, AI auto-resolve + confidence threshold, resolve gates `requireCategory`/`requireAssignee`, `autoClose`, `reopenOnReply`, `lockClosed`) are admin-configurable via a singleton `workflow_settings` row, edited on the **Workflow** admin screen (`/workflow`, which also re-houses the SLA-targets UI as a tab; `/sla-policies` redirects there). Read with `getWorkflowSettings()` (`server/src/lib/workflow-settings.ts`) at each enforcement site; auto-assign strategy lives in `server/src/lib/assign-agent.ts`. The GET route is auth-only (agents read it to reflect rules in the ticket UI); PATCH is admin-only. Defaults seeded by `seedWorkflowSettings()`.
- **Triaging state**: Tickets in `new` or `processing` are surfaced to agents under a single read-only "Triaging" pill (`client/src/lib/ticket-ui.ts:isTriagingStatus`). They appear in the default list and via `?status=triaging`. While triaging, the reply form is hidden and assignee/category/priority/status selects are disabled — actions unlock once the AI classifier/auto-resolver flips status to `open` or `resolved`.
- **Shared types**: always import `Role`, `TicketStatus`, `TicketCategory`, `TicketPriority`, `SenderType` from `@helpdesk/core`. All are TypeScript string enums — use their values (`Role.admin`, `TicketStatus.open`, `TicketCategory.refund_request`, `TicketPriority.urgent`, `SenderType.agent`) everywhere. Never use raw strings.
- **Validation**: Define Zod schemas in `core/src/schemas.ts`, export from `@helpdesk/core`. On the server, use `firstIssue(result.error)` from `server/src/lib/validation.ts` for 400 responses. On the client, use `standardSchemaResolver(schema)` from `@hookform/resolvers/standard-schema` — not `zodResolver` (incompatible with Zod v4 standalone types like `z.email()`).
- **Error handling**: 4-argument middleware `(err, req, res, next)` at the bottom of `app.ts`.
- **Data fetching**: always use **axios** + **TanStack Query**. `useQuery` for reads, `useMutation` for writes; invalidate the relevant query key in `onSuccess`. Never use `fetch` directly or `useState` + `useEffect` for server state.

## Per-feature workflow

Non-trivial features (anything more than a typo / single-line fix / rename) follow a five-step rhythm:

1. **Plan in plan mode.** Use `/plan` to draft a focused implementation plan into the plan file. The roadmap at `~/.claude/plans/okay-for-a-helpdesk-ticket-glimmering-finch.md` also gets a `CURRENT FOCUS` section while the item is active, then the row is ~~struck through~~ with a post-ship summary after ship. Surface design questions via `AskUserQuestion` before writing the plan, not as text questions.

2. **Three context7 checkpoints** for any library surface the diff touches: one while writing the plan, one after the plan is written, one pre-commit against the actual diff. Never trust assumed API shapes; never reinvent a wheel an existing project utility already implements (e.g. `formatRelative` in `client/src/lib/ticket-ui.ts`, `firstIssue` in `server/src/lib/validation.ts`, `recordAuditEvent` in `server/src/lib/audit.ts`).

3. **Pre-commit review.** Before staging, scan the full diff against the context7 docs and the project conventions in this file. Note convention adherence, library-surface validity, and any deliberate-but-surprising choices — call them out in the commit message body so future-you can spot the reasoning.

4. **Pause for explicit commit approval.** Never auto-commit. Stage only the files listed in the pre-commit review (no `git add -A`). Push is a *separate* explicit decision — direct pushes to `master` need explicit "push to master" wording per the auto-mode classifier.

5. **After ship.** Update the roadmap: strike the row, append the post-ship summary (what shipped, what surprised, what's deferred), bump the Done counter, remove the `CURRENT FOCUS` section.

## Testing strategy — Testing Trophy model

```
      [E2E — Playwright]             ← fewest; browser + full-stack flows
  [Integration — Vitest + supertest] ← server routes tested in-process
 [Component — Vitest + RTL]          ← most; UI logic in isolation
    [Static — TypeScript/Zod]        ← free; always active
```

**Never tailor tests to pass.** If a test fails, fix the code — never rewrite the test to accommodate broken or inaccessible code. A passing test suite that was bent to fit the implementation provides false confidence. Specifically: never use array indexing (`getAllByRole(...)[0]`) to work around missing accessible labels — add the label to the component instead so the test can query by name.

**Component** (`client/src/**/*.test.tsx`): UI in jsdom, axios mocked. Every new page or component gets these. See `client/CLAUDE.md` for patterns.

**Integration** (`server/src/routes/*.test.ts`): Express app imported directly, supertest, real test DB. Every new route gets these. See `server/CLAUDE.md` for patterns.

**E2E** (`e2e/*.spec.ts`): full browser + live server + real DB. Only for critical full-journey flows. Do not duplicate component test coverage.

| Scenario | Layer |
| --- | --- |
| Component renders correct states | Component |
| Form validation messages | Component |
| Server returns 401 for missing auth | Integration |
| Webhook rejects bad secret | Integration |
| Webhook creates a ticket in DB | Integration |
| User can log in and reach dashboard | E2E |
| RBAC redirect (agent → /users → dashboard) | E2E |
| Admin creates agent who appears in table | E2E |
| Password change enforced across sessions | E2E |
| Deleted agent cannot log in | E2E |

## E2E Tests — always use the playwright-e2e-writer agent

Never write Playwright E2E tests directly. Always delegate to the `playwright-e2e-writer` sub-agent — it has the full test infrastructure context, locator conventions, auth patterns, and quality checklist for this project.

Trigger it after completing a UI feature or when explicitly asked to write E2E tests. The `playwright-e2e-writer` agent writes **Playwright E2E tests only** — not component tests or server integration tests.

## Job queues (pg-boss)

Queue setup (`boss.start()`, `createQueue()`, `work()`) lives in `server/src/index.ts`. With a single queue this is fine — `index.ts` is the right place for startup orchestration.

If a second queue is added, extract all queue setup into `server/src/lib/queue.ts` and call it as a single `await setupQueues(boss)` from `index.ts` to keep startup clean.

## Error handling in fire-and-forget

Never swallow errors silently with `.catch(() => {})`. Always log them:

```ts
someAsyncTask().catch((err) => console.error("someAsyncTask failed:", err));
```

## Sentry error monitoring

Sentry is installed in both workspaces (`@sentry/node` server, `@sentry/react` client).

- **Server DSN**: `SENTRY_DSN` in `server/.env` — Sentry is a no-op when this var is absent or `NODE_ENV=test`
- **Client DSN**: `VITE_SENTRY_DSN` in `client/.env` — Sentry is a no-op when absent
- Server init lives in `server/src/instrument.ts`, imported as the first line of `server/src/index.ts`
- Express error capture: `Sentry.setupExpressErrorHandler(app)` in `app.ts`, placed before the custom error handler
- Client init lives in `client/src/lib/sentry.ts`, imported in `client/src/main.tsx`
- Client: `Sentry.ErrorBoundary` wraps the root in `client/src/main.tsx`
- Performance tracing is **off** (`tracesSampleRate: 0`) to stay within the free tier (5K errors/month)

## Documentation — always use context7

Before writing code that touches any library (Express, Prisma, Better Auth, Vite, React, TanStack Query, Resend, Vercel AI SDK / `@ai-sdk/google`, Playwright, Vitest, shadcn/ui), **fetch current docs via context7**:

1. `mcp__context7__resolve-library-id` — resolve the library name to a context7 ID
2. `mcp__context7__query-docs` — query the docs for the specific topic
