# Client — Helpdesk

## Authentication

### `client/src/lib/auth-client.ts`

`baseURL` reads from `import.meta.env.VITE_API_URL` (set in `client/.env`) — auth requests bypass the Vite proxy and go directly to the server. Exports used across the app: `signIn`, `signOut`, `signUp`, `useSession`.

`useSession()` returns `{ data: session | null, isPending: boolean, error }` — check `isPending` before acting on `data`.

### Route protection pattern

`App.tsx` uses two nested layout components: `ProtectedLayout` (redirects to `/login` if unauthenticated) and `AdminLayout` (redirects to `/` if not admin). New protected routes go inside `ProtectedLayout`; admin-only routes go inside `AdminLayout`.

**Role type cast**: `session.user.role` is not in the Better Auth client types (it's an `additionalField` only typed server-side). Access it with `(session.user as Record<string, unknown>).role` and compare using `Role.admin` / `Role.agent` — never use raw strings.

### Navbar

`Navbar` calls `useSession()` directly — no props needed. It conditionally renders a "Users" nav link when `role === "admin"`.

## shadcn/ui

Installed with the default theme. Style: `base-nova`, base color: `neutral`, CSS variables enabled, Tailwind v4 compatible (`tailwind.config` is empty in `components.json`).

- **Add components**: `npx shadcn@latest add <component>` from `client/` — always `npx`, never `bunx` (bunx has fs-extra compatibility issues)
- **Components land in**: `client/src/components/ui/`
- **`cn()` helper**: `client/src/lib/utils.ts` — use for merging Tailwind classes
- **`@` alias**: resolves to `client/src/` — configured in `vite.config.ts`, `tsconfig.json`, and `tsconfig.app.json`
- **Primitives**: uses `@base-ui/react` as the headless layer (not Radix UI)
- **Theme**: CSS variables in `client/src/index.css`; dark mode via `.dark` class

## Component tests (Vitest + React Testing Library)

Component tests live alongside their page/component files as `*.test.tsx`. The test infrastructure is in `client/src/test/`:

| File | Purpose |
| ---- | ------- |
| `client/src/test/utils.tsx` | `renderWithProviders` (fresh `QueryClient` + `MemoryRouter` per test) + re-exports all of `@testing-library/react` |
| `client/src/test/setup.ts` | Imports `@testing-library/jest-dom/vitest` for DOM matchers |
| `client/vitest.config.ts` | jsdom environment, `@` alias, setup file |

### Writing tests

- Import everything from `../test/utils` — it re-exports `screen`, `waitFor`, `within`, `cleanup`, and `userEvent` so you never need to import directly from `@testing-library/react`.
- Mock axios at the top of every test file:
  ```ts
  vi.mock("axios", () => ({
    default: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
  }));
  ```
- Call `afterEach(cleanup)` explicitly to prevent DOM leaking between tests.
- Use `screen.findByText` (async) for content that appears after a query resolves; use `screen.getByText` (sync) only for content already in the DOM.
- Scope ambiguous queries with `within(screen.getByRole("dialog"))` when the same text appears in both the background page and a dialog.
- Cover: loading state (skeleton), loaded state, empty state, error state, and each user interaction (open dialog, validation, success, server error).
- **Assert on what the user sees, not just on API calls.** After any interaction that changes visible UI state (selecting a dropdown, submitting a form), assert on the rendered output — e.g., `expect(trigger).toHaveTextContent("Open")` — not only that `axios.get` was called with the right params. Mock call assertions alone won't catch bugs where the label map is missing or rendering is broken.

### Running tests

```bash
bun run test           # from client/ — run once
bun run test:watch     # watch mode
```
