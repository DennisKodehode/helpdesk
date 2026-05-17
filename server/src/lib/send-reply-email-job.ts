import { randomUUID } from "node:crypto";
import type { Job } from "pg-boss";
import { sendReplyEmail } from "./email";
import { logger } from "./logger";

export const SEND_REPLY_EMAIL_QUEUE = "send-reply-email";

export type SendReplyEmailJobData = {
  to: string;
  toName: string;
  subject: string;
  replyBody: string;
  _requestId?: string;
};

export async function sendReplyEmailWorker([job]: Job<SendReplyEmailJobData>[]) {
  const log = logger.child({
    reqId: job.data._requestId ?? randomUUID(),
    job: SEND_REPLY_EMAIL_QUEUE,
  });
  await sendReplyEmail(job.data);
  log.info({ to: job.data.to }, "reply email sent");
}
