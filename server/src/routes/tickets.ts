import { randomUUID } from "node:crypto";
import { google } from "@ai-sdk/google";
import {
  ADMIN_VALID_TRANSITIONS,
  ATTACHMENT_MIME_ALLOWLIST,
  AuditEventType,
  computeSlaState,
  createReplySchema,
  NotificationType,
  polishReplySchema,
  Role,
  SenderType,
  type TicketPriority,
  TicketStatus,
  TicketView,
  TRIAGING_FILTER_VALUE,
  TRIAGING_STATUSES,
  ticketSortSchema,
  UNCATEGORIZED_FILTER_VALUE,
  updateTicketSchema,
  VALID_TRANSITIONS,
} from "@helpdesk/core";
import { generateText } from "ai";
import { Router } from "express";
import { fromPrisma } from "pg-boss";
import type { Prisma } from "../generated/prisma/client";
import { assigneeType, isAiAssigned } from "../lib/ai-user";
import { recordAuditEvent } from "../lib/audit";
import boss from "../lib/boss";
import { handleMulterError, upload } from "../lib/multipart";
import { prisma } from "../lib/prisma";
import { SEND_REPLY_EMAIL_QUEUE } from "../lib/send-reply-email-job";
import { safeFilename, storage } from "../lib/storage";
import { firstIssue } from "../lib/validation";
import { requireAuth } from "../middleware/auth-middleware";
import { aiEndpointLimiter } from "../middleware/rate-limit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const result = ticketSortSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const {
    sortBy = "createdAt",
    sortOrder = "desc",
    status,
    category,
    priority,
    assignee,
    search,
    breachedOnly,
    slaState,
    view,
    page,
    pageSize,
  } = result.data;

  const nullableFields = new Set(["category"]);
  const orderBy = nullableFields.has(sortBy)
    ? { [sortBy]: { sort: sortOrder, nulls: "last" as const } }
    : { [sortBy]: sortOrder };

  const trimmed = search?.trim();

  const statusFilter: Prisma.TicketWhereInput["status"] =
    status === TRIAGING_FILTER_VALUE
      ? { in: TRIAGING_STATUSES }
      : status
        ? status
        : undefined;

  // `view` is an exclusive preset: when set, it composes the base WHERE
  // and the per-field filters (status/category/priority/assignee/
  // breachedOnly) are ignored. The client also clears them on chip click,
  // but the server-side gate is the source of truth.
  const viewWhere: Prisma.TicketWhereInput | null =
    view === TicketView.unassigned
      ? { assignedToId: null }
      : view === TicketView.triage
        ? { status: { in: TRIAGING_STATUSES } }
        : view === TicketView.awaiting_customer
          ? { status: TicketStatus.open, lastReplySenderType: SenderType.agent }
          : null;

  const categoryFilter: Prisma.TicketWhereInput["category"] =
    category === UNCATEGORIZED_FILTER_VALUE ? null : category ? category : undefined;

  // slaState filtering needs the real-time computed state (at_risk fires
  // at >=75% of the policy window, ok is the residual). There's no
  // denormalized column for these, so mirror the /api/stats/sla-health
  // pattern: fetch active tickets + policies, compute states in JS, then
  // narrow the main query by `id: { in: ... }`. Bounded by active-ticket
  // count (O(few hundred) at portfolio scale); skip when slaState is not
  // set so the cost only lands on requests that asked for it.
  let slaStateIdFilter: number[] | null = null;
  if (slaState !== undefined && viewWhere === null) {
    const [activeTickets, policies] = await Promise.all([
      prisma.ticket.findMany({
        where: {
          status: { in: [TicketStatus.new, TicketStatus.processing, TicketStatus.open] },
        },
        select: {
          id: true,
          priority: true,
          status: true,
          createdAt: true,
          firstAgentReplyAt: true,
          resolvedAt: true,
        },
      }),
      prisma.slaPolicy.findMany(),
    ]);

    const policyMap = new Map<
      string,
      { firstResponseMinutes: number | null; resolutionMinutes: number | null }
    >(
      policies.map((p) => [
        p.priority,
        {
          firstResponseMinutes: p.firstResponseMinutes,
          resolutionMinutes: p.resolutionMinutes,
        },
      ]),
    );

    slaStateIdFilter = activeTickets
      .filter((t) => {
        const computed = computeSlaState(
          {
            createdAt: t.createdAt.toISOString(),
            firstAgentReplyAt: t.firstAgentReplyAt?.toISOString() ?? null,
            resolvedAt: t.resolvedAt?.toISOString() ?? null,
            priority: t.priority as TicketPriority,
            status: t.status as TicketStatus,
          },
          policyMap.get(t.priority),
        );
        return computed.state === slaState;
      })
      .map((t) => t.id);
  }

  const baseWhere: Prisma.TicketWhereInput =
    viewWhere !== null
      ? viewWhere
      : {
          ...(statusFilter !== undefined && { status: statusFilter }),
          ...(categoryFilter !== undefined && { category: categoryFilter }),
          ...(priority && { priority }),
          ...(assignee === "unassigned" && { assignedToId: null }),
          ...(assignee === "me" && { assignedToId: req.user!.id }),
          ...(breachedOnly && {
            notifications: { some: { type: NotificationType.sla_breach_warning } },
          }),
          ...(slaStateIdFilter !== null && { id: { in: slaStateIdFilter } }),
        };

  const where: Prisma.TicketWhereInput = {
    ...baseWhere,
    ...(trimmed && {
      OR: [
        { subject: { contains: trimmed, mode: "insensitive" } },
        { fromName: { contains: trimmed, mode: "insensitive" } },
        { fromEmail: { contains: trimmed, mode: "insensitive" } },
      ],
    }),
  };

  const select = {
    id: true,
    fromName: true,
    fromEmail: true,
    subject: true,
    status: true,
    category: true,
    priority: true,
    assignedToId: true,
    createdAt: true,
    firstAgentReplyAt: true,
    resolvedAt: true,
  };

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    }),
    prisma.ticket.count({ where }),
  ]);

  const fromEmails = [...new Set(rows.map((r) => r.fromEmail.toLowerCase()))];
  const suppressed = fromEmails.length
    ? new Set(
        (
          await prisma.emailSuppression.findMany({
            where: { email: { in: fromEmails } },
            select: { email: true },
          })
        ).map((s) => s.email),
      )
    : new Set<string>();

  const data = rows.map((t) => ({
    ...t,
    assigneeType: assigneeType(t.assignedToId),
    isSuppressed: suppressed.has(t.fromEmail.toLowerCase()),
  }));

  res.json({ data, total, page, pageSize });
});

