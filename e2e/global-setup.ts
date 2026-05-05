import { execSync } from "child_process";
import { readFileSync } from "fs";
import type { FullConfig } from "@playwright/test";

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const testEnv = parseEnvFile("server/.env.test");

  console.log("\n[global-setup] Resetting test database...");

  execSync("npx prisma migrate reset --force", {
    cwd: "server",
    stdio: "inherit",
    env: {
      ...process.env,
      ...testEnv,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
    },
  });

  console.log("[global-setup] Seeding admin user...");

  execSync("bun prisma/seed.ts", {
    cwd: "server",
    stdio: "inherit",
    env: { ...process.env, ...testEnv },
  });

  console.log("[global-setup] Seeding agent user...");

  execSync("bun prisma/seed-agent.ts", {
    cwd: "server",
    stdio: "inherit",
    env: { ...process.env, ...testEnv },
  });

  console.log("[global-setup] Test database ready.\n");
}
