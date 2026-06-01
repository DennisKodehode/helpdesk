import { acceptInviteSchema, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import { Router } from "express";
import { auth } from "../lib/auth";
import { hashInviteToken } from "../lib/invite";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";

// Public (unauthenticated) — an invitee has no session yet. The accept flow
// creates a credential Account directly (Better Auth's setPassword requires an
// existing session, so it can't be used here); sign-in happens client-side
// afterwards via the normal email/password path.
const router = Router();

const INVALID = "This invitation is invalid or has expired.";

async function findValidInvite(token: string) {
  const invite = await prisma.invitation.findFirst({
    where: { tokenHash: hashInviteToken(token) },
    include: { user: true },
  });
  if (!invite) return null;
  if (invite.expiresAt < new Date()) return null;
  if (invite.user.deletedAt || invite.user.status !== UserStatus.invited) return null;
  return invite;
}

// Lets the accept page show who's being invited (and detect a dead link early).
router.get("/validate", async (req, res) => {
  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }
  const invite = await findValidInvite(token);
  if (!invite) {
    res.status(400).json({ error: INVALID });
    return;
  }
  res.json({ name: invite.user.name, email: invite.user.email });
});

router.post("/accept", async (req, res) => {
  const result = acceptInviteSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }
  const { token, password } = result.data;
  const invite = await findValidInvite(token);
  if (!invite) {
    res.status(400).json({ error: INVALID });
    return;
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);
  const now = new Date();

  // One transaction so the credential, the status flip, and the single-use
  // token consumption can't partially apply.
  await prisma.$transaction([
    prisma.account.create({
      data: {
        id: generateId(),
        accountId: invite.userId,
        providerId: "credential",
        userId: invite.userId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    }),
    prisma.user.update({
      where: { id: invite.userId },
      data: { status: UserStatus.active, updatedAt: now },
    }),
    prisma.invitation.delete({ where: { id: invite.id } }),
  ]);

  // Client signs in with these credentials next (passes the login gate).
  res.json({ email: invite.user.email });
});

export default router;
