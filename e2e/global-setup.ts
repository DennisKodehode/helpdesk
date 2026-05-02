import { execSync } from "child_process";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log("\n[global-setup] Resetting test database...");

  execSync("npx prisma migrate reset --force", {
    cwd: "server",
    stdio: "inherit",
    env: {
      ...process.env,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "yes",
    },
  });

  console.log("[global-setup] Seeding admin user...");

  execSync("bun prisma/seed.ts", {
    cwd: "server",
    stdio: "inherit",
    env: { ...process.env },
  });

  console.log("[global-setup] Test database ready.\n");
}
