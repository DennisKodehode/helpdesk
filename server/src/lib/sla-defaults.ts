import { TicketPriority } from "@helpdesk/core";
import { prisma } from "./prisma";

// Single source of truth for the default SLA policy rows. Imported by the
// seed script and the breach-check test so both stay in sync if values
// change. Operators can edit rows in the DB directly — re-seeding upserts
// with an empty `update` block, so manual changes survive.
export const SLA_POLICY_DEFAULTS: ReadonlyArray<{
  priority: TicketPriority;
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
}> = [
  { priority: TicketPriority.urgent, firstResponseMinutes: 60, resolutionMinutes: 240 },
  { priority: TicketPriority.high, firstResponseMinutes: 240, resolutionMinutes: 1440 },
  { priority: TicketPriority.normal, firstResponseMinutes: 480, resolutionMinutes: 4320 },
  { priority: TicketPriority.low, firstResponseMinutes: 1440, resolutionMinutes: null },
];

export async function seedSlaPolicies() {
  for (const policy of SLA_POLICY_DEFAULTS) {
    await prisma.slaPolicy.upsert({
      where: { priority: policy.priority },
      create: policy,
      update: {},
    });
  }
  console.log(`SLA policies seeded: ${SLA_POLICY_DEFAULTS.length} rows`);
}
