import { config } from "dotenv";

// Runs ONCE before the whole server suite (vitest `globalSetup`), in the main
// process. Per-file `setupFiles` (setup.ts) load .env.test too, but they run
// later and per-worker — so load it here as well before touching the DB.
config({ path: ".env.test" });

// Wipe mutable test data so orphan rows from a previously *interrupted* run
// can't poison global-state assertions (e.g. assign-agent's "no active agents",
// which queries every active agent in the DB). Files run serially and clean up
// after themselves; this just guarantees a clean slate at the very start so an
// aborted run never bleeds into the next one. Config singletons
// (workflow_settings, sla_policy) are intentionally left alone — tests
// seed/upsert them as needed, and they aren't a source of the orphan pollution.
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  // Hard guard: only ever run against the test database.
  if (!/test/i.test(url)) {
    throw new Error(
      `[test/global-setup] Refusing to clear a non-test database (DATABASE_URL=${url}).`,
    );
  }

  // Import after env is loaded so the Prisma client connects to helpdesk_test.
  const { prisma } = await import("../lib/prisma");
  try {
    // Order respects FKs (children before parents) so plain deleteMany works
    // without relying on cascade behavior.
    await prisma.$transaction([
      prisma.auditEvent.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.reply.deleteMany(),
      prisma.ticket.deleteMany(),
      prisma.invitation.deleteMany(),
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.emailSuppression.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}
