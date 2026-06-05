import {
  type KbArticle,
  KbArticleSource,
  KbArticleStatus,
  TicketCategory,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import KbArticleDialog from "./KbArticleDialog";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(() => false),
  },
}));

import axios from "axios";

const mockedAxios = vi.mocked(axios);

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

function existingArticle(): KbArticle {
  return {
    id: "a1",
    title: "Refund policy",
    question: "What is the refund policy?",
    answer: "Within 30 days.",
    category: TicketCategory.refund_request,
    status: KbArticleStatus.published,
    source: KbArticleSource.seed,
    hitCount: 0,
    lastUsedAt: null,
    lastReviewedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("KbArticleDialog", () => {
  it("shows the create heading and an empty form", () => {
    renderWithProviders(
      <KbArticleDialog open onOpenChange={vi.fn()} article={null} onSaved={vi.fn()} />,
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("New article")).toBeInTheDocument();
    expect(dialog.getByLabelText("Title")).toHaveValue("");
  });

  it("validates required fields before submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <KbArticleDialog open onOpenChange={vi.fn()} article={null} onSaved={vi.fn()} />,
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Create article" }));
    expect(
      await screen.findByText("Title must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("creates an article and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    mockedAxios.post.mockResolvedValue({ data: existingArticle() });
    renderWithProviders(
      <KbArticleDialog
        open
        onOpenChange={onOpenChange}
        article={null}
        onSaved={onSaved}
      />,
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Title"), "Coupon help");
    await user.type(dialog.getByLabelText("Question / trigger"), "My coupon fails?");
    await user.type(dialog.getByLabelText("Answer"), "Check the expiry date.");
    await user.click(dialog.getByRole("button", { name: "Create article" }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "/api/kb-articles",
      expect.objectContaining({ title: "Coupon help", question: "My coupon fails?" }),
    );
    expect(onSaved).toHaveBeenCalledWith("Article created.");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("edits an existing article via PATCH", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockedAxios.patch.mockResolvedValue({ data: existingArticle() });
    renderWithProviders(
      <KbArticleDialog
        open
        onOpenChange={vi.fn()}
        article={existingArticle()}
        onSaved={onSaved}
      />,
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Edit article")).toBeInTheDocument();
    expect(dialog.getByLabelText("Title")).toHaveValue("Refund policy");

    await user.clear(dialog.getByLabelText("Title"));
    await user.type(dialog.getByLabelText("Title"), "Refund policy v2");
    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledTimes(1));
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "/api/kb-articles/a1",
      expect.objectContaining({ title: "Refund policy v2" }),
    );
    expect(onSaved).toHaveBeenCalledWith("Article updated.");
  });
});
