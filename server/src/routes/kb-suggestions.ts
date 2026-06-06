import {
  AdminAuditEventType,
  approveKbSuggestionSchema,
  KbArticleSource,
  KbSuggestionStatus,
  rejectKbSuggestionSchema,
} from "@helpdesk/core";
import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { recordAdminAuditEvent } from "../lib/admin-audit";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain } from "../middleware/auth-middleware";

const router = Router();

const withReviewers = {
  requestedBy: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} satisfies Prisma.KbSuggestionInclude;

type SuggestionRow = Prisma.KbSuggestionGetPayload<{ include: typeof withReviewers }>;

function toResponse(row: SuggestionRow) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    category: row.category,
    title: row.title,
    question: row.question,
    answer: row.answer,
    sourceTicketIds: (row.sourceTicketIds as number[] | null) ?? null,
    requestedByName: row.requestedBy?.name ?? null,
    reviewedByName: row.reviewedBy?.name ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewReason: row.reviewReason,
    resultArticleId: row.resultArticleId,
    createdAt: row.createdAt.toISOString(),
  };
}

// Admin-only approval queue. Default lists pending; `?status=` narrows.
router.get("/", ...requireAdminChain, async (req, res) => {
  const statusParam = req.query.status as string | undefined;
  const status =
    statusParam && (Object.values(KbSuggestionStatus) as string[]).includes(statusParam)
      ? (statusParam as KbSuggestionStatus)
      : undefined;
  const rows = await prisma.kbSuggestion.findMany({
    where: status ? { status } : undefined,
    include: withReviewers,
    orderBy: { createdAt: "desc" },
  });
  res.json(rows.map(toResponse));
});

// Lightweight count for the nav badge — avoids shipping the full list app-wide.
router.get("/count", ...requireAdminChain, async (_req, res) => {
  const pending = await prisma.kbSuggestion.count({
    where: { status: KbSuggestionStatus.pending },
  });
  res.json({ pending });
});

router.post("/:id/approve", ...requireAdminChain, async (req, res) => {
  const id = String(req.params.id);
  const result = approveKbSuggestionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const existing = await prisma.kbSuggestion.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Suggestion not found" });
    return;
  }
  if (existing.status !== KbSuggestionStatus.pending) {
    res.status(409).json({ error: "This suggestion has already been reviewed." });
    return;
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    // Approval is the security boundary: only here does an AI/agent draft become
    // a published (or draft) article.
    // Destructure explicitly rather than spreading result.data so widening the
    // approve schema later can't silently forward unintended columns (source/
    // authorId/lastReviewedAt stay server-controlled). Defense-in-depth: this
    // route is admin-only.
    const article = await tx.kbArticle.create({
      data: {
        title: result.data.title,
        question: result.data.question,
        answer: result.data.answer,
        category: result.data.category,
        status: result.data.status,
        source: KbArticleSource.ai_suggested,
        authorId: req.user!.id,
        lastReviewedAt: now,
      },
    });
    const row = await tx.kbSuggestion.update({
      where: { id },
      data: {
        status: KbSuggestionStatus.approved,
        reviewedById: req.user!.id,
        reviewedAt: now,
        resultArticleId: article.id,
      },
      include: withReviewers,
    });
    await recordAdminAuditEvent(tx, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      type: AdminAuditEventType.kb_suggestion_approved,
      targetName: result.data.title,
      data: { suggestionId: id, articleId: article.id },
    });
    return row;
  });
  res.json(toResponse(updated));
});

router.post("/:id/reject", ...requireAdminChain, async (req, res) => {
  const id = String(req.params.id);
  const result = rejectKbSuggestionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const existing = await prisma.kbSuggestion.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Suggestion not found" });
    return;
  }
  if (existing.status !== KbSuggestionStatus.pending) {
    res.status(409).json({ error: "This suggestion has already been reviewed." });
    return;
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.kbSuggestion.update({
      where: { id },
      data: {
        status: KbSuggestionStatus.rejected,
        reviewedById: req.user!.id,
        reviewedAt: now,
        reviewReason: result.data.reason ?? null,
      },
      include: withReviewers,
    });
    await recordAdminAuditEvent(tx, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      type: AdminAuditEventType.kb_suggestion_rejected,
      targetName: existing.title,
      data: { suggestionId: id, reason: result.data.reason ?? null },
    });
    return row;
  });
  res.json(toResponse(updated));
});

export default router;
