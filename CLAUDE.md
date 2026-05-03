# Helpdesk — Project Memory

## What this is

AI-powered ticket management system. Support emails arrive, get classified by Claude, and agents review AI-suggested replies before sending. Admins manage agents; agents manage tickets.

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

## Tech stack

| Layer    | Choice                                                             |
| -------- | ------------------------------------------------------------------ |
| Runtime  | Bun                                                                |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Router |
| Backend  | Express 5, TypeScript                                              |
| Auth     | Better Auth (database sessions, email + password, role field)      |
| ORM      | Prisma + PostgreSQL                                                |
| AI       | Anthropic Claude API (classification, suggested replies, summaries)|
| Email    | Resend (outbound replies + inbound webhook for ticket creation)    |
| Testing  | Vitest (unit/component), Playwright (E2E)                         |
| Deploy   | Railway + Docker                                                   |

## Key files

| File | Purpose |
| ---- | ------- |
| `server/src/index.ts` | Express entry point; mounts Better Auth at `/api/auth/*splat` |
| `server/src/lib/auth.ts` | Better Auth instance (Prisma adapter, email+password, role field) |
| `server/src/middleware/auth-middleware.ts` | `requireAuth`, `requireAdmin`, `requireAdminChain` — session validation and role enforcement |
| `server/prisma/schema.prisma` | Full schema: User, Session, Account, Verification, Ticket, Reply |
| `server/prisma/seed.ts` | Seeds the admin user (run via `bun run db:seed` from `server/`) |
| `client/src/App.tsx` | Route tree: `ProtectedLayout` (auth) → `AdminLayout` (role) |
| `client/src/components/Navbar.tsx` | Reads session directly (no props); shows "Users" link for admins only |
| `client/src/lib/auth-client.ts` | Better Auth React client (signIn, signOut, signUp, useSession) |
| `client/src/pages/UsersPage.tsx` | Admin-only user management page (`/users`) |
| `core/src/types.ts` | Shared enums: Role, TicketStatus, TicketCategory |

## Commands

```bash
# Start everything (client + server)
bun run dev                          # from helpdesk/

# Database
bun run db:migrate                   # run migrations (from server/)
bun run db:push                      # push schema without migration (dev only)
bun run db:generate                  # regenerate Prisma client after schema change
bun run db:studio                    # open Prisma Studio

# E2E tests
bun run test:e2e                     # run Playwright tests (resets test DB first)
bun run test:e2e:ui                  # Playwright UI mode
```

## Environment

Copy `server/.env.example` → `server/.env`. Bun loads `.env` automatically — no dotenv package needed.

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/helpdesk
BETTER_AUTH_SECRET=<random secret>
BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<min 12 chars — seed.ts throws if shorter>
```

PostgreSQL runs locally (not Docker) — no docker-compose. Both `helpdesk` (dev) and `helpdesk_test` (E2E) are databases on the same local instance at `localhost:5432`.

For E2E tests, copy `server/.env.test.example` → `server/.env.test` and `client/.env.example` → `client/.env`.

## Authentication

### Server (`server/src/lib/auth.ts`)

Better Auth is configured with:
- **Prisma adapter** — sessions stored in the database, not JWTs
- **Email + password only** — `disableSignUp: true` (no self-registration; agents are created by admins only)
- **`role` additional field** — `type: "string"`, `defaultValue: "agent"`, `input: false` (never writable from client input)
- **`trustedOrigins`** — set to `CLIENT_URL` env var; required for cross-origin cookie auth

Mounted in `index.ts` via `toNodeHandler(auth)` at `/api/auth/*splat`. CORS is configured with `credentials: true` to allow the session cookie to flow.

### Client (`client/src/lib/auth-client.ts`)

`baseURL` reads from `import.meta.env.VITE_API_URL` (set in `client/.env`) — auth requests bypass the Vite proxy and go directly to the server. Exports used across the app: `signIn`, `signOut`, `signUp`, `useSession`.

`useSession()` returns `{ data: session | null, isPending: boolean, error }` — check `isPending` before acting on `data`.

### Route protection pattern

`App.tsx` uses two nested layout components: `ProtectedLayout` (redirects to `/login` if unauthenticated) and `AdminLayout` (redirects to `/` if not admin). New protected routes go inside `ProtectedLayout`; admin-only routes go inside `AdminLayout`.

**Role type cast**: `session.user.role` is not in the Better Auth client types (it's an `additionalField` only typed server-side). Access it with `(session.user as Record<string, unknown>).role` and compare to `"admin"` / `"agent"`.

### Navbar

`Navbar` calls `useSession()` directly — no props needed. It conditionally renders a "Users" nav link when `role === "admin"`.

### Server-side session validation

Use middleware from `server/src/middleware/auth-middleware.ts`:
- `requireAuth` — validates session cookie, returns 401 if missing, attaches `req.user` / `req.session`
- `requireAdminChain` — composed `[requireAuth, requireAdmin]`; use this for all admin-only routes

## Conventions

- **Ports**: server on `3000`, client on `5173`. Vite proxies `/api` → `localhost:3000`.
- **Auth**: Better Auth handles all `/api/auth/*` routes. Use `useSession()` on the client.
- **Roles**: `admin` is seeded at deploy time. Agents are created by admins. `role` defaults to `"agent"` — never accept it as user input.
- **Ticket transitions**: `open → resolved` (agent); `resolved → closed` (auto after 48h, or admin force-close); no skipping `open → closed`.
- **Shared types**: always import `Role`, `TicketStatus`, `TicketCategory` from `@helpdesk/core`.
- **Error handling**: 4-argument middleware `(err, req, res, next)` at the bottom of `index.ts`.

## shadcn/ui

Installed in `client/` with the default theme. Style: `base-nova`, base color: `neutral`, CSS variables enabled, Tailwind v4 compatible (`tailwind.config` is empty in `components.json`).

- **Add components**: `npx shadcn@latest add <component>` from `client/` — always `npx`, never `bunx` (bunx has fs-extra compatibility issues)
- **Components land in**: `client/src/components/ui/`
- **`cn()` helper**: `client/src/lib/utils.ts` — use for merging Tailwind classes
- **`@` alias**: resolves to `client/src/` — configured in `vite.config.ts`, `tsconfig.json`, and `tsconfig.app.json`
- **Primitives**: uses `@base-ui/react` as the headless layer (not Radix UI)
- **Theme**: CSS variables in `client/src/index.css`; dark mode via `.dark` class

## E2E Tests — always use the playwright-e2e-writer agent

Never write Playwright E2E tests directly. Always delegate to the `playwright-e2e-writer` sub-agent — it has the full test infrastructure context, locator conventions, auth patterns, and quality checklist for this project.

Trigger it after completing a UI feature or when explicitly asked to write E2E tests.

## Documentation — always use context7

Before writing code that touches any library (Express, Prisma, Better Auth, Vite, React, TanStack Query, Resend, Anthropic SDK, Playwright, Vitest, shadcn/ui), **fetch current docs via context7** using the MCP tools:

1. `mcp__context7__resolve-library-id` — resolve the library name to a context7 ID
2. `mcp__context7__query-docs` — query the docs for the specific topic

This ensures code is based on the current API, not stale training data.
