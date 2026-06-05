import {
  AdminAuditEventType,
  createKbArticleSchema,
  KbArticleSource,
  KbArticleStatus,
  TicketCategory,
  updateKbArticleSchema,
} from "@helpdesk/core";
import { Router } from "express";
import type { KbArticle } from "../generated/prisma/client";
import { recordAdminAuditEvent } from "../lib/admin-audit";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain } from "../middleware/auth-middleware";

const router = Router();

function toResponse(row: KbArticle) {
  return {
    id: row.id,
    title: row.title,
    question: row.question,
    answer: row.answer,
    category: row.category,
    status: row.status,
    source: row.source,
    hitCount: row.hitCount,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// The whole KB surface is admin-only: agents consult the KB indirectly through
// the AI draft paths, not through a browse/edit UI. Optional `status`/`category`
// query filters narrow the list; unknown values are ignored (no 400).
router.get("/", ...requireAdminChain, async (req, res) => {
  const statusParam = req.query.status as string | undefined;
  const categoryParam = req.query.category as string | undefined;
  const status =
    statusParam && (Object.values(KbArticleStatus) as string[]).includes(statusParam)
      ? (statusParam as KbArticleStatus)
      : undefined;
  const category =
    categoryParam && (Object.values(TicketCategory) as string[]).includes(categoryParam)
      ? (categoryParam as TicketCategory)
      : undefined;

  const rows = await prisma.kbArticle.findMany({
    where: { ...(status && { status }), ...(category && { category }) },
    orderBy: [{ updatedAt: "desc" }],
  });
  res.json(rows.map(toResponse));
});

router.post("/", ...requireAdminChain, async (req, res) => {
  const result = createKbArticleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.kbArticle.create({
      data: {
        ...result.data,
        source: KbArticleSource.manual,
        authorId: req.user!.id,
        // Authoring it is reviewing it.
        lastReviewedAt: now,
      },
    });
    await recordAdminAuditEvent(tx, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      type: AdminAuditEventType.kb_article_created,
      targetName: row.title,
      data: { id: row.id, status: row.status, category: row.category },
    });
    return row;
  });
  res.status(201).json(toResponse(created));
});

router.patch("/:id", ...requireAdminChain, async (req, res) => {
  const id = String(req.params.id);
  const result = updateKbArticleSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const existing = await prisma.kbArticle.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.kbArticle.update({
      where: { id },
      // Any admin edit re-stamps the review date — it's been vetted just now.
      data: { ...result.data, lastReviewedAt: new Date() },
    });
    // Per-field before/after diff (only the fields the PATCH actually changed).
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(result.data)) {
      const prev = (existing as Record<string, unknown>)[key];
      if (prev !== value) changed[key] = { before: prev, after: value };
    }
    if (Object.keys(changed).length > 0) {
      await recordAdminAuditEvent(tx, {
        actorId: req.user!.id,
        actorName: req.user!.name,
        type: AdminAuditEventType.kb_article_updated,
        targetName: row.title,
        data: { id: row.id, changed },
      });
    }
    return row;
  });
  res.json(toResponse(updated));
});

router.delete("/:id", ...requireAdminChain, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.kbArticle.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Article not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.kbArticle.delete({ where: { id } });
    await recordAdminAuditEvent(tx, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      type: AdminAuditEventType.kb_article_deleted,
      targetName: existing.title,
      data: { id: existing.id },
    });
  });
  res.status(204).end();
});

export default router;