router.get("/my-open-count", requireAuth, async (req, res) => {
  const count = await prisma.ticket.count({
    where: { assignedToId: req.user!.id, status: TicketStatus.open },
  });
  res.json({ count });
});

router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      fromName: true,
      fromEmail: true,
      subject: true,
      body: true,
      bodyHtml: true,
      status: true,
      category: true,
      priority: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      attachments: {
        select: ATTACHMENT_SELECT,
        orderBy: { createdAt: "asc" },
      },
      createdAt: true,
      updatedAt: true,
      firstAgentReplyAt: true,
      resolvedAt: true,
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const suppression = await prisma.emailSuppression.findUnique({
    where: { email: ticket.fromEmail.toLowerCase() },
    select: { reason: true },
  });

  res.json({
    ...ticket,
    assigneeType: assigneeType(ticket.assignedToId),
    isSuppressed: suppression !== null,
  });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const result = updateTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const isTerminal =
    ticket.status === TicketStatus.resolved || ticket.status === TicketStatus.closed;
  if (result.data.assignedToId !== undefined && isTerminal) {
    res
      .status(422)
      .json({ error: "Cannot reassign a resolved or closed ticket — reopen it first" });
    return;
  }

  if (result.data.assignedToId !== undefined && result.data.assignedToId !== null) {
    const user = await prisma.user.findFirst({
      where: { id: result.data.assignedToId, role: Role.agent, deletedAt: null },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
  }

  let reopenUnassigns = false;
  if (result.data.status !== undefined) {
    const newStatus = result.data.status;
    const isUserAdmin = req.user!.role === Role.admin;
    const transitions = isUserAdmin ? ADMIN_VALID_TRANSITIONS : VALID_TRANSITIONS;
    const validNext = transitions[ticket.status as TicketStatus];
    if (!validNext.includes(newStatus)) {
      if (newStatus === TicketStatus.closed) {
        res.status(403).json({ error: "Only admins can close tickets" });
      } else {
        res
          .status(422)
          .json({ error: `Invalid status transition: ${ticket.status} → ${newStatus}` });
      }
      return;
    }

    if (
      newStatus === TicketStatus.open &&
      isTerminal &&
      isAiAssigned(ticket.assignedToId)
    ) {
      reopenUnassigns = true;
    }
  }

  const previousAssigneeId = ticket.assignedToId;
  const nextAssigneeId =
    result.data.assignedToId !== undefined
      ? result.data.assignedToId
      : reopenUnassigns
        ? null
        : previousAssigneeId;
  const shouldNotifyAssignment =
    nextAssigneeId !== null &&
    nextAssigneeId !== previousAssigneeId &&
    nextAssigneeId !== req.user!.id &&
    !isAiAssigned(nextAssigneeId);

  // One transaction: audit inserts + ticket update + assignment notification.
  // If any audit insert fails, the change rolls back — changes never persist
  // without their audit row.
  const updated = await prisma.$transaction(async (tx) => {
    const actorId = req.user!.id;

    if (result.data.status !== undefined && result.data.status !== ticket.status) {
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId,
        type: AuditEventType.status_changed,
        data: { from: ticket.status, to: result.data.status },
      });
    }

    if (
      result.data.assignedToId !== undefined &&
      result.data.assignedToId !== ticket.assignedToId
    ) {
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId,
        type: AuditEventType.assignee_changed,
        data: { from: ticket.assignedToId, to: result.data.assignedToId },
      });
    }

    if (reopenUnassigns) {
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId,
        type: AuditEventType.assignee_changed,
        data: { from: ticket.assignedToId, to: null, reopenUnassigned: true },
      });
    }

    if (result.data.category !== undefined && result.data.category !== ticket.category) {
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId,
        type: AuditEventType.category_changed,
        data: { from: ticket.category, to: result.data.category },
      });
    }

    if (result.data.priority !== undefined && result.data.priority !== ticket.priority) {
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId,
        type: AuditEventType.priority_changed,
        data: { from: ticket.priority, to: result.data.priority },
      });
    }

    const next = await tx.ticket.update({
      where: { id },
      data: {
        ...(result.data.assignedToId !== undefined && {
          assignedToId: result.data.assignedToId,
        }),
        ...(reopenUnassigns && { assignedToId: null }),
        ...(result.data.status !== undefined && { status: result.data.status }),
        ...(result.data.status === TicketStatus.resolved &&
          !ticket.resolvedAt && { resolvedAt: new Date() }),
        ...(result.data.category !== undefined && { category: result.data.category }),
        ...(result.data.priority !== undefined && { priority: result.data.priority }),
      },
      select: {
        id: true,
        fromName: true,
        fromEmail: true,
        subject: true,
        body: true,
        bodyHtml: true,
        status: true,
        category: true,
        priority: true,
        assignedToId: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (shouldNotifyAssignment && nextAssigneeId) {
      await tx.notification.create({
        data: {
          userId: nextAssigneeId,
          actorId,
          type: NotificationType.ticket_assigned,
          ticketId: id,
        },
      });
    }

    return next;
  });

  res.json({ ...updated, assigneeType: assigneeType(updated.assignedToId) });
});

