import { Router } from "express";
import { z } from "zod";
import { generateId } from "better-auth";
import { Role } from "@helpdesk/core";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { requireAdminChain } from "../middleware/auth-middleware";

const router = Router();

const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

router.get("/", ...requireAdminChain, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

router.post("/", ...requireAdminChain, async (req, res) => {
  const result = createUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { name, email, password } = result.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);
  const id = generateId();
  const now = new Date();
  const user = await prisma.user.create({
    data: { id, name, email, emailVerified: true, role: Role.agent, createdAt: now, updatedAt: now },
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
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
