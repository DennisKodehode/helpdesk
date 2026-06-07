# Helpdesk

**An AI-powered helpdesk that turns inbound support email into triaged tickets, auto-resolves the confident ones, and helps agents handle the rest — every human send stays the agent's call.**

[![CI](https://github.com/DennisKodehode/helpdesk/actions/workflows/ci.yml/badge.svg)](https://github.com/DennisKodehode/helpdesk/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-all--rights--reserved-lightgrey.svg)](#license)
[![Live demo](https://img.shields.io/badge/demo-helpdesk.tjemsland.dev-7c3aed.svg)](https://helpdesk.tjemsland.dev)

**[Live demo →](https://helpdesk.tjemsland.dev)** · agent credentials available on request · **[2-minute visual tour ↓](#a-guided-tour)**

> Built with React 19, Bun, TypeScript, Prisma, Better Auth, and Google Gemini.

<p align="center">
  <a href="docs/screenshots/polish-reply.gif" target="_blank" rel="noopener"><img src="docs/screenshots/polish-reply.gif" alt="An agent writes a rough draft, clicks Polish with AI, and the AI returns a fact-checked rewrite with a confidence score and cited knowledge-base sources; the agent refines it with a one-line note and sends." width="860"></a>
</p>

<p align="center"><em>Write a rough draft, then let the AI <strong>Polish</strong> it — fact-checking against the knowledge base (your team's curated answers) and showing a confidence score — before you send. The agent always owns the send.</em></p>

---

## What it is

A small support team spends most of its day on repetitive email. The obvious questions should answer themselves; humans should handle the rest. Helpdesk does exactly that: inbound support email becomes tickets, Google Gemini sorts and prioritizes every one automatically, resolves the ones it's confident about, and agents work the rest with the AI alongside.

Day to day there are two kinds of user — **agents** work a queue, **admins** also own the roster and the rules everything runs on (there's a privileged global-admin singleton on top — see the admin tour below). The rule throughout: **the AI does the busywork, but a human always approves anything that goes out** — agents send every reply, admins approve every published answer. It's single-tenant by design: one team, one product, not a multi-customer SaaS.

The rest of this README has three parts — a non-technical **guided tour**, a technical **how it works**, and a list of **known limitations**.

---

## A guided tour

### The queue arrives already triaged

<p align="center"><a href="docs/screenshots/03-tickets.png" target="_blank" rel="noopener"><img src="docs/screenshots/03-tickets.png" alt="The ticket queue table with category chips, priority, SLA badges, a filter bar, and a search box" width="860"></a></p>

This is the triage step — sorting and prioritizing every incoming email automatically. When a message lands, Gemini classifies it within seconds, assigning **both** a category (general / technical / refund / billing / feature request) and a priority (low → urgent) in one call. Every row then carries a category, a priority, and a live **SLA badge** (how much time is left before the response/resolution deadline). You can filter by status, category, priority, assignee, SLA state, or quick-view presets, and search by sender name, email, or subject.

<p align="center"><a href="docs/screenshots/filters-category-open.png" target="_blank" rel="noopener"><img src="docs/screenshots/filters-category-open.png" alt="The queue filter bar expanded, showing category options" width="760"></a></p>

One detail worth flagging: **SLA state is computed live on every request** — never a stored column — so the "Breached only" filter and the badge can never drift apart. While a ticket is still being classified its category cell shows a violet spinning **"Classifying"** chip, and the internal `new`/`processing` states collapse into one read-only **"Triaging"** pill so agents never act on a half-processed ticket.

### A ticket the AI handled end to end

<p align="center"><a href="docs/screenshots/04-ticket-detail.png" target="_blank" rel="noopener"><img src="docs/screenshots/04-ticket-detail.png" alt="A ticket detail view showing an AI auto-reply with a violet sparkle avatar and an activity feed entry reading AI auto-resolved" width="860"></a></p>

On a confident knowledge-base match, the AI drafts a grounded reply, **sends it**, marks the ticket resolved as itself, and logs "AI auto-resolved the ticket" — no human paged. Otherwise the ticket routes to a person. (Auto-resolve only fires when every gate passes: the feature is on, the model chose to resolve, confidence clears the admin-set threshold, and the resolution gates are met. The concurrency that makes this possible is in [How it works](#how-it-works).)

### Working a ticket, with the AI alongside

The feature shown in the GIF above is **Polish**. The agent writes their own draft, clicks **Polish with AI**, and the AI reviews it against the category-filtered knowledge base — returning a card with a **confidence score**, **cited KB sources**, and a **one-line change summary**. The agent can use it, edit it, or refine it with a note; it **never auto-overwrites** the textarea. The split is deliberate: the agent's *decision* stands, the KB only corrects *facts* (policy windows, steps, links, numbers). Citation indexes are validated server-side, so a hallucinated source can never reach the agent.

<p align="center"><a href="docs/screenshots/ai-internal-note.png" target="_blank" rel="noopener"><img src="docs/screenshots/ai-internal-note.png" alt="The reply composer with the Internal note tab active, shown in an amber treatment distinct from the customer-reply tab" width="700"></a></p>

<p align="center"><em>Internal notes sit on a separate amber tab — visible to other agents, never sent to the customer.</em></p>

### A knowledge base that grows itself

<p align="center"><a href="docs/screenshots/10-knowledge-base.png" target="_blank" rel="noopener"><img src="docs/screenshots/10-knowledge-base.png" alt="The Knowledge base Articles tab listing structured articles with category, status, and source, plus a Suggestions tab with a pending-count badge" width="860"></a></p>

The knowledge base is **admin-curated structured articles** — not a wiki the AI edits. New content arrives two ways: an agent can file **"Suggest for KB"** on a resolved ticket (one suggestion per ticket), and a daily clustering job proposes articles from recurring, uncovered topics. Nothing publishes on its own.

<table>
<tr>
<td><a href="docs/screenshots/flow-kb-3-queue.png" target="_blank" rel="noopener"><img src="docs/screenshots/flow-kb-3-queue.png" width="420" alt="The KB suggestion review queue with a pending AI-drafted suggestion and a Review action"></a></td>
<td><a href="docs/screenshots/modal-kb-approve.png" target="_blank" rel="noopener"><img src="docs/screenshots/modal-kb-approve.png" width="420" alt="The approve dialog with editable title, question, and answer fields and an Approve and publish button"></a></td>
</tr>
</table>

<p align="center"><em>A suggestion lands in the review queue (left); an admin edits and approves it (right). Admin approval is the security boundary — suggestion drafts are grounded in attacker-controllable ticket text, so a human gate is mandatory before anything reaches the AI's grounding corpus.</em></p>

### Your own work

<table>
<tr>
<td><a href="docs/screenshots/06-my-tickets.png" target="_blank" rel="noopener"><img src="docs/screenshots/06-my-tickets.png" width="420" alt="A personal queue split into working on and closed tickets"></a></td>
<td><a href="docs/screenshots/07-my-stats.png" target="_blank" rel="noopener"><img src="docs/screenshots/07-my-stats.png" width="420" alt="A personal stats page showing open tickets, resolved over 30 days and lifetime, average resolution and first-reply times, and reply counts"></a></td>
</tr>
</table>

<p align="center"><em>Each agent gets a personal queue and a stats page — throughput credits the current assignee; reply counts follow authorship and survive reassignment.</em></p>

### The dashboard everyone lands on

<p align="center"><a href="docs/screenshots/02-dashboard.png" target="_blank" rel="noopener"><img src="docs/screenshots/02-dashboard.png" alt="The dashboard with open, triaging, breached, and unassigned counts, an AI-activity card, a recent-activity feed, tickets-by-category, a needs-attention list, and two SLA-compliance gauges" width="860"></a></p>

Signing in drops you on a workspace-wide dashboard — the same live view for agents and admins: open / triaging / breached / unassigned counts, an AI-activity card, a recent-activity feed, tickets by category, a highest-priority needs-attention list, and first-response / resolution SLA-compliance gauges.

### How customers experience it

Customers never log in — they just email and reply, and they never see categories, priorities, or SLAs. To them it's normal email; some replies just happen to be AI-drafted and grounded in the team's KB. A reply on a **resolved** ticket auto-reopens it (and, if the AI was the assignee, unassigns it so a human picks it up). A reply on a **closed** ticket starts a fresh ticket. Auto-responders and bounce messages are detected by their headers and dropped before they ever become a ticket.

<details>
<summary><h3>🔎 The admin tour — roster, workflow rules &amp; the activity log&nbsp; <sub>(click to expand)</sub></h3></summary>

### Managing the roster

<table>
<tr>
<td><a href="docs/screenshots/05-agents.png" target="_blank" rel="noopener"><img src="docs/screenshots/05-agents.png" width="420" alt="The Agents roster table showing role, status, open assignments, resolved count, average resolution, and last-active per teammate"></a></td>
<td><a href="docs/screenshots/modal-invite-agent.png" target="_blank" rel="noopener"><img src="docs/screenshots/modal-invite-agent.png" width="420" alt="The invite dialog where an admin enters a new teammate's name, email, and role"></a></td>
</tr>
</table>

<p align="center"><em>Manage the roster (left) and invite a teammate as agent or admin (right).</em></p>

<p align="center"><a href="docs/screenshots/09-accept-invite.png" target="_blank" rel="noopener"><img src="docs/screenshots/09-accept-invite.png" alt="The accept-invite screen where a new teammate sets their own password from an emailed single-use link" width="700"></a></p>

<p align="center"><em>The invitee sets their own password from a single-use emailed link — nobody is ever handed a password.</em></p>

Inviting creates the user in an **invited** state with no credential and emails a single-use link; they set their own password to activate. Guardrails throughout: you can't remove or deactivate yourself or the last admin, deactivation ends live sessions immediately, and removal voids any pending invite. The role model is **three-tier** — `globalAdmin` / `admin` / `agent`. Only the global admin can manage other admins (invite, promote, demote, edit, deactivate, delete) and can never be edited or removed via the API; a regular admin manages only agents.

### The rules every ticket follows

<table>
<tr>
<td><a href="docs/screenshots/08-workflow-lifecycle.png" target="_blank" rel="noopener"><img src="docs/screenshots/08-workflow-lifecycle.png" width="420" alt="The Workflow Lifecycle rules tab with auto-assign, AI auto-resolve and its confidence threshold, resolve gates, auto-close quiet period, reopen-on-reply, lock-closed, and a knowledge-base growth group"></a></td>
<td><a href="docs/screenshots/08b-workflow-sla.png" target="_blank" rel="noopener"><img src="docs/screenshots/08b-workflow-sla.png" width="420" alt="The Workflow SLA targets tab with per-priority first-response and resolution windows"></a></td>
</tr>
</table>

<p align="center"><em>The lifecycle and the SLA windows aren't hard-coded — admins own both on the Workflow screen.</em></p>

The **Workflow** screen has two tabs. **Lifecycle rules** covers auto-assign (and its strategy), AI auto-resolve and its confidence threshold, resolve gates, the auto-close quiet period, reopen-on-reply, lock-closed, **and** the knowledge-base growth cadence. **SLA targets** sets per-priority first-response and resolution windows. (The single at-risk threshold — flagging a ticket at 75% of its window — is a fixed constant, not a per-priority knob.)

### Operational health at a glance

<p align="center"><a href="docs/screenshots/watchlist.png" target="_blank" rel="noopener"><img src="docs/screenshots/watchlist.png" alt="The Activity page Watchlist strip with five health-signal cards — AI escalation rate, AI hard failures, reassignment churn, reopened under 24h, and priority re-triage — each with a value, threshold state, week-over-week delta, and a sparkline" width="860"></a></p>

The **Activity** page is the global audit log, and it opens with a **Watchlist** of five health signals over a trailing 7 days that flag when something needs attention: how often the AI gives up and hands off to a human (escalation), how often its pipeline hard-fails, how often tickets bounce between agents (churn), how often a "resolved" ticket comes back within a day, and how often priority gets re-triaged — each with a sparkline trend. Click a signal to filter the log below.

<p align="center"><a href="docs/screenshots/11-activity.png" target="_blank" rel="noopener"><img src="docs/screenshots/11-activity.png" alt="The Activity page audit log table, newest-first, filterable by event type, actor, and date range" width="860"></a></p>

<p align="center"><em>Under the hood there are two separate audit tables: a ticket-scoped lifecycle log and an admin/config-mutation log.</em></p>

</details>

---

## How it works

### Tech stack

| Layer | Choice |
| ----- | ------ |
| Runtime | [Bun](https://bun.sh) (workspaces monorepo) |
| Frontend | [React 19](https://react.dev), [Vite](https://vite.dev), TypeScript, [Tailwind CSS](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [TanStack Query](https://tanstack.com/query), [axios](https://axios-http.com), [React Router](https://reactrouter.com) |
| Backend | [Express 5](https://expressjs.com), TypeScript |
| Auth | [Better Auth](https://www.better-auth.com) — database sessions, email + password, role field |
| Database / ORM | [PostgreSQL](https://www.postgresql.org) + [Prisma 7](https://www.prisma.io) |
| AI | [Google Gemini](https://ai.google.dev) (`gemini-2.5-flash-lite`) via the [Vercel AI SDK](https://sdk.vercel.ai) (`@ai-sdk/google`) |
| Email | [Resend](https://resend.com) — outbound replies + inbound webhook |
| Job queue | [pg-boss](https://github.com/timgit/pg-boss) — Postgres-backed (no separate broker) |
| Errors | [Sentry](https://sentry.io) (server + client) |
| Testing | [Vitest](https://vitest.dev) (component + integration), [Playwright](https://playwright.dev) (E2E) |
| Deploy / CI | [Docker](https://www.docker.com) multi-stage → [Railway](https://railway.app); GitHub Actions |

### Architecture — the inbound-email pipeline

In short: an email comes in, gets verified and de-duplicated, becomes a ticket, and two AI jobs (sort + try-to-answer) kick off in parallel.

```mermaid
flowchart LR
    A[Customer email] --> B[Resend webhook]
    B --> C["/api/inbound-email<br/>verify raw-body signature<br/>+ idempotent on resendEmailId"]
    C --> D{{Atomic Prisma transaction}}
    D --> E[Create Ticket + audit event]
    D --> F[Enqueue classify job]
    D --> G[Enqueue auto-resolve job]
    F -. concurrent .-> H[Gemini: category + priority]
    G -. concurrent .-> I[Gemini: KB-grounded resolve / escalate]
    E --> J[Agent queue + SLA timers]
    H --> J
    I --> J
```

A customer email hits the **Resend webhook**, verified against the **raw request body** (re-serializing would break the HMAC) and de-duplicated on `resendEmailId` at three layers (pre-check, unique constraint, and a P2002 catch for the concurrent-delivery race). A single **atomic transaction** then creates the ticket, writes its audit event, processes attachments, and enqueues the classify and auto-resolve jobs on the same transaction — so if any insert fails, the ticket rolls back and Resend retries cleanly. The two AI jobs run **concurrently**, which means auto-resolve may start before the category is set; in that case it grounds on the full published KB as a safe superset rather than a category-filtered slice.

### Monorepo shape

Three Bun workspaces: `core`, `server`, `client`. **`@helpdesk/core` is source-only** — its `package.json` points straight at `./src/index.ts`, so both sides import the *same* TypeScript Zod schemas and string enums. One schema object validates every server input and every client form; there are no raw status/role strings anywhere.

### Design decisions

- **The ticket lifecycle is an explicit state machine.** Five states (`new`, `processing`, `open`, `resolved`, `closed`) with role-specific transition matrices — agents may only do `open → resolved`; admins also close and reopen (`new` leaves only via the AI worker). The UI collapses `new`+`processing` into one read-only "Triaging" pill so users never see internal states.
- **Postgres *is* the queue.** pg-boss runs six queues and three crons directly off `DATABASE_URL`. *Trade-off:* one fewer service to run and monitor, at the cost of the throughput a dedicated broker (Redis/SQS) would give — a deliberate fit for one team's volume.
- **Prompt-injection defense at every call site.** Attacker-controllable text (subjects, bodies, names) is XML-escaped, length-clipped, fenced in explicit tags, and declared **UNTRUSTED** in a SECURITY instruction. Message roles are server-controlled (a customer body can't forge an "Agent:" turn), and KB citation indexes are validated so hallucinated sources are dropped.
- **AI assists, humans gate.** Polish never sends. Auto-resolve only fires behind confidence + workflow + resolution gates. KB publishing requires admin approval, because suggestion drafts are grounded in attacker-controllable ticket text.
- **Atomic transactions everywhere.** A reply commits with its audit event and the email enqueue. Auto-resolve's reply insert and email enqueue are atomic specifically so a pg-boss retry can't trigger a duplicate (paid) AI call.
- **DB-enforced invariants.** A polymorphic `Attachment` is constrained by a raw-SQL `attachment_xor_parent` CHECK (exactly one of Reply/Ticket), and `resendEmailId` is unique — guarantees that don't depend on application code being correct.

> A correction to older docs: swapping AI providers is *not* a one-line change — `google("gemini-2.5-flash-lite")` is hardcoded at six call sites. It's provider-agnostic at the SDK level but not yet centralized behind a single module (see [Roadmap](#roadmap)).

### Engineering practices

The project follows a **Testing Trophy**: static (TypeScript + Zod) → component (Vitest + React Testing Library, axios mocked) → integration (Vitest + supertest against a **real** `helpdesk_test` Postgres) → E2E (Playwright). **GitHub Actions** runs lint (Biome), typecheck, `bun audit`, client + server tests, and an end-to-end Docker build on every PR and push. **Sentry** is wired both sides. Deploy is a multi-stage **Docker** image on **Railway**, with a `/api/health` healthcheck that probes Postgres and pg-boss in parallel and a graceful-shutdown path that drains HTTP then the queue. Every screenshot in this README is generated by a local Playwright harness (`tools/readme-shots/`), so the docs stay reproducible rather than hand-captured.

<details>
<summary><strong>How to navigate this project</strong> (key files)</summary>

| File | Why it matters |
| ---- | -------------- |
| `core/src/schemas.ts` | The shared contract — every Zod schema + inferred type, used by both client and server |
| `server/src/app.ts` | Express app (middleware, routes, error handler); exported without `listen()` so tests import it |
| `server/src/lib/auth.ts` | Better Auth instance, the login gate, and the role additionalField |
| `server/prisma/schema.prisma` | Full data model + the two audit tables |
| `server/src/lib/kb-corpus.ts` | The single KB **retrieval seam** (`getRelevantArticles`) — the one function a pgvector upgrade replaces |
| `server/src/lib/queue.ts` | `setupQueues()` — all six queues + three crons in one place |
| `server/src/routes/inbound-email.ts` | The webhook: verify → dedupe → atomic create + enqueue |
| `client/src/App.tsx` | Route tree: `ProtectedLayout` (auth) → `AdminLayout` (role) |

Per-workspace conventions, gotchas, and deeper notes live in [`CLAUDE.md`](CLAUDE.md) at the repo root and inside `client/` and `server/`.

</details>

---

## Getting started

<details>
<summary><strong>Local setup</strong> (prerequisites + commands)</summary>

**Prerequisites**

- **Bun** `1.3.11` (pinned in `.bun-version`)
- **PostgreSQL** running locally with two databases: `helpdesk` (dev) and `helpdesk_test` (tests/E2E)
- A **Google Gemini** API key (`GOOGLE_GENERATIVE_AI_API_KEY`)
- **Resend** API + webhook keys for email

**Environment**

Copy `server/.env.example → server/.env` and fill in:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Postgres connection string (e.g. `postgresql://postgres:postgres@localhost:5432/helpdesk`) |
| `BETTER_AUTH_SECRET` | Random secret for Better Auth |
| `BETTER_AUTH_URL` | Server URL (`http://localhost:3000`) |
| `CLIENT_URL` | SPA origin for CORS + cookies (`http://localhost:5173`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | Outbound email + inbound webhook verification |
| `WEBHOOK_SECRET` | Inbound webhook shared secret |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Seeded global-admin credentials |

**Run it**

```bash
# from helpdesk/
cp server/.env.example server/.env        # then fill in the values above

cd server
bun run db:migrate                        # create + apply migrations
bun run db:seed                           # admin + AI user + SLA policies + KB articles
bun run db:seed-demo                      # full diverse demo dataset (run after db:seed)

cd ..
bun run dev                               # client (5173) + server (3000)
```

**Quality checks**

```bash
bun run typecheck     # from repo root: client + server + e2e
bun run lint          # Biome
bun run test          # component (client/) or integration (server/)
bun run test:e2e      # Playwright (resets the test DB first)
```

> **Windows/bun note:** `BUN_INSTALL_CACHE_DIR` should point outside OneDrive (the project sets `C:\bun-cache`), and `@prisma/engines` postinstall often fails on the first `bun install` — just run it a second time.

</details>

---

## Known limitations

- **Single-tenant**, one product, one team. No customer portal — customers interact entirely by email.
- **No 2FA/SSO.** Auth is email + password with database-backed sessions on Better Auth defaults (session expiry is Better Auth's default, not custom-configured here). Self-registration is disabled; accounts are invite-only.
- **AI is best-effort and probabilistic.** Auto-resolve fires only on a confident KB match; agents can always override, and Polish never sends on its own.
- **The KB is curated, not crawled.** Retrieval is category-filtered (plus always-included general articles, ordered by hit count, with a full-set fallback when a ticket isn't yet classified) — not vector search. `getRelevantArticles()` is the single seam a pgvector upgrade would replace.
- **No real-time push** — the UI refetches on focus and after mutations rather than streaming. English-only UI. SLA timers have no business-hours awareness. Health-signal thresholds are hard-coded research-grounded placeholders. Reply parsing via [`email-reply-parser`](https://github.com/crisp-oss/email-reply-parser) is heuristic, and there's no full-text search across reply bodies.

## Roadmap

- pgvector-backed semantic KB retrieval (behind the existing `getRelevantArticles` seam)
- centralize the Gemini model id behind a single module so a provider swap is one change
- admin-configurable health-signal thresholds
- real-time updates (websocket/SSE) instead of refetch-on-focus
- finer-grained, per-permission RBAC beyond the three role tiers

---

## License

No license file yet — **all rights reserved** until one is added. If you'd like this released under MIT or Apache-2.0, [open an issue](https://github.com/DennisKodehode/helpdesk/issues).

## Contact

Questions or feedback: [open a GitHub issue](https://github.com/DennisKodehode/helpdesk/issues). The deeper design notes live in [`CLAUDE.md`](CLAUDE.md).