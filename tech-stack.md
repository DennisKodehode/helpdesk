## Frontend

- **React + TypeScript + Vite** — fast dev experience, strong ecosystem
- **Tailwind CSS + shadcn/ui** — pre-built accessible components, easy to customize
- **TanStack Query** — server state management (ticket lists, polling)
- **React Router** — client-side routing

## Backend

- **Node.js + Express + TypeScript** — simple, widely understood, easy to extend
- **Prisma** — type-safe ORM with migrations

## Database

- **PostgreSQL** — relational data fits tickets/users/replies well

## Auth

- **Better Auth** — modern auth library with role support and database sessions (sessions stored in PostgreSQL, not JWTs)

## AI

- **Anthropic Claude API** — ticket classification, suggested replies, and summaries
- **Knowledge base markdown file** — used as context for AI responses; simple to start, easy to iterate

## Email

- **Resend** — sending reply emails to students
- **Inbound webhook** (Resend or Postmark) — receiving student emails and creating tickets

## Infrastructure

- **Docker** — containerized for consistent environments
- **Railway** — deployment platform with built-in PostgreSQL support

## Testing

- **Vitest** — unit and component tests
- **Playwright** — end-to-end tests
