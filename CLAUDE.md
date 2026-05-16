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
| AI       | Google Gemini via Vercel AI SDK (`@ai-sdk/google`, model `gemini-2.5-flash-lite`) — categorization, suggested replies, summaries |
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
| `server/prisma/seed.ts` | Seeds the admin user (`bun run db:seed` from `server/`) |
| `server/prisma/seed-dev.ts` | Seeds dev data: one agent + 8 sample tickets (`bun prisma/seed-dev.ts` from `server/`) |
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
bun run db:seed                      # seed admin user
bun prisma/seed-dev.ts               # seed dev agent + sample tickets (run after db:seed)

# Tests
bun run test                         # component tests (from client/) or integration tests (from server/)
bun run test:e2e                     # run Playwright tests — resets test DB first
bun run test:e2e:ui                  # Playwright UI mode

# TypeScript type-checking — TS is pinned once at the repo root; run via the workspace's local binary
bun run typecheck                    # from repo root: typechecks client + server + root (e2e/playwright)
bun run typecheck                    # from client/ or server/: typechecks just that workspace
# Do NOT use `bunx tsc` — it resolves a separate (often newer) global TS that doesn't match the project pin.
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

## General approach

This project is developed properly, following best practices. When in doubt, do things the right way — not the quick way. Flag shortcuts or tradeoffs rather than silently taking them.

## Conventions

- **Ports**: server on `3000`, client on `5173`. Vite proxies `/api` → `localhost:3000`.
- **Roles**: `admin` is seeded at deploy time. Agents are created by admins. `role` defaults to `"agent"` — never accept it as user input.
- **Ticket transitions**: `open → resolved` (agent); `resolved → closed` (auto after 96h via the `auto-close-tickets` worker, or admin force-close); admins can reopen `resolved/closed → open`; no skipping `open → closed`. A customer reply on a `resolved` ticket auto-reopens it (`server/src/routes/inbound-email.ts`); a reply on a `closed` ticket spawns a new ticket. On any reopen (auto or admin), if the previous assignee was the AI user, the ticket is unassigned so a human picks it up. Assignment changes on `resolved`/`closed` tickets are rejected with 422 — reopen first.
- **Triaging state**: Tickets in `new` or `processing` are surfaced to agents under a single read-only "Triaging" pill (`client/src/lib/ticket-ui.ts:isTriagingStatus`). They appear in the default list and via `?status=triaging`. While triaging, the reply form is hidden and assignee/category/priority/status selects are disabled — actions unlock once the AI classifier/auto-resolver flips status to `open` or `resolved`.
- **Shared types**: always import `Role`, `TicketStatus`, `TicketCategory`, `TicketPriority`, `SenderType` from `@helpdesk/core`. All are TypeScript string enums — use their values (`Role.admin`, `TicketStatus.open`, `TicketCategory.refund_request`, `TicketPriority.urgent`, `SenderType.agent`) everywhere. Never use raw strings.
- **Validation**: Define Zod schemas in `core/src/schemas.ts`, export from `@helpdesk/core`. On the server, use `firstIssue(result.error)` from `server/src/lib/validation.ts` for 400 responses. On the client, use `standardSchemaResolver(schema)` from `@hookform/resolvers/standard-schema` — not `zodResolver` (incompatible with Zod v4 standalone types like `z.email()`).
- **Error handling**: 4-argument middleware `(err, req, res, next)` at the bottom of `app.ts`.
- **Data fetching**: always use **axios** + **TanStack Query**. `useQuery` for reads, `useMutation` for writes; invalidate the relevant query key in `onSuccess`. Never use `fetch` directly or `useState` + `useEffect` for server state.

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
