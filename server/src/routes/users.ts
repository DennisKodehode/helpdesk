import {
  AuditEventType,
  inviteAgentSchema,
  isGlobalAdmin,
  Role,
  UserStatus,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import { Router } from "express";
import { recordAuditEvent } from "../lib/audit";
import { auth } from "../lib/auth";
import { sendInviteEmail } from "../lib/email";
import { env } from "../lib/env";
import { createInviteToken, inviteExpiresAt } from "../lib/invite";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain } from "../middleware/auth-middleware";

function acceptInviteUrl(rawToken: string): string {
  return `${env.CLIENT_URL[0]}/accept-invite?token=${rawToken}`;
}

const router = Router();

router.get("/", ...requireAdminChain, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, NOT: { email: "ai@helpdesk.internal" } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

// Per-agent roster for the Agents screen: status + throughput in one query.
// Last-active comes from a PRE-AGGREGATED session subquery (one row per user)
// so the LEFT JOIN to tickets doesn't fan out the FILTER counts.
router.get("/roster", ...requireAdminChain, async (_req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      open_assigned: bigint;
      resolved_30d: bigint;
      avg_resolution_minutes: string | number | null;
      last_active_at: Date | null;
    }[]
  >`
    SELECT
      u.id, u.name, u.email, u.role::text AS role, u.status::text AS status,
      COUNT(t.id) FILTER (WHERE t.status = 'open') AS open_assigned,
      COUNT(t.id) FILTER (
        WHERE t.status IN ('resolved', 'closed') AND t."resolvedAt" >= ${thirtyDaysAgo}
      ) AS resolved_30d,
      ROUND(
        (EXTRACT(EPOCH FROM AVG(t."resolvedAt" - t."createdAt")
          FILTER (WHERE t."resolvedAt" IS NOT NULL)) / 60)::NUMERIC, 1
      ) AS avg_resolution_minutes,
      MAX(s.last_active) AS last_active_at
    FROM "user" u
    LEFT JOIN ticket t ON t."assignedToId" = u.id
    LEFT JOIN (
      SELECT "userId", MAX("updatedAt") AS last_active FROM session GROUP BY "userId"
    ) s ON s."userId" = u.id
    WHERE u."deletedAt" IS NULL AND u.email <> 'ai@helpdesk.internal'
    GROUP BY u.id
    ORDER BY u.name ASC
  `;

  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as Role,
      status: r.status as UserStatus,
      openAssigned: Number(r.open_assigned),
      resolved30d: Number(r.resolved_30d),
      avgResolutionMinutes:
        r.avg_resolution_minutes != null ? Number(r.avg_resolution_minutes) : null,
      lastActiveAt: r.last_active_at ? r.last_active_at.toISOString() : null,
    })),
  );
});

// Invite an agent/admin. Creates the user in `invited` status with NO credential
// (so they can't sign in yet) and emails a single-use link to set a password —
// see routes/invites.ts for the accept side. Returns the roster-row shape.
router.post("/", ...requireAdminChain, async (req, res) => {
  const result = inviteAgentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { name, email, role } = result.data;
  // Creating an admin is a global-admin-only action (the schema already blocks
  // `globalAdmin` outright). Regular admins may only invite agents.
  if (role === Role.admin && !isGlobalAdmin(req.user!.role)) {
    res.status(403).json({ error: "Only the global admin can invite admins." });
    return;
  }
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing && !existing.deletedAt) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }
  if (existing?.deletedAt) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { email: `deleted-${existing.id}@deleted.invalid` },
    });
  }
  const id = generateId();
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: true,
      role,
      status: UserStatus.invited,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  const { raw, tokenHash } = createInviteToken();
  await prisma.invitation.create({
    data: { userId: id, tokenHash, expiresAt: inviteExpiresAt(now) },
  });
  // Don't fail the invite if the email send hiccups — the admin can Resend.
  try {
    await sendInviteEmail({ to: email, toName: name, acceptUrl: acceptInviteUrl(raw) });
  } catch (err) {
    console.error("sendInviteEmail failed:", err);
  }
  res.status(201).json({
    ...user,
    openAssigned: 0,
    resolved30d: 0,
    avgResolutionMinutes: null,
    lastActiveAt: null,
  });
});

// Rotate the token (invalidating the old link) and re-send the invite email.
router.post("/:id/invite/resend", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.status !== UserStatus.invited) {
    res.status(409).json({ error: "This agent has already accepted their invite" });
    return;
  }
  // Managing an admin's invite is global-admin-only.
  if (user.role === Role.admin && !isGlobalAdmin(req.user!.role)) {
    res.status(403).json({ error: "Only the global admin can manage admin invites." });
    return;
  }
  const { raw, tokenHash } = createInviteToken();
  const expiresAt = inviteExpiresAt();
  await prisma.invitation.upsert({
    where: { userId: id },
    create: { userId: id, tokenHash, expiresAt },
    update: { tokenHash, expiresAt },
  });
  try {
    await sendInviteEmail({
      to: user.email,
      toName: user.name,
      acceptUrl: acceptInviteUrl(raw),
    });
  } catch (err) {
    console.error("resend invite failed:", err);
  }
  res.status(204).send();
});

