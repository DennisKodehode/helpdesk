import { createHash, randomBytes } from "node:crypto";

// Invites expire 72 hours after they're sent (or resent).
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

/**
 * A fresh single-use invite token. The `raw` value goes into the emailed link;
 * only its `tokenHash` is persisted, so a database leak can't be replayed into
 * a valid invite.
 */
export function createInviteToken(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, tokenHash: hashInviteToken(raw) };
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS);
}