const ATTACHMENT_SELECT = {
  id: true,
  filename: true,
  contentType: true,
  size: true,
  createdAt: true,
} as const;

const REPLY_SELECT = {
  id: true,
  ticketId: true,
  senderType: true,
  body: true,
  bodyHtml: true,
  author: { select: { id: true, name: true } },
  attachments: {
    select: ATTACHMENT_SELECT,
    orderBy: { createdAt: "asc" },
  },
  createdAt: true,
} as const satisfies Prisma.ReplySelect;

router.get("/:id/replies", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.reply.findMany({
    where: { ticketId: id },
    select: REPLY_SELECT,
    orderBy: { createdAt: "asc" },
  });

  res.json(replies);
});

router.post(
  "/:id/replies",
  requireAuth,
  // Always-mount multer: it's a no-op when Content-Type isn't
  // multipart/form-data, so JSON requests still go through the
  // express.json()-populated req.body path unchanged.
  (req, res, next) => {
    upload.array("files", 5)(req, res, (err) => {
      if (handleMulterError(err, res)) return;
      if (err) return next(err);
      next();
    });
  },
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid ticket ID" });
      return;
    }

    // Multipart text fields arrive as strings from busboy/multer; coerce
    // isInternal back to a boolean before Zod parsing so the shared schema
    // can stay typed `z.boolean()`.
    const rawBody = { ...req.body } as Record<string, unknown>;
    if (typeof rawBody.isInternal === "string") {
      rawBody.isInternal = rawBody.isInternal === "true";
    }
    const result = createReplySchema.safeParse(rawBody);
    if (!result.success) {
      res.status(400).json({ error: firstIssue(result.error) });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    for (const f of files) {
      if (!ATTACHMENT_MIME_ALLOWLIST.includes(f.mimetype)) {
        res.status(400).json({ error: `Unsupported file type: ${f.mimetype}` });
        return;
      }
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const now = new Date();
    const { body, isInternal } = result.data;
    // Atomic: reply create + audit + ticket update + attachment writes +
    // email-send enqueue all commit together via pg-boss's fromPrisma
    // adapter. If any step fails (including a storage put), the whole
    // transaction rolls back — no orphan reply, no orphan Attachment rows,
    // no duplicate email. Internal notes skip the email enqueue and the
    // firstAgentReplyAt write since they're not customer-facing.
    const reply = await prisma.$transaction(async (tx) => {
      const created = await tx.reply.create({
        data: {
          ticketId: id,
          authorId: req.user!.id,
          senderType: isInternal ? SenderType.internal_note : SenderType.agent,
          body,
        },
        select: { id: true },
      });
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId: req.user!.id,
        type: AuditEventType.reply_added,
        data: {
          replyId: created.id,
          senderType: isInternal ? SenderType.internal_note : SenderType.agent,
        },
      });
      await tx.ticket.update({
        where: { id },
        data: {
          updatedAt: now,
          ...(!isInternal && !ticket.firstAgentReplyAt && { firstAgentReplyAt: now }),
          ...(!isInternal && { lastReplySenderType: SenderType.agent }),
        },
      });
      for (const file of files) {
        const storageKey = `attachments/${created.id}/${randomUUID()}-${safeFilename(file.originalname)}`;
        await storage.put(storageKey, file.buffer, file.mimetype);
        await tx.attachment.create({
          data: {
            replyId: created.id,
            filename: file.originalname,
            contentType: file.mimetype,
            size: file.size,
            storageKey,
          },
        });
      }
      if (!isInternal) {
        await boss.send(
          SEND_REPLY_EMAIL_QUEUE,
          {
            to: ticket.fromEmail,
            toName: ticket.fromName,
            subject: ticket.subject,
            replyBody: body,
            replyId: created.id,
            _requestId: String(req.id),
          },
          { db: fromPrisma(tx) },
        );
      }
      // Re-fetch with REPLY_SELECT so the response includes attachments + author
      return tx.reply.findUniqueOrThrow({
        where: { id: created.id },
        select: REPLY_SELECT,
      });
    });

    res.status(201).json(reply);
  },
);

