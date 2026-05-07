import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";
import { ticketSortSchema, assignTicketSchema, Role } from "@helpdesk/core";
import { firstIssue } from "../lib/validation";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const result = ticketSortSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const { sortBy = "createdAt", sortOrder = "desc", status, category, search, page, pageSize } = result.data;

  const nullableFields = new Set(["category"]);
  const orderBy = nullableFields.has(sortBy)
    ? { [sortBy]: { sort: sortOrder, nulls: "last" as const } }
    : { [sortBy]: sortOrder };

  const trimmed = search?.trim();

  const where: Prisma.TicketWhereInput = {
    ...(status && { status }),
    ...(category && { category }),
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
    assignedToId: true,
    createdAt: true,
  };

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ data, total, page, pageSize });
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
      status: true,
      category: true,
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

  res.json(ticket);
});

router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const result = assignTicketSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (result.data.assignedToId !== null) {
    const user = await prisma.user.findFirst({
      where: { id: result.data.assignedToId, role: Role.agent, deletedAt: null },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: { assignedToId: result.data.assignedToId },
    select: {
      id: true,
      fromName: true,
      fromEmail: true,
      subject: true,
      body: true,
      status: true,
      category: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json(updated);
});

export default router;
