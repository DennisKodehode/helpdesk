import { AdminAuditEventType, updateWorkflowSettingsSchema } from "@helpdesk/core";
import { Router } from "express";
import { recordAdminAuditEvent } from "../lib/admin-audit";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import {
  getWorkflowSettings,
  WORKFLOW_SETTINGS_ID,
  type WorkflowSettingsRow,
} from "../lib/workflow-settings";
import { requireAdminChain, requireAuth } from "../middleware/auth-middleware";

const router = Router();

// Strip the internal `roundRobinCursor` (and Prisma's `id`) so the API surface
// matches `workflowSettingsSchema` exactly.
function toResponse(row: WorkflowSettingsRow) {
  return {
    autoAssignOn: row.autoAssignOn,
    autoAssignMode: row.autoAssignMode,
    autoResolveOn: row.autoResolveOn,
    autoResolveThreshold: row.autoResolveThreshold,
    requireCategory: row.requireCategory,
    requireAssignee: row.requireAssignee,
    autoCloseOn: row.autoCloseOn,
    autoCloseDays: row.autoCloseDays,
    reopenOnReply: row.reopenOnReply,
    lockClosed: row.lockClosed,
    slaGreenMin: row.slaGreenMin,
    slaYellowMin: row.slaYellowMin,
    kbGrowthOn: row.kbGrowthOn,
    kbGrowthIntervalDays: row.kbGrowthIntervalDays,
    kbMinClusterSize: row.kbMinClusterSize,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Any authenticated user can read the rules — agents need them to reflect the
// lifecycle policy in the ticket UI (composer lock, resolve-button gating).
// Only admins can mutate (mirrors sla-policies.ts).
router.get("/", requireAuth, async (_req, res) => {
  const settings = await getWorkflowSettings();
  res.json(toResponse(settings));
});

router.patch("/", ...requireAdminChain, async (req, res) => {
  const result = updateWorkflowSettingsSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  // The green > yellow ordering must hold on the merged row — a PATCH may touch
  // only one threshold, so validate against current values, not just the body.
  const current = await getWorkflowSettings();
  const greenMin = result.data.slaGreenMin ?? current.slaGreenMin;
  const yellowMin = result.data.slaYellowMin ?? current.slaYellowMin;
  if (greenMin <= yellowMin) {
    res
      .status(400)
      .json({ error: "Green threshold must be greater than the yellow threshold" });
    return;
  }

  // Upsert so the singleton is created on first edit even if seeding was
  // skipped; `create` lets the schema defaults fill any unspecified fields.
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.workflowSettings.upsert({
      where: { id: WORKFLOW_SETTINGS_ID },
      create: { id: WORKFLOW_SETTINGS_ID, ...result.data },
      update: result.data,
    });
    // Per-field before/after diff (only the fields the PATCH actually changed).
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(result.data)) {
      const prev = (current as Record<string, unknown>)[key];
      if (prev !== value) changed[key] = { before: prev, after: value };
    }
    if (Object.keys(changed).length > 0) {
      await recordAdminAuditEvent(tx, {
        actorId: req.user!.id,
        actorName: req.user!.name,
        type: AdminAuditEventType.workflow_settings_changed,
        targetName: "Workflow",
        data: { changed },
      });
    }
    return row;
  });
  res.json(toResponse(updated));
});

export default router;
