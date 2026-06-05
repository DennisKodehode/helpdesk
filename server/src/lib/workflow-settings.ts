import { AutoAssignMode } from "@helpdesk/core";
import { prisma } from "./prisma";

// The singleton always lives under this fixed id.
export const WORKFLOW_SETTINGS_ID = "default";

// Single source of truth for the default lifecycle-rule values. Imported by the
// seed script and the accessor's defensive fallback so both stay in sync.
// Mirrors `SLA_POLICY_DEFAULTS` in sla-defaults.ts. `roundRobinCursor` is
// internal auto-assign bookkeeping, never part of the API contract.
export const WORKFLOW_SETTINGS_DEFAULTS = {
  autoAssignOn: false,
  autoAssignMode: AutoAssignMode.round_robin,
  autoResolveOn: true,
  autoResolveThreshold: 85,
  requireCategory: true,
  requireAssignee: false,
  autoCloseOn: true,
  autoCloseDays: 7,
  reopenOnReply: true,
  lockClosed: true,
  slaGreenMin: 90,
  slaYellowMin: 60,
  roundRobinCursor: 0,
  kbGrowthOn: false,
  kbGrowthIntervalDays: 30,
  kbMinClusterSize: 3,
  kbGrowthLastRunAt: null as Date | null,
};

export type WorkflowSettingsRow = NonNullable<
  Awaited<ReturnType<typeof prisma.workflowSettings.findUnique>>
>;

// Reads the singleton. The row is seeded at deploy time, but if it's missing
// (fresh DB before seeding, or a test that didn't seed) fall back to the
// documented defaults so every enforcement site always has a value to read.
export async function getWorkflowSettings(): Promise<WorkflowSettingsRow> {
  const row = await prisma.workflowSettings.findUnique({
    where: { id: WORKFLOW_SETTINGS_ID },
  });
  if (row) return row;
  return {
    id: WORKFLOW_SETTINGS_ID,
    ...WORKFLOW_SETTINGS_DEFAULTS,
    updatedAt: new Date(0),
  };
}

// Upserts with an empty `update` block so admin edits survive re-seeding
// (identical strategy to seedSlaPolicies).
export async function seedWorkflowSettings() {
  await prisma.workflowSettings.upsert({
    where: { id: WORKFLOW_SETTINGS_ID },
    create: { id: WORKFLOW_SETTINGS_ID, ...WORKFLOW_SETTINGS_DEFAULTS },
    update: {},
  });
  console.log("Workflow settings seeded");
}
