import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { generateId } from "better-auth";
import { auth } from "./lib/auth";
import { prisma } from "./lib/prisma";
import { requireAdminChain } from "./middleware/auth-middleware";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }) as RequestHandler);
app.use(express.json());

// Better Auth handles all /api/auth/* routes
app.all("/api/auth/*splat", toNodeHandler(auth));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/users", ...requireAdminChain, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

app.post("/api/users", ...requireAdminChain, async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };
  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }
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
    data: { id, name, email, emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
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

app.delete("/api/users/:id", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
