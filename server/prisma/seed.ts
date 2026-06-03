import "dotenv/config";
import { generateId } from "better-auth";
import { Role } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { seedSlaPolicies } from "../src/lib/sla-defaults";
import { seedWorkflowSettings } from "../src/lib/workflow-settings";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env");
}
if (password.length < 8) {
  throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");
}

const AI_USER_EMAIL = "ai@helpdesk.internal";

async function seedAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: email! } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password!);

  const id = generateId();
  const now = new Date();

  await prisma.user.create({
    data: {
      id,
      name: "Admin",
      email: email!,
      emailVerified: true,
      role: Role.admin,
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

  console.log(`Admin created: ${email}`);
}

// The AI user is a virtual agent — used to mark tickets that auto-resolve
// handled. It has no Account row (no login). server/src/lib/ai-user.ts looks
// up this exact email at startup; if it's missing, AI auto-resolve silently
// no-ops, so the prod seed must create it.
async function seedAiUser() {
  const existing = await prisma.user.findUnique({ where: { email: AI_USER_EMAIL } });
  if (existing) {
    console.log(`AI user already exists: ${AI_USER_EMAIL}`);
    return;
  }
  const now = new Date();
  await prisma.user.create({
    data: {
      id: generateId(),
      email: AI_USER_EMAIL,
      name: "AI",
      role: Role.agent,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });
  console.log(`AI user created: ${AI_USER_EMAIL}`);
}

async function seed() {
  await seedAdmin();
  await seedAiUser();
  await seedSlaPolicies();
  await seedWorkflowSettings();
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