// Promote/demote. Guards: an admin can't demote themselves, and the last admin
// can't be demoted (otherwise no one could administer the workspace).
router.patch("/:id/role", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  const result = updateUserRoleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { role } = result.data;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // The global admin's role is immutable via the API (programmatic-only singleton).
  if (target.role === Role.globalAdmin) {
    res.status(403).json({ error: "The global admin's role can't be changed." });
    return;
  }
  // Granting OR revoking admin is a global-admin-only action.
  if (
    (role === Role.admin || target.role === Role.admin) &&
    !isGlobalAdmin(req.user!.role)
  ) {
    res.status(403).json({ error: "Only the global admin can change admin roles." });
    return;
  }
  if (role === Role.agent && target.role === Role.admin) {
    if (id === req.user!.id) {
      res.status(403).json({ error: "You can't change your own role" });
      return;
    }
    // Count admin-capable users (admins + the global admin) so we never strand
    // the workspace with no one who can administer it.
    const adminCount = await prisma.user.count({
      where: { role: { in: [Role.admin, Role.globalAdmin] }, deletedAt: null },
    });
    if (adminCount <= 1) {
      res.status(403).json({ error: "Can't demote the last admin" });
      return;
    }
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { role, updatedAt: new Date() },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  res.json(updated);
});

// Deactivate / reactivate. Deactivating boots the user from any live session
// (the login gate then blocks re-entry). `invited` users resolve via accept.
router.patch("/:id/status", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  const result = updateUserStatusSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { status } = result.data;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.status === UserStatus.invited) {
    res.status(409).json({ error: "This agent hasn't accepted their invite yet" });
    return;
  }
  // The global admin can never be deactivated/reactivated.
  if (target.role === Role.globalAdmin) {
    res.status(403).json({ error: "The global admin account can't be deactivated." });
    return;
  }
  // Activating/deactivating an admin is global-admin-only (regular admins manage
  // only agents). The blanket "admins can't be deactivated" rule is gone.
  if (target.role === Role.admin && !isGlobalAdmin(req.user!.role)) {
    res.status(403).json({ error: "Only the global admin can manage admin accounts." });
    return;
  }
  if (status === UserStatus.inactive) {
    if (id === req.user!.id) {
      res.status(403).json({ error: "You can't deactivate your own account" });
      return;
    }
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { status, updatedAt: new Date() },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (status === UserStatus.inactive) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  res.json(updated);
});

router.delete("/:id", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  if (id === req.user!.id) {
    res.status(403).json({ error: "Cannot delete your own account" });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === Role.globalAdmin) {
    res.status(403).json({ error: "Cannot delete the global admin account." });
    return;
  }
  // Deleting an admin is global-admin-only; regular admins may only remove agents.
  if (target.role === Role.admin && !isGlobalAdmin(req.user!.role)) {
    res.status(403).json({ error: "Only the global admin can delete an admin account." });
    return;
  }
  const now = new Date();
  const actorId = req.user!.id;

  // Per-ticket transactions so each unassigned ticket gets its own
  // assignee_changed audit event with reason=user_deleted. Bulk updateMany
  // would lose per-ticket audit granularity.
  const affectedTickets = await prisma.ticket.findMany({
    where: { assignedToId: id },
    select: { id: true },
  });
  for (const { id: ticketId } of affectedTickets) {
    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { assignedToId: null },
      });
      await recordAuditEvent(tx, {
        ticketId,
        actorId,
        type: AuditEventType.assignee_changed,
        data: { from: id, to: null, reason: "user_deleted" },
      });
    });
  }

  await prisma.user.update({
    where: { id },
    data: { email: `deleted-${id}@deleted.invalid`, deletedAt: now },
  });
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.account.deleteMany({ where: { userId: id } });
  // Drop any pending invite so a live token can't resurrect a removed user.
  await prisma.invitation.deleteMany({ where: { userId: id } });
  res.status(204).send();
});

router.patch("/:id", ...requireAdminChain, async (req, res) => {
  const id = req.params.id as string;
  const result = updateUserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { name, email, password } = result.data;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Editing someone else's admin/global-admin account (incl. resetting their
  // password) is privileged — only the global admin may. Anyone can edit their
  // OWN account regardless of role.
  if (id !== req.user!.id) {
    if (target.role === Role.globalAdmin) {
      res
        .status(403)
        .json({ error: "The global admin account can't be edited by others." });
      return;
    }
    if (target.role === Role.admin && !isGlobalAdmin(req.user!.role)) {
      res.status(403).json({ error: "Only the global admin can edit an admin account." });
      return;
    }
  }

  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing && existing.id !== id) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const now = new Date();
  const updatedUser = await prisma.user.update({
    where: { id },
    data: { name, email, updatedAt: now },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (password && password.trim().length > 0) {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(password.trim());
    await ctx.internalAdapter.updatePassword(id, hashedPassword);
  }

  res.json(updatedUser);
});

export default router;
