import { Role, TicketPriority, TicketStatus, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import { Router } from "express";
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

  const { fromName, fromEmail, subject, body, status, priority } = req.body ?? {};

  const ticket = await prisma.ticket.create({
    data: {
      fromName: fromName ?? "Alice Customer",
      fromEmail: fromEmail ?? "alice@example.com",
      subject: subject ?? "Test ticket subject",
      body: body ?? "Test ticket body.",
      status: (status as TicketStatus) ?? TicketStatus.open,
      priority: (priority as TicketPriority) ?? TicketPriority.normal,
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

export default router;
