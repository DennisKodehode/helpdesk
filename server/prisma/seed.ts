import "dotenv/config";
import { generateId } from "better-auth";
import { Role } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.SEED_ADMIN_PASSWORD ?? "password123";

async function seed() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);

  const id = generateId();
  const now = new Date();

  await prisma.user.create({
    data: {
      id,
      name: "Admin",
      email,
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

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
