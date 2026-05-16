import { createUserSchema, Role, updateUserSchema } from "@helpdesk/core";
import { generateId } from "better-auth";
import { Router } from "express";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain } from "../middleware/auth-middleware";

const router = Router();

router.get("/", ...requireAdminChain, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, NOT: { email: "ai@helpdesk.internal" } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

router.post("/", ...requireAdminChain, async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { name, email, password } = result.data;
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing && !existing.deletedAt) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  if (existing?.deletedAt) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { email: `deleted-${existing.id}@deleted.invalid` },
    });
  }
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);
  const id = generateId();
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      role: Role.agent,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
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
  res.status(201).json(user);
});

router.delete("/:id", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  if (id === req.user!.id) {
    res.status(403).json({ error: "Cannot delete your own account" });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === Role.admin) {
    res.status(403).json({ error: "Cannot delete an admin account" });
    return;
  }
  const now = new Date();
  await prisma.ticket.updateMany({
    where: { assignedToId: id },
    data: { assignedToId: null },
  });
  await prisma.user.update({
    where: { id },
    data: { email: `deleted-${id}@deleted.invalid`, deletedAt: now },
  });
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.account.deleteMany({ where: { userId: id } });
  res.status(204).send();
});

router.patch("/:id", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { name, email, password } = result.data;

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing && existing.id !== id) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const now = new Date();
  const updatedUser = await prisma.user.update({
    where: { id },
    data: { name, email, updatedAt: now },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (password && password.trim().length > 0) {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(password.trim());
    await ctx.internalAdapter.updatePassword(id, hashedPassword);
  }

  res.json(updatedUser);
});

export default router;