router.get("/:id/audit-events", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const events = await prisma.auditEvent.findMany({
    where: { ticketId: id },
    select: {
      id: true,
      type: true,
      data: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(events);
});

router.post("/:id/summarize", requireAuth, aiEndpointLimiter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { fromName: true, subject: true, body: true },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.reply.findMany({
    where: { ticketId: id },
    select: { senderType: true, body: true, author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const conversation = [
    `Customer (${ticket.fromName}): ${ticket.body}`,
    ...replies.map((r) => {
      if (r.senderType === SenderType.agent) {
        return `Agent (${r.author?.name ?? "Agent"}): ${r.body}`;
      }
      if (r.senderType === SenderType.internal_note) {
        return `Internal note (${r.author?.name ?? "Agent"}): ${r.body}`;
      }
      return `Customer: ${r.body}`;
    }),
  ].join("\n\n");

  const prompt = [
    "You are a customer support assistant. Summarize the following support ticket conversation in 2–4 sentences. " +
      "Cover: what the customer's issue is, what has been done or offered so far, and the current status. Be concise and factual.",
    `Subject: ${ticket.subject}`,
    `Conversation:\n${conversation}`,
  ].join("\n\n");

  const { text } = await generateText({
    model: google("gemini-2.5-flash-lite"),
    prompt,
    timeout: 30_000,
  });

  res.json({ summary: text });
});

router.post("/:id/polish-reply", requireAuth, aiEndpointLimiter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const result = polishReplySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { fromName: true, subject: true, body: true },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const prompt = [
    "You are a professional customer support agent. " +
      "Expand the agent's draft reply into a complete, well-structured customer support email. " +
      "The customer's message is provided for context only — the agent's draft is the sole authority on what to say. " +
      "Do not contradict, override, or add substance from the customer's message that the agent did not include. " +
      "Match the tone to the draft (if it declines, be empathetic but firm). " +
      "Include a greeting using the customer's name, the polished message, and a professional sign-off signed with the agent's name. " +
      "Return only the final email with no explanation.",
    `Customer name: ${ticket.fromName.split(" ")[0]}`,
    `Subject: ${ticket.subject}`,
    `Customer's message (context only):\n${ticket.body}`,
    `Agent's name: ${req.user!.name}`,
    `Agent's draft (this is what to say — do not change its meaning):\n${result.data.body}`,
    ...(result.data.refinementNote
      ? [
          "The agent reviewed the polished reply and provided this feedback: " +
            `"${result.data.refinementNote}"\n` +
            "Revise the reply taking this feedback into account while preserving the original intent.",
        ]
      : []),
  ].join("\n\n");

  const { text } = await generateText({
    model: google("gemini-2.5-flash-lite"),
    prompt,
    timeout: 30_000,
  });

  res.json({ body: text });
});

export default router;
