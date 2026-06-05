import { KbArticleStatus } from "@helpdesk/core";
// TicketCategory here is the Prisma-generated string-literal union (not core's
// TS enum): this is a DB helper, and every caller reads `category` straight off
// a Prisma query, so typing the param to match avoids a nominal-enum mismatch.
import type { KbArticle, TicketCategory } from "../generated/prisma/client";
import { prisma } from "./prisma";

// THE RETRIEVAL SEAM. Every AI draft path goes through this one function to
// decide which knowledge-base articles to ground the model on. Phase 1 filters
// by the ticket's classified category; a future pgvector phase reimplements ONLY
// this function (cosine-KNN top-K) — buildDraftPrompt and its callers stay put.
//
// - category set   → published articles in that category PLUS general (null)
//                    articles, which are always relevant.
// - category null  → ticket not yet classified (the classifier runs
//                    concurrently with auto-resolve). Fall back to the full
//                    published set — the safe superset, matching the legacy
//                    full-dump behavior — rather than risk missing the right
//                    article.
export async function getRelevantArticles(
  category: TicketCategory | null,
): Promise<KbArticle[]> {
  if (category == null) {
    return prisma.kbArticle.findMany({
      where: { status: KbArticleStatus.published },
      orderBy: { hitCount: "desc" },
    });
  }
  return prisma.kbArticle.findMany({
    where: {
      status: KbArticleStatus.published,
      OR: [{ category }, { category: null }],
    },
    orderBy: { hitCount: "desc" },
  });
}

// Renders the selected articles into the text block injected into the draft
// prompt. Mirrors the old knowledge-base.md Q/A shape so the prompt contract is
// unchanged. Returns an empty string when there are no articles — the prompt's
// escalation rules then make the AI escalate rather than invent an answer.
export function renderCorpus(articles: KbArticle[]): string {
  return articles
    .map((a) => `### ${a.title}\nQ: ${a.question}\n${a.answer}`)
    .join("\n\n------\n\n");
}

// Best-effort usage tracking. Fire-and-forget from the draft paths — never
// awaited inside a resolve transaction, so AI-usage bookkeeping can never block
// or roll back ticket state. Errors are logged by the caller's .catch.
export async function recordArticleHits(articleIds: string[]): Promise<void> {
  if (articleIds.length === 0) return;
  await prisma.kbArticle.updateMany({
    where: { id: { in: articleIds } },
    data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}
