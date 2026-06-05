import { env } from "./env";
import { logger } from "./logger";
import { prisma } from "./prisma";
import resend from "./resend";

const EMAIL_FROM = env.EMAIL_FROM;

export interface OutboundAttachment {
  filename: string;
  content_type: string;
  content: Buffer;
}

export interface SendReplyEmailParams {
  to: string;
  toName: string;
  subject: string;
  replyBody: string;
  attachments?: OutboundAttachment[];
}

export async function sendReplyEmail({
  to,
  toName,
  subject,
  replyBody,
  attachments,
}: SendReplyEmailParams): Promise<void> {
  // Skip suppressed addresses (hard-bounced or marked-as-spam). Return rather
  // than throw so pg-boss doesn't retry the job forever — the suppression is
  // persistent until manually cleared.
  const suppression = await prisma.emailSuppression.findUnique({
    where: { email: to.toLowerCase() },
    select: { reason: true },
  });
  if (suppression) {
    logger.warn(
      { to, reason: suppression.reason },
      "skipping outbound to suppressed address",
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: `${toName} <${to}>`,
    subject: `Re: ${subject}`,
    text: replyBody,
    html: `<p>${replyBody.replace(/\n/g, "<br>")}</p>`,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  });
  if (error) throw new Error(error.message);
}

export interface SendInviteEmailParams {
  to: string;
  toName: string;
  acceptUrl: string;
}

export async function sendInviteEmail({
  to,
  toName,
  acceptUrl,
}: SendInviteEmailParams): Promise<void> {
  // Same suppression guard as replies — a hard-bounced/complained invitee
  // shouldn't keep throwing. Resend recovers it once the address clears.
  const suppression = await prisma.emailSuppression.findUnique({
    where: { email: to.toLowerCase() },
    select: { reason: true },
  });
  if (suppression) {
    logger.warn(
      { to, reason: suppression.reason },
      "skipping invite to suppressed address",
    );
    return;
  }

  const text =
    `Hi ${toName},\n\n` +
    `You've been invited to join the Helpdesk agent console. ` +
    `Set your password to get started:\n\n${acceptUrl}\n\n` +
    `This link expires in 72 hours.`;
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: `${toName} <${to}>`,
    subject: "You're invited to Helpdesk",
    text,
    html:
      `<p>Hi ${toName},</p>` +
      `<p>You've been invited to join the Helpdesk agent console. ` +
      `Set your password to get started:</p>` +
      `<p><a href="${acceptUrl}">Accept your invitation</a></p>` +
      `<p>This link expires in 72 hours.</p>`,
  });
  if (error) throw new Error(error.message);
}

export interface SendPasswordResetEmailParams {
  to: string;
  toName: string;
  resetUrl: string;
}

export async function sendPasswordResetEmail({
  to,
  toName,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<void> {
  // Same suppression guard as invites/replies — don't keep hammering a
  // hard-bounced/complained address. Resend recovers it once the address clears.
  const suppression = await prisma.emailSuppression.findUnique({
    where: { email: to.toLowerCase() },
    select: { reason: true },
  });
  if (suppression) {
    logger.warn(
      { to, reason: suppression.reason },
      "skipping password reset to suppressed address",
    );
    return;
  }

  const text =
    `Hi ${toName},\n\n` +
    `We received a request to reset your Helpdesk password. ` +
    `Use the link below to choose a new one:\n\n${resetUrl}\n\n` +
    `This link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: `${toName} <${to}>`,
    subject: "Reset your Helpdesk password",
    text,
    html:
      `<p>Hi ${toName},</p>` +
      `<p>We received a request to reset your Helpdesk password. ` +
      `Use the link below to choose a new one:</p>` +
      `<p><a href="${resetUrl}">Reset your password</a></p>` +
      `<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
  });
  if (error) throw new Error(error.message);
}
