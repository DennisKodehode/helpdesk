import { KbArticleStatus, TicketCategory } from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import { getRelevantArticles, renderCorpus } from "./kb-corpus";
import { prisma } from "./prisma";

describe("kb-corpus", () => {
  const createdIds: string[] = [];

  async function makeArticle(opts: {
    title: string;
    category: TicketCategory | null;
    status: KbArticleStatus;
  }) {
    const row = await prisma.kbArticle.create({
      data: {
        title: opts.title,
        question: `${opts.title}?`,
        answer: `Answer for ${opts.title}`,
        category: opts.category,
        status: opts.status,
      },
    });
    createdIds.push(row.id);
    return row;
  }

  afterEach(async () => {
    await prisma.kbArticle.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  });

  describe("getRelevantArticles", () => {
    it("includes the matched category and general (null) articles, excludes other categories", async () => {
      const billing = await makeArticle({
        title: "Billing pub",
        category: TicketCategory.billing_inquiry,
        status: KbArticleStatus.published,
      });
      const general = await makeArticle({
        title: "General pub",
        category: null,
        status: KbArticleStatus.published,
      });
      const technical = await makeArticle({
        title: "Technical pub",
        category: TicketCategory.technical_question,
        status: KbArticleStatus.published,
      });

      const result = await getRelevantArticles(TicketCategory.billing_inquiry);
      const ids = result.map((a) => a.id);
      expect(ids).toContain(billing.id);
      expect(ids).toContain(general.id);
      expect(ids).not.toContain(technical.id);
    });

    it("excludes non-published articles", async () => {
      const draft = await makeArticle({
        title: "Billing draft",
        category: TicketCategory.billing_inquiry,
        status: KbArticleStatus.draft,
      });
      const archived = await makeArticle({
        title: "Billing archived",
        category: TicketCategory.billing_inquiry,
        status: KbArticleStatus.archived,
      });

      const result = await getRelevantArticles(TicketCategory.billing_inquiry);
      const ids = result.map((a) => a.id);
      expect(ids).not.toContain(draft.id);
      expect(ids).not.toContain(archived.id);
    });

    it("falls back to the full published set when category is null", async () => {
      const billing = await makeArticle({
        title: "Billing pub2",
        category: TicketCategory.billing_inquiry,
        status: KbArticleStatus.published,
      });
      const technical = await makeArticle({
        title: "Technical pub2",
        category: TicketCategory.technical_question,
        status: KbArticleStatus.published,
      });
      const draft = await makeArticle({
        title: "Draft pub2",
        category: null,
        status: KbArticleStatus.draft,
      });

      const result = await getRelevantArticles(null);
      const ids = result.map((a) => a.id);
      expect(ids).toContain(billing.id);
      expect(ids).toContain(technical.id);
      // still only published
      expect(ids).not.toContain(draft.id);
    });
  });

  describe("renderCorpus", () => {
    it("renders Q/A blocks and returns empty string for no articles", () => {
      expect(renderCorpus([])).toBe("");
      const article = {
        title: "Refunds",
        question: "How do refunds work?",
        answer: "Within 30 days.",
      } as Parameters<typeof renderCorpus>[0][number];
      const out = renderCorpus([article]);
      expect(out).toContain("### Refunds");
      expect(out).toContain("Q: How do refunds work?");
      expect(out).toContain("Within 30 days.");
    });
  });
});
