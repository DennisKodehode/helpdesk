import { Role, TicketPriority, TicketStatus, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import { Router } from "express";
import { auth } from "../lib/auth";
import { env } from "../lib/env";
import { createInviteToken, inviteExpiresAt } from "../lib/invite";
import { prisma } from "../lib/prisma";

// Test-only ticket seeding for E2E. Creates a ticket directly via Prisma —
// bypassing the inbound-email webhook + async AI triage + Resend body-fetch —
// so E2E gets a deterministic, immediately-interactive ticket (default status
// `open`, so the detail-page controls aren't locked behind triaging).
//
// Mounted only when NODE_ENV === "test" (see app.ts); the handler also hard
// 404s otherwise as defense in depth, so this can never seed data in prod.
const router = Router();

router.post("/seed-ticket", async (req, res) => {
  if (env.NODE_ENV !== "test") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { fromName, fromEmail, subject, body, status, priority, createdAt } =
    req.body ?? {};

  // `createdAt` may be supplied as an ISO string to backdate the ticket (e.g.
  // to put it into a breached SLA state for dashboard regression tests).
  const createdAtDate = createdAt ? new Date(createdAt) : new Date();

  const ticket = await prisma.ticket.create({
    data: {
      fromName: fromName ?? "Alice Customer",
      fromEmail: fromEmail ?? "alice@example.com",
      subject: subject ?? "Test ticket subject",
      body: body ?? "Test ticket body.",
      status: (status as TicketStatus) ?? TicketStatus.open,
      priority: (priority as TicketPriority) ?? TicketPriority.normal,
      createdAt: createdAtDate,
      updatedAt: createdAtDate,
    },
    select: { id: true, subject: true, fromName: true, fromEmail: true, body: true },
  });

  res.status(201).json(ticket);
});

// Test-only invite seeding for E2E accept-invite flow.
// Creates an invited user + Invitation and returns the RAW token so tests can
// construct the accept-invite URL without touching email infrastructure. The
// raw token is never stored in the DB (only its SHA-256 hash is), so this
// endpoint is the only way to retrieve it deterministically in tests.
//
// Body: { name?, email, role? }
// Response 201: { id, email, rawToken }
router.post("/seed-invite", async (req, res) => {
  if (env.NODE_ENV !== "test") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { name, email, role } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  // Remove any previous soft-deleted user with the same email so repeated
  // test runs starting from a clean DB don't produce 409 conflicts.
  await prisma.user.updateMany({
    where: { email, deletedAt: { not: null } },
    data: { email: `deleted-${generateId()}@deleted.invalid` },
  });

  // Also clean up any non-deleted leftover from a previous test run.
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    await prisma.invitation.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const id = generateId();
  const now = new Date();
  await prisma.user.create({
    data: {
      id,
      name: name ?? "Invited Tester",
      email,
      emailVerified: true,
      role: (role as Role) ?? Role.agent,
      status: UserStatus.invited,
      createdAt: now,
      updatedAt: now,
    },
  });

  const { raw, tokenHash } = createInviteToken();
  await prisma.invitation.create({
    data: { userId: id, tokenHash, expiresAt: inviteExpiresAt(now) },
  });

  res.status(201).json({ id, email, rawToken: raw });
});

// Test-only active-user seeding for E2E flows that need a real credential
// (e.g. password-reset). Creates a fully active agent with a hashed password
// using the same auth context that Better Auth uses at runtime, so the
// credential is accepted by /api/auth/sign-in/email.
//
// Body: { name?, email, password, role? }
// Response 201: { id, email }
router.post("/seed-user", async (req, res) => {
  if (env.NODE_ENV !== "test") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { name, email, password, role } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  // Rename any soft-deleted rows so the unique email index won't conflict.
  await prisma.user.updateMany({
    where: { email, deletedAt: { not: null } },
    data: { email: `deleted-${generateId()}@deleted.invalid` },
  });

  // Clean up any leftover non-deleted user from a previous run.
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    await prisma.verification.deleteMany({
      where: { identifier: { startsWith: `reset-password:` }, value: existing.id },
    });
    await prisma.invitation.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);

  const id = generateId();
  const now = new Date();

  await prisma.user.create({
    data: {
      id,
      name: name ?? "Test User",
      email,
      emailVerified: true,
      role: (role as Role) ?? Role.agent,
      status: UserStatus.active,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.account.create({
    data: {
      id: generateId(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    },
  });

  res.status(201).json({ id, email });
});

// Test-only reset-token lookup for E2E password-reset flow.
// Better Auth emails the token but E2E has no mail server, so we read it
// directly from the `verification` table. The row identifier is stored as
// `reset-password:<rawToken>` — we strip the prefix and return the raw value.
//
// Query: { email } — used to match via the `value` field (user id lookup)
// Response 200: { token }
// Response 404: no pending reset token found
router.get("/get-reset-token", async (req, res) => {
  if (env.NODE_ENV !== "test") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const email = req.query.email as string | undefined;
  if (!email) {
    res.status(400).json({ error: "email query param is required" });
    return;
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Better Auth stores the row as: identifier = "reset-password:<token>",
  // value = userId. Pick the most recently created one (there may be multiple
  // if the user requested several resets).
  const row = await prisma.verification.findFirst({
    where: {
      identifier: { startsWith: "reset-password:" },
      value: user.id,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!row) {
    res.status(404).json({ error: "No pending reset token for this user" });
    return;
  }

  const token = row.identifier.replace(/^reset-password:/, "");
  res.status(200).json({ token });
});

// Test-only user deletion for E2E teardown. Removes all rows belonging to the
// given email (verification, session, account, user) so test runs leave the DB
// clean. No-op (200) if the user doesn't exist.
//
// Body: { email }
// Response 200: { deleted: true } or { deleted: false } (not found)
router.post("/delete-user", async (req, res) => {
  if (env.NODE_ENV !== "test") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    res.status(200).json({ deleted: false });
    return;
  }

  await prisma.verification.deleteMany({
    where: { identifier: { startsWith: "reset-password:" }, value: user.id },
  });
  await prisma.invitation.deleteMany({ where: { userId: user.id } });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  res.status(200).json({ deleted: true });
});

export default router;
