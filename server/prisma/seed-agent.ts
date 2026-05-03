import "dotenv/config";
import { generateId } from "better-auth";
import { Role } from "../src/generated/prisma/client";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const AGENT_EMAIL = "agent@test.example.com";
const AGENT_PASSWORD = "AgentPassword123!";

async function seedAgent() {
  const existing = await prisma.user.findUnique({ where: { email: AGENT_EMAIL } });
  if (existing) {
    console.log(`Agent already exists: ${AGENT_EMAIL}`);
    return;
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(AGENT_PASSWORD);

  const id = generateId();
  const now = new Date();

  await prisma.user.create({
    data: {
      id,
      name: "Test Agent",
      email: AGENT_EMAIL,
      emailVerified: true,
      role: Role.agent,
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

  console.log(`Agent created: ${AGENT_EMAIL}`);
}

seedAgent()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
