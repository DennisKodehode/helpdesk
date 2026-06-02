import { randomUUID } from "node:crypto";
import {
  AuditEventType,
  inboundEmailSchema,
  isAttachmentSafe,
  MAX_ATTACHMENT_SIZE_BYTES,
  NotificationType,
  SenderType,
  TicketStatus,
} from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import EmailReplyParser from "email-reply-parser";
import { Router } from "express";
import he from "he";
import { fromPrisma } from "pg-boss";
import type { Logger } from "pino";
import type { Prisma } from "../generated/prisma/client";
import { SuppressionReason } from "../generated/prisma/client";
import { isAiAssigned } from "../lib/ai-user";
import { recordAuditEvent } from "../lib/audit";
import { AUTO_RESOLVE_TICKET_QUEUE } from "../lib/auto-resolve-ticket";
import boss from "../lib/boss";
import { CLASSIFY_TICKET_QUEUE } from "../lib/classify-ticket";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";
import resend from "../lib/resend";
import { safeFilename, storage } from "../lib/storage";
import { firstIssue } from "../lib/validation";
import { webhookLimiter } from "../middleware/rate-limit";

const router = Router();

// Duck-typed so we don't import Prisma's error class (path varies across
// generated-client versions). P2002 is the unique-constraint-violation code.
function isUniqueConstraintError(err: unknown): boolean {
  return (
    err != null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

function parseFrom(from: string): { fromName: string; fromEmail: string } {
  const match = from.match(/^"?([^"<>]+?)"?\s*<([^>]+)>$/);
  if (match) {
    return { fromName: match[1].trim() || match[2].trim(), fromEmail: match[2].trim() };
  }
  return { fromName: from.trim(), fromEmail: from.trim() };
}

/**
 * Strip Gmail-style inline-image placeholders from a plain-text body. When a
 * customer pastes an image into the message, the text/plain alternative carries
 * a `[image: filename.png]` marker where the image sat, while the image itself
 * arrives as a related attachment (surfaced separately as a download link). The
 * marker is noise in the rendered body, so drop it and tidy the whitespace it
 * leaves behind. An image-only email correctly collapses to an empty body.
 */
export function stripInlineImagePlaceholders(text: string): string {
  return text
    .replace(/\[image:[^\]\n]*\]/gi, "")
    .replace(/[^\S\n]+$/gm, "") // trailing spaces/tabs left on a line
    .replace(/\n{3,}/g, "\n\n") // collapse blank-line runs the marker left
    .trim();
}

type AttachmentParent = { replyId: number } | { ticketId: number };

/**
 * Persists inbound email attachments onto either a Reply (customer-reply path)
 * or a Ticket (new-ticket path — the customer's first email). Skips items that
 * fail the MIME/extension denylist or the size cap (logs a warn per skip;
 * doesn't fail the transaction). Wraps the Resend API call in try/catch so a
 * transient API hiccup doesn't roll back the customer's reply/ticket.
 */
