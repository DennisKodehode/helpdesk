# Helpdesk — Project Memory

## What this is

AI-powered ticket management system. Support emails arrive, get classified by Claude, and agents review AI-suggested replies before sending. Admins manage agents; agents manage tickets.

## Monorepo structure

```
helpdesk/
├── client/          @helpdesk/client  — React + Vite + TypeScript
├── server/          @helpdesk/server  — Express + Bun + TypeScript
├── core/            @helpdesk/core    — shared types (Role, TicketStatus, TicketCategory)
├── docker-compose.yml                 — PostgreSQL 16
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
| `server/src/lib/prisma.ts` | Prisma singleton |
| `server/prisma/schema.prisma` | Full schema: User, Session, Account, Verification, Ticket, Reply |
| `client/src/lib/auth-client.ts` | Better Auth React client (signIn, signOut, signUp, useSession) |
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

# Docker
docker compose up -d                 # start PostgreSQL
docker compose down                  # stop PostgreSQL
```

## Environment

Copy `server/.env.example` → `server/.env` and fill in:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/helpdesk
BETTER_AUTH_SECRET=<random secret>
BETTER_AUTH_URL=http://localhost:3000
```

Bun loads `.env` automatically — no dotenv package needed.

## Conventions

- **Ports**: server on `3000`, client on `5173`. Vite proxies `/api` → `localhost:3000`.
- **Auth**: Better Auth handles all `/api/auth/*` routes. Use `useSession()` on the client.
- **Roles**: `admin` is seeded at deploy time. Agents are created by admins. `role` defaults to `"agent"` — never accept it as user input.
- **Ticket transitions**: `open → resolved` (agent); `resolved → closed` (auto after 48h, or admin force-close); no skipping `open → closed`.
- **Shared types**: always import `Role`, `TicketStatus`, `TicketCategory` from `@helpdesk/core`.
- **Error handling**: 4-argument middleware `(err, req, res, next)` at the bottom of `index.ts`.

## Documentation — always use context7

Before writing code that touches any library (Express, Prisma, Better Auth, Vite, React, TanStack Query, Resend, Anthropic SDK, Playwright, Vitest, shadcn/ui), **fetch current docs via context7** using the MCP tools:

1. `mcp__context7__resolve-library-id` — resolve the library name to a context7 ID
2. `mcp__context7__query-docs` — query the docs for the specific topic

This ensures code is based on the current API, not stale training data.
