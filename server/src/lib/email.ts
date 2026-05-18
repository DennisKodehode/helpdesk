import { env } from "./env";
import { logger } from "./logger";
import { prisma } from "./prisma";
import resend from "./resend";

const EMAIL_FROM = env.EMAIL_FROM;

export interface SendReplyEmailParams {
  to: string;
  toName: string;
  subject: string;
  replyBody: string;
}

export async function sendReplyEmail({
  to,
  toName,
  subject,
  replyBody,
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
  });
  if (error) throw new Error(error.message);
}
