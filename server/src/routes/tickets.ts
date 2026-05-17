import { google } from "@ai-sdk/google";
import {
  ADMIN_VALID_TRANSITIONS,
  createReplySchema,
  NotificationType,
  polishReplySchema,
  Role,
  SenderType,
  TicketStatus,
  TRIAGING_FILTER_VALUE,
  TRIAGING_STATUSES,
  ticketSortSchema,
  updateTicketSchema,
  VALID_TRANSITIONS,
} from "@helpdesk/core";
import { generateText } from "ai";
import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { assigneeType, isAiAssigned } from "../lib/ai-user";
import boss from "../lib/boss";
import { prisma } from "../lib/prisma";
import { SEND_REPLY_EMAIL_QUEUE } from "../lib/send-reply-email-job";
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

  const where: Prisma.TicketWhereInput = {
    ...(statusFilter !== undefined && { status: statusFilter }),
    ...(category && { category }),
    ...(priority && { priority }),
    ...(assignee === "unassigned" && { assignedToId: null }),
    ...(assignee === "me" && { assignedToId: req.user!.id }),
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

  const data = rows.map((t) => ({ ...t, assigneeType: assigneeType(t.assignedToId) }));

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
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ ...ticket, assigneeType: assigneeType(ticket.assignedToId) });
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

  const updated = await prisma.ticket.update({
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
    await prisma.notification.create({
      data: {
        userId: nextAssigneeId,
        actorId: req.user!.id,
        type: NotificationType.ticket_assigned,
        ticketId: id,
      },
    });
  }

  res.json({ ...updated, assigneeType: assigneeType(updated.assignedToId) });
});

const REPLY_SELECT = {
  id: true,
  ticketId: true,
  senderType: true,
  body: true,
  bodyHtml: true,
  author: { select: { id: true, name: true } },
  createdAt: true,
} as const;

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

router.post("/:id/replies", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const result = createReplySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const now = new Date();
  const [reply] = await prisma.$transaction([
    prisma.reply.create({
      data: {
        ticketId: id,
        authorId: req.user!.id,
        senderType: SenderType.agent,
        body: result.data.body,
      },
      select: REPLY_SELECT,
    }),
    prisma.ticket.update({
      where: { id },
      data: {
        updatedAt: now,
        ...(!ticket.firstAgentReplyAt && { firstAgentReplyAt: now }),
      },
    }),
  ]);

  await boss.send(SEND_REPLY_EMAIL_QUEUE, {
    to: ticket.fromEmail,
    toName: ticket.fromName,
    subject: ticket.subject,
    replyBody: result.data.body,
    _requestId: String(req.id),
  });

  res.status(201).json(reply);
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
    ...replies.map((r) =>
      r.senderType === "agent"
        ? `Agent (${r.author?.name ?? "Agent"}): ${r.body}`
        : `Customer: ${r.body}`,
    ),
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
