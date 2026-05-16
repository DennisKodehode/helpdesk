import { env } from "./env";
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
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: `${toName} <${to}>`,
    subject: `Re: ${subject}`,
    text: replyBody,
    html: `<p>${replyBody.replace(/\n/g, "<br>")}</p>`,
  });
  if (error) throw new Error(error.message);
}
