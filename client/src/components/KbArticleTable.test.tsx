import {
  type KbArticle,
  KbArticleSource,
  KbArticleStatus,
  TicketCategory,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, within } from "../test/utils";
import KbArticleTable from "./KbArticleTable";

afterEach(cleanup);

function makeArticle(overrides: Partial<KbArticle> = {}): KbArticle {
  return {
    id: "a1",
    title: "Refund policy",
    question: "What is the refund policy?",
    answer: "Within 30 days.",
    category: TicketCategory.refund_request,
    status: KbArticleStatus.published,
    source: KbArticleSource.seed,
    hitCount: 7,
    lastUsedAt: null,
    lastReviewedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

function renderTable(props: Partial<React.ComponentProps<typeof KbArticleTable>> = {}) {
  return renderWithProviders(
    <KbArticleTable
      articles={[makeArticle()]}
      isPending={false}
      isError={false}
      onEdit={noop}
      onArchiveToggle={noop}
      onDelete={noop}
      {...props}
    />,
  );
}

describe("KbArticleTable", () => {
  it("renders an error state", () => {
    renderTable({ isError: true });
    expect(screen.getByText("Failed to load the knowledge base")).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    renderTable({ articles: [] });
    expect(screen.getAllByText("No articles match this view.").length).toBeGreaterThan(0);
  });

  it("renders article fields (title, category, status, source, hits)", () => {
    const table = () => within(screen.getByRole("table"));
    renderTable();
    expect(table().getByText("Refund policy")).toBeInTheDocument();
    expect(table().getByText("Refund")).toBeInTheDocument();
    expect(table().getByText("published")).toBeInTheDocument();
    expect(table().getByText("Seed")).toBeInTheDocument();
    expect(table().getByText("7")).toBeInTheDocument();
  });

  it("renders 'General' for a null-category article", () => {
    const table = () => within(screen.getByRole("table"));
    renderTable({ articles: [makeArticle({ category: null })] });
    expect(table().getByText("General")).toBeInTheDocument();
  });

  it("fires onEdit, onArchiveToggle, and onDelete from the row actions", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onArchiveToggle = vi.fn();
    const onDelete = vi.fn();
    const article = makeArticle();
    renderTable({ articles: [article], onEdit, onArchiveToggle, onDelete });
    const table = () => within(screen.getByRole("table"));

    await user.click(table().getByLabelText("Edit Refund policy"));
    expect(onEdit).toHaveBeenCalledWith(article);

    await user.click(table().getByLabelText("Archive Refund policy"));
    expect(onArchiveToggle).toHaveBeenCalledWith(article);

    await user.click(table().getByLabelText("Delete Refund policy"));
    expect(onDelete).toHaveBeenCalledWith(article);
  });

  it("shows a Restore action for an archived article", () => {
    const table = () => within(screen.getByRole("table"));
    renderTable({ articles: [makeArticle({ status: KbArticleStatus.archived })] });
    expect(table().getByLabelText("Restore Refund policy")).toBeInTheDocument();
  });
});
