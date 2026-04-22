# Implementation Plan

## Phase 1 — Project Setup

- [ ] Initialize monorepo structure (client, server, core packages)
- [ ] Set up Express + TypeScript server
- [ ] Set up React + TypeScript + Vite client
- [ ] Set up Docker with PostgreSQL container for local development
- [ ] Configure Prisma with PostgreSQL

## Phase 2 — Authentication

- [ ] Install and configure Better Auth with database sessions
- [ ] Create User model in Prisma schema (with role: admin | agent)
- [ ] Seed admin user on deployment
- [ ] Implement login page (email + password)
- [ ] Implement logout
- [ ] Protect routes — redirect unauthenticated users to login
- [ ] Add role-based route guards (admin-only routes)

## Phase 3 — User Management (Admin)

- [ ] Create users table in database
- [ ] Build API endpoint: list users (admin only)
- [ ] Build API endpoint: create agent (admin only)
- [ ] Build API endpoint: deactivate/delete agent (admin only)
- [ ] Build users list page (admin only)
- [ ] Build create agent form

## Phase 4 — Tickets (Core)

- [ ] Create Ticket model in Prisma schema (status, category, subject, body, sender email)
- [ ] Build API endpoint: list tickets (with filtering by status and category, sorting)
- [ ] Build API endpoint: get ticket by ID
- [ ] Build API endpoint: update ticket status (open → resolved, admin can close)
- [ ] Build API endpoint: update ticket category (manual override)
- [ ] Build tickets list page with filters and sorting
- [ ] Build ticket detail page

## Phase 5 — Replies

- [ ] Create Reply model in Prisma schema (body, sender type: agent | ai | student)
- [ ] Build API endpoint: create reply on a ticket
- [ ] Display reply thread on ticket detail page
- [ ] Build reply form for agents
- [ ] Send reply email to student via Resend when agent submits a reply

## Phase 6 — Inbound Email (Ticket Creation)

- [ ] Set up inbound email webhook (Resend or Postmark)
- [ ] Build webhook endpoint to receive inbound emails
- [ ] Parse inbound email and create a ticket in the database
- [ ] Handle email replies to existing tickets (reopen resolved ticket if within 48hrs)
- [ ] Secure webhook endpoint with a secret

## Phase 7 — AI Features

- [ ] Set up Anthropic Claude API client
- [ ] Write knowledge base markdown file
- [ ] Implement ticket classification (auto-assign category on ticket creation)
- [ ] Implement AI-suggested reply (generated on ticket creation, agent reviews before sending)
- [ ] Implement AI summary (generate a short summary of the ticket thread)
- [ ] Allow agents to regenerate AI suggested reply on demand

## Phase 8 — Auto-Close (Grace Period)

- [ ] Set up a background job/cron to run periodically
- [ ] Query for tickets in Resolved state older than 48 hours
- [ ] Auto-transition those tickets to Closed

## Phase 9 — Dashboard

- [ ] Build API endpoint: ticket stats (count by status, count by category)
- [ ] Build dashboard page with summary cards (open, resolved, closed counts)
- [ ] Add chart for tickets by category

## Phase 10 — Testing

- [ ] Write unit tests for core business logic (ticket status transitions, email parsing)
- [ ] Write component tests for key UI components (ticket list, ticket detail, reply form)
- [ ] Write E2E tests for critical flows:
  - Login / logout
  - View and filter ticket list
  - View ticket detail and submit a reply
  - Admin creates an agent
  - Inbound email creates a ticket

## Phase 11 — Deployment

- [ ] Write Dockerfile for server
- [ ] Configure Railway project (server + PostgreSQL)
- [ ] Set up environment variables in Railway
- [ ] Configure inbound email webhook URL to point to production
- [ ] Run database migrations on deploy
- [ ] Seed admin user on first deploy