async function processInboundAttachments(
  tx: Prisma.TransactionClient,
  parent: AttachmentParent,
  emailId: string,
  log: Logger,
): Promise<void> {
  let listResult: Awaited<ReturnType<typeof resend.emails.receiving.attachments.list>>;
  try {
    listResult = await resend.emails.receiving.attachments.list({ emailId });
  } catch (err) {
    log.error({ err, emailId }, "inbound-email: attachments.list failed");
    Sentry.captureException(err);
    return;
  }
  if (listResult.error) {
    log.error(
      { err: listResult.error, emailId },
      "inbound-email: attachments.list returned error",
    );
    return;
  }

  // The SDK wraps results: outer `data` is the success object, inner `data`
  // is the actual attachment array ({ object: 'list', has_more, data: [...] }).
  const attachments = listResult.data?.data ?? [];
  for (const att of attachments) {
    const filename = att.filename ?? `attachment-${att.id}`;
    if (!isAttachmentSafe(filename, att.content_type)) {
      log.warn(
        { emailId, filename, contentType: att.content_type, reason: "denylisted" },
        "inbound-email: skipping attachment",
      );
      continue;
    }
    if (att.size > MAX_ATTACHMENT_SIZE_BYTES) {
      log.warn(
        { emailId, filename, size: att.size, reason: "oversize" },
        "inbound-email: skipping attachment",
      );
      continue;
    }

    let buffer: Buffer;
    try {
      const response = await fetch(att.download_url);
      if (!response.ok) {
        log.warn(
          { emailId, filename, status: response.status, reason: "download_failed" },
          "inbound-email: skipping attachment",
        );
        continue;
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } catch (err) {
      log.warn(
        { err, emailId, filename, reason: "fetch_threw" },
        "inbound-email: skipping attachment",
      );
      continue;
    }

    // Prefix the storage key with the parent kind so the same numeric ID
    // can't collide across the two parent tables (Ticket.id and Reply.id
    // are independent autoincrements).
    const parentLabel =
      "ticketId" in parent ? `ticket-${parent.ticketId}` : `reply-${parent.replyId}`;
    const storageKey = `attachments/${parentLabel}/${randomUUID()}-${safeFilename(filename)}`;
    await storage.put(storageKey, buffer, att.content_type);
    await tx.attachment.create({
      data: {
        ...parent,
        filename,
        contentType: att.content_type,
        size: att.size,
        storageKey,
      },
    });
  }
}

function findHeader(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

function isAutoSubmittedOrBounce(
  headers: Record<string, string> | null | undefined,
): string | null {
  const autoSubmitted = findHeader(headers, "Auto-Submitted");
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== "no") {
    return `Auto-Submitted: ${autoSubmitted}`;
  }

  const suppress = findHeader(headers, "X-Auto-Response-Suppress");
  if (suppress && /\b(all|oof|autoreply)\b/i.test(suppress)) {
    return `X-Auto-Response-Suppress: ${suppress}`;
  }

  const precedence = findHeader(headers, "Precedence");
  if (precedence && /\b(bulk|auto_reply|list|junk)\b/i.test(precedence)) {
    return `Precedence: ${precedence}`;
  }

  const returnPath = findHeader(headers, "Return-Path");
  if (returnPath && returnPath.trim() === "<>") {
    return "Return-Path: <> (bounce)";
  }

  return null;
}

router.post("/", webhookLimiter, async (req, res) => {
  const rawPayload = (req as any).rawBody ?? JSON.stringify(req.body);

  try {
    resend.webhooks.verify({
      payload: rawPayload,
      headers: {
        id: req.headers["svix-id"] as string,
        timestamp: req.headers["svix-timestamp"] as string,
        signature: req.headers["svix-signature"] as string,
      },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const event = JSON.parse(rawPayload) as {
    type: string;
    data: {
      email_id: string;
      from: string;
      subject: string;
      to: string[];
      bounce?: { type: string; subType?: string; message?: string };
      attachments?: Array<{
        id: string;
        filename: string | null;
        content_type: string;
        size: number;
        content_id: string | null;
        content_disposition: string | null;
      }>;
    };
  };

  if (event.type === "email.bounced") {
    // Suppress only on permanent (hard) bounces — transient/soft bounces are
    // temporary (full mailbox, rate-limited) and would unfairly block the
    // customer if treated as permanent. Upsert is idempotent across Resend's
    // webhook retries.
    if (event.data.bounce?.type === "Permanent") {
      for (const to of event.data.to ?? []) {
        await prisma.emailSuppression.upsert({
          where: { email: to.toLowerCase() },
          create: {
            email: to.toLowerCase(),
            reason: SuppressionReason.hard_bounce,
            detail: `${event.data.bounce.type}/${event.data.bounce.subType ?? "Unknown"}`,
            resendEmailId: event.data.email_id,
          },
          update: {},
        });
      }
    }
    res.status(200).json({ acknowledged: true });
    return;
  }

  if (event.type === "email.complained") {
    // Complaints are user-initiated ("mark as spam") — always suppress, and
    // upgrade from hard_bounce → complaint if previously listed (complaint
    // takes priority since it's a deliberate user signal).
    for (const to of event.data.to ?? []) {
      await prisma.emailSuppression.upsert({
        where: { email: to.toLowerCase() },
        create: {
          email: to.toLowerCase(),
          reason: SuppressionReason.complaint,
          resendEmailId: event.data.email_id,
        },
        update: { reason: SuppressionReason.complaint },
      });
    }
    res.status(200).json({ acknowledged: true });
    return;
  }

  if (event.type !== "email.received") {
    res.status(200).json({ received: true });
    return;
  }

  const emailId = event.data.email_id;

  const [existingTicketWithId, existingReplyWithId] = await Promise.all([
    prisma.ticket.findUnique({ where: { resendEmailId: emailId }, select: { id: true } }),
    prisma.reply.findUnique({ where: { resendEmailId: emailId }, select: { id: true } }),
  ]);
  if (existingTicketWithId || existingReplyWithId) {
    res.status(200).json({ deduplicated: true });
    return;
  }

  const emailResult = await resend.emails.receiving.get(emailId);
  if (emailResult.error) {
    req.log.error(
      { err: emailResult.error, emailId },
      "inbound-email: could not retrieve email body",
    );
    Sentry.captureException(emailResult.error);
  }

  const loopReason = isAutoSubmittedOrBounce(emailResult.data?.headers);
  if (loopReason) {
    req.log.info({ emailId, reason: loopReason }, "inbound-email: dropping");
    res.status(200).json({ dropped: true, reason: loopReason });
    return;
  }

  const rawText = emailResult.data?.text ?? "";
  const bodyText = rawText
    ? stripInlineImagePlaceholders(new EmailReplyParser().parseReply(he.decode(rawText)))
    : undefined;
  const bodyHtml = undefined;

  const { fromName, fromEmail } = parseFrom(event.data.from ?? "");
  const result = inboundEmailSchema.safeParse({
    fromName,
    fromEmail,
    subject: event.data.subject,
    body: bodyText,
    bodyHtml,
  });

  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const { fromName: parsedName, fromEmail: parsedEmail, subject, body } = result.data;

  const existingTicket = await prisma.ticket.findFirst({
    where: {
      fromEmail: parsedEmail,
      subject,
      status: {
        in: [
          TicketStatus.new,
          TicketStatus.processing,
          TicketStatus.open,
          TicketStatus.resolved,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingTicket) {
    const wasResolved = existingTicket.status === TicketStatus.resolved;
    const shouldUnassignAi = wasResolved && isAiAssigned(existingTicket.assignedToId);
    const previousAssigneeId = existingTicket.assignedToId;
    const now = new Date();

    let reply: Awaited<ReturnType<typeof prisma.reply.create>>;
    let refreshedTicket: { id: number; assignedToId: string | null; subject: string };
    try {
      ({ reply, refreshedTicket } = await prisma.$transaction(async (tx) => {
        const createdReply = await tx.reply.create({
          data: {
            ticketId: existingTicket.id,
            authorId: null,
            senderType: SenderType.customer,
            body: body ?? "",
            bodyHtml: bodyHtml ?? null,
            resendEmailId: emailId,
          },
        });
        const updatedTicket = await tx.ticket.update({
          where: { id: existingTicket.id },
          data: {
            updatedAt: now,
            lastReplySenderType: SenderType.customer,
            ...(wasResolved && { status: TicketStatus.open, resolvedAt: null }),
            ...(shouldUnassignAi && { assignedToId: null }),
          },
          select: { id: true, assignedToId: true, subject: true },
        });
        await recordAuditEvent(tx, {
          ticketId: existingTicket.id,
          actorId: null,
          type: AuditEventType.reply_added,
          data: { replyId: createdReply.id, senderType: SenderType.customer },
        });
        if (wasResolved) {
          await recordAuditEvent(tx, {
            ticketId: existingTicket.id,
            actorId: null,
            type: AuditEventType.auto_reopened,
          });
        }
        if (shouldUnassignAi) {
          await recordAuditEvent(tx, {
            ticketId: existingTicket.id,
            actorId: null,
            type: AuditEventType.assignee_changed,
            data: {
              from: previousAssigneeId,
              to: null,
              reopenUnassigned: true,
            },
          });
        }
        if ((event.data.attachments ?? []).length > 0) {
          await processInboundAttachments(
            tx,
            { replyId: createdReply.id },
            emailId,
            req.log,
          );
        }
        return { reply: createdReply, refreshedTicket: updatedTicket };
      }));
    } catch (err) {
      // Concurrent delivery of the same email_id lost the race to insert the
      // Reply. The transaction rolled back; the other request created the row.
      if (isUniqueConstraintError(err)) {
        res.status(200).json({ deduplicated: true });
        return;
      }
      throw err;
    }

    if (refreshedTicket.assignedToId && !isAiAssigned(refreshedTicket.assignedToId)) {
      const agent = await prisma.user.findUnique({
        where: { id: refreshedTicket.assignedToId },
        select: { id: true, deletedAt: true },
      });
      if (agent && !agent.deletedAt) {
        await prisma.notification.create({
          data: {
            userId: agent.id,
            type: NotificationType.customer_reply,
            ticketId: refreshedTicket.id,
          },
        });
      }
    }

    res.status(201).json({ type: "reply", reply, reopened: wasResolved });
    return;
  }

  const reqId = String(req.id);
  // Atomic: ticket create + classify + auto-resolve enqueue all commit
  // together. If either queue insert fails, the ticket isn't created either,
  // the webhook returns 500, and Resend retries cleanly (item #9's race-fix
  // catches the dedup window).
  let ticket: Awaited<ReturnType<typeof prisma.ticket.create>>;
  try {
    ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          fromName: parsedName,
          fromEmail: parsedEmail,
          subject,
          body: body ?? "",
          bodyHtml: bodyHtml ?? null,
          status: TicketStatus.new,
          resendEmailId: emailId,
        },
      });
      await recordAuditEvent(tx, {
        ticketId: created.id,
        actorId: null,
        type: AuditEventType.ticket_created,
        data: { fromEmail: created.fromEmail },
      });
      if ((event.data.attachments ?? []).length > 0) {
        await processInboundAttachments(tx, { ticketId: created.id }, emailId, req.log);
      }
      await boss.send(
        CLASSIFY_TICKET_QUEUE,
        {
          id: created.id,
          subject: created.subject,
          body: created.body,
          _requestId: reqId,
        },
        { db: fromPrisma(tx) },
      );
      await boss.send(
        AUTO_RESOLVE_TICKET_QUEUE,
        {
          id: created.id,
          fromName: created.fromName,
          subject: created.subject,
          body: created.body,
          _requestId: reqId,
        },
        { db: fromPrisma(tx) },
      );
      return created;
    });
  } catch (err) {
    // Concurrent delivery of the same email_id lost the race to insert the
    // Ticket. The other request created the row.
    if (isUniqueConstraintError(err)) {
      res.status(200).json({ deduplicated: true });
      return;
    }
    throw err;
  }

  res.status(201).json({ type: "ticket", ticket });
});

export default router;
