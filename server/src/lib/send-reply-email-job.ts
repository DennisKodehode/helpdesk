import type { Job } from "pg-boss";
import { sendReplyEmail } from "./email";

export const SEND_REPLY_EMAIL_QUEUE = "send-reply-email";

type SendReplyEmailJobData = {
  to: string;
  toName: string;
  subject: string;
  replyBody: string;
};

export async function sendReplyEmailWorker([job]: Job<SendReplyEmailJobData>[]) {
  await sendReplyEmail(job.data);
}
