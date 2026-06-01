import { TicketPriority, TicketStatus } from "@helpdesk/core";
import { Router } from "express";
import { env } from "../lib/env";
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

export default router;
