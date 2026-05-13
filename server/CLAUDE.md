# Server — Helpdesk

## Authentication

### `server/src/lib/auth.ts`

> **Version pin**: `better-auth` is pinned to `~1.2.9` in `package.json`. Do not upgrade to 1.6.x — the published package omits `package.json` from the hoisted install, which breaks `better-auth/node` resolution in Vitest/Vite.

Better Auth is configured with:
- **Prisma adapter** — sessions stored in the database, not JWTs
- **Email + password only** — `disableSignUp: true` (no self-registration; agents are created by admins only)
- **`role` additional field** — `type: "string"`, `defaultValue: "agent"`, `input: false` (never writable from client input)
- **`trustedOrigins`** — set to `CLIENT_URL` env var; required for cross-origin cookie auth

Mounted in `app.ts` via `toNodeHandler(auth)` at `/api/auth/*splat`. CORS is configured with `credentials: true` to allow the session cookie to flow.

### Auth middleware (`server/src/middleware/auth-middleware.ts`)

- `requireAuth` — validates session cookie, returns 401 if missing, attaches `req.user` / `req.session`
- `requireAdminChain` — composed `[requireAuth, requireAdmin]`; use this for all admin-only routes

## Database migrations

Always use `bun run db:migrate` (`prisma migrate dev`) for schema changes — never `db push`. After every migration, also apply it to the test database:

```bash
bun run db:migrate                    # dev DB — prompts for a migration name
```

After migrating, replay all migrations on the test DB (get the URL from `server/.env.test`):
```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<exact user consent message>" \
  DATABASE_URL="<test DATABASE_URL>" bunx prisma migrate reset --force
```

> Prisma 7 blocks `migrate reset` when invoked by an AI without an explicit user consent message. Use the user's exact wording as the env var value.

### Preventing migration drift

**Never edit a migration file after it has been applied.** Prisma checksums every file on apply — any post-apply edit causes drift and blocks future `migrate dev` runs, requiring a full database reset to recover.

Rules:
- To change a Postgres function or any custom SQL: create a **new** migration that `DROP`s and re-creates it. Never edit the old file.
- For custom SQL with no Prisma schema change, use `--create-only` to get an empty migration file, fill it in, then apply:
  ```bash
  bunx prisma migrate dev --create-only --name <descriptive_name>
  # edit the generated migration.sql, then:
  bun run db:migrate
  ```
- Never hand-craft migration directory timestamps — let Prisma generate them via the commands above.
- If drift is detected: reset the dev DB (`bunx prisma migrate reset --force` with user consent) and re-seed. Do not use `migrate resolve` to paper over it.

## Integration tests (Vitest + supertest)

Integration tests live colocated with their route file as `*.test.ts`. Write them directly — no sub-agent needed.

### Setup

- Express app is exported from `server/src/app.ts` (no `app.listen()`).
- `server/src/test/setup.ts` loads `server/.env.test` automatically — the test DB is used without any extra config.
- `server/vitest.config.ts` configures the test runner.

### Writing tests

```ts
import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
```

- Use `request(app)` from supertest — no running server needed.
- Seed and clean up test data per-test using `prisma` directly:
  ```ts
  let createdId: number | undefined;
  afterEach(async () => {
    if (createdId !== undefined) {
      await prisma.ticket.delete({ where: { id: createdId } });
      createdId = undefined;
    }
  });
  ```
- Cover: auth guards (401/403), validation rejection (400), success paths (201/200/204), business rule errors (409/404).
- Follow the pattern in `server/src/routes/webhooks.test.ts`.

### Running tests

```bash
bun run test           # from server/ — run once
bun run test:watch     # watch mode
```
