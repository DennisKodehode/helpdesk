import { randomUUID } from "node:crypto";
import type { Job } from "pg-boss";
import { type OutboundAttachment, sendReplyEmail } from "./email";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { storage } from "./storage";

export const SEND_REPLY_EMAIL_QUEUE = "send-reply-email";

export type SendReplyEmailJobData = {
  to: string;
  toName: string;
  subject: string;
  replyBody: string;
  replyId: number;
  _requestId?: string;
};

export async function sendReplyEmailWorker([job]: Job<SendReplyEmailJobData>[]) {
  const log = logger.child({
    reqId: job.data._requestId ?? randomUUID(),
    job: SEND_REPLY_EMAIL_QUEUE,
  });

  const rows = await prisma.attachment.findMany({
    where: { replyId: job.data.replyId },
    select: { filename: true, contentType: true, storageKey: true },
  });

  const attachments: OutboundAttachment[] = [];
  for (const row of rows) {
    const content = await storage.get(row.storageKey);
    attachments.push({
      filename: row.filename,
      content_type: row.contentType,
      content,
    });
  }

  await sendReplyEmail({
    to: job.data.to,
    toName: job.data.toName,
    subject: job.data.subject,
    replyBody: job.data.replyBody,
    attachments: attachments.length > 0 ? attachments : undefined,
  });
  log.info({ to: job.data.to, attachmentCount: attachments.length }, "reply email sent");
}
