import { randomUUID } from "node:crypto";
import { google } from "@ai-sdk/google";
import {
  AuditEventType,
  NotificationType,
  SenderType,
  TicketStatus,
} from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import { generateText } from "ai";
import type { Job } from "pg-boss";
import { fromPrisma } from "pg-boss";
import type { Logger } from "pino";
import { getAiUserId } from "./ai-user";
import { pickAssignee } from "./assign-agent";
import { recordAuditEvent } from "./audit";
import boss from "./boss";
import { buildDraftPrompt, parseDraftDecision } from "./draft-reply";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { SEND_REPLY_EMAIL_QUEUE } from "./send-reply-email-job";
import { getWorkflowSettings, type WorkflowSettingsRow } from "./workflow-settings";

export const AUTO_RESOLVE_TICKET_QUEUE = "auto-resolve-ticket";

// Sends a triaged ticket to Open instead of auto-resolving. Used by every
// non-resolve exit (AI errors, escalate decision, disabled auto-resolve,
// below-threshold confidence, unmet resolution gate). When `autoAssignOn`, the
// ticket is handed to an active agent (round-robin or least-loaded) instead of
// landing unassigned, mirroring a manual assignment (assignee_changed audit +
// ticket_assigned notification). The ticket is AI-assigned at this point
// (set when triage started), so the audit `from` is the AI user.
async function escalateToOpen(
  ticketId: number,
  aiUserId: string,
  reason: string,
  settings: WorkflowSettingsRow,
) {
  await prisma.$transaction(async (tx) => {
    const assignee = settings.autoAssignOn ? await pickAssignee(tx, settings) : null;
    await tx.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.open, assignedToId: assignee },
    });
    await recordAuditEvent(tx, {
      ticketId,
      actorId: aiUserId,
      type: AuditEventType.ai_escalated,
      data: { reason },
    });
    if (assignee) {
      await recordAuditEvent(tx, {
        ticketId,
        actorId: aiUserId,
        type: AuditEventType.assignee_changed,
        data: { from: aiUserId, to: assignee, autoAssigned: true },
      });
      await tx.notification.create({
        data: {
          userId: assignee,
          actorId: aiUserId,
          type: NotificationType.ticket_assigned,
          ticketId,
        },
      });
    }
  });
}

export type AutoResolveJobData = {
  id: number;
  fromName: string;
  subject: string;
  body: string;
  _requestId?: string;
};

async function runAutoResolve(data: AutoResolveJobData, log: Logger) {
  const aiUserId = getAiUserId();
  if (!aiUserId) {
    log.warn({ ticketId: data.id }, "auto-resolve: skipping — AI agent user not found");
    return;
  }

  const settings = await getWorkflowSettings();

  await prisma.ticket.update({
    where: { id: data.id },
    data: { status: TicketStatus.processing, assignedToId: aiUserId },
  });

  const prompt = buildDraftPrompt({
    fromName: data.fromName,
    subject: data.subject,
    body: data.body,
  });

  let text: string;
  try {
    ({ text } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      prompt,
      timeout: 30_000,
    }));
  } catch (err) {
    log.error({ err, ticketId: data.id }, "auto-resolve generateText failed");
    Sentry.captureException(err);
    await escalateToOpen(data.id, aiUserId, "ai_call_failed", settings);
    return;
  }

  let parsed: { action: string; reply: string | null; confidence: number };
  try {
    parsed = parseDraftDecision(text);
  } catch {
    log.error({ ticketId: data.id, text }, "auto-resolve: failed to parse AI response");
    Sentry.captureMessage("auto-resolve: AI response was not valid JSON", "error");
    await escalateToOpen(data.id, aiUserId, "json_parse_failure", settings);
    return;
  }

  // Decide whether to auto-resolve. Every "no" routes to Open via escalateToOpen
  // with a distinct reason. Order matters: feature switch → model decision →
  // confidence threshold → resolution gates.
  if (!settings.autoResolveOn) {
    log.info({ ticketId: data.id }, "auto-resolve: disabled by workflow settings");
    await escalateToOpen(data.id, aiUserId, "auto_resolve_disabled", settings);
    return;
  }
  if (parsed.action !== "resolve" || !parsed.reply) {
    await escalateToOpen(data.id, aiUserId, "ai_chose_escalate", settings);
    return;
  }
  if (parsed.confidence < settings.autoResolveThreshold) {
    log.info(
      {
        ticketId: data.id,
        confidence: parsed.confidence,
        threshold: settings.autoResolveThreshold,
      },
      "auto-resolve: confidence below threshold",
    );
    await escalateToOpen(data.id, aiUserId, "below_confidence_threshold", settings);
    return;
  }

  {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.id },
      select: {
        fromName: true,
        fromEmail: true,
        subject: true,
        firstAgentReplyAt: true,
        category: true,
        assignedToId: true,
      },
    });

    // Resolution gates apply to AI auto-resolve too. The AI is the assignee at
    // this point (so requireAssignee is satisfied); the meaningful check is
    // requireCategory, since the classifier runs concurrently and may not have
    // set a category yet — in that case route to a human instead of resolving.
    if (settings.requireCategory && !ticket?.category) {
      await escalateToOpen(data.id, aiUserId, "resolution_gate_category", settings);
      return;
    }
    if (settings.requireAssignee && !ticket?.assignedToId) {
      await escalateToOpen(data.id, aiUserId, "resolution_gate_assignee", settings);
      return;
    }

    const now = new Date();
    // Atomic: reply create + ticket flip + email enqueue commit together.
    // Prevents the duplicate-reply scenario where boss.send fails after the
    // reply is committed, pg-boss retries this job, and we run the AI call
    // + insert again — producing two replies for one ticket.
    await prisma.$transaction(async (tx) => {
      const reply = await tx.reply.create({
        data: {
          ticketId: data.id,
          authorId: aiUserId,
          senderType: SenderType.agent,
          body: parsed.reply!,
        },
      });
      await tx.ticket.update({
        where: { id: data.id },
        data: {
          status: TicketStatus.resolved,
          resolvedAt: now,
          lastReplySenderType: SenderType.agent,
          ...(!ticket?.firstAgentReplyAt && { firstAgentReplyAt: now }),
        },
      });
      await recordAuditEvent(tx, {
        ticketId: data.id,
        actorId: aiUserId,
        type: AuditEventType.auto_resolved,
        data: { replyId: reply.id },
      });
      if (ticket) {
        await boss.send(
          SEND_REPLY_EMAIL_QUEUE,
          {
            to: ticket.fromEmail,
            toName: ticket.fromName,
            subject: ticket.subject,
            replyBody: parsed.reply!,
            replyId: reply.id,
            _requestId: data._requestId,
          },
          { db: fromPrisma(tx) },
        );
      }
    });
  }
}

export async function autoResolveTicketWorker([job]: Job<AutoResolveJobData>[]) {
  const log = logger.child({
    reqId: job.data._requestId ?? randomUUID(),
    job: AUTO_RESOLVE_TICKET_QUEUE,
    ticketId: job.data.id,
  });
  await runAutoResolve(job.data, log);
}
