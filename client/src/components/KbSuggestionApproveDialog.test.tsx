import {
  type KbSuggestion,
  KbSuggestionSource,
  KbSuggestionStatus,
  TicketCategory,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor, within } from "../test/utils";
import KbSuggestionApproveDialog from "./KbSuggestionApproveDialog";

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
beforeEach(() => vi.clearAllMocks());

function makeSuggestion(): KbSuggestion {
  return {
    id: "s1",
    source: KbSuggestionSource.ai_gap_analysis,
    status: KbSuggestionStatus.pending,
    category: TicketCategory.billing_inquiry,
    title: "Billing cycle questions",
    question: "When am I billed?",
    answer: "Monthly on signup date.",
    sourceTicketIds: [1, 2, 3],
    requestedByName: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewReason: null,
    resultArticleId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("KbSuggestionApproveDialog", () => {
  it("prefills the form from the suggestion", () => {
    renderWithProviders(
      <KbSuggestionApproveDialog
        suggestion={makeSuggestion()}
        onOpenChange={vi.fn()}
        onApproved={vi.fn()}
      />,
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByLabelText("Title")).toHaveValue("Billing cycle questions");
    expect(dialog.getByLabelText("Answer")).toHaveValue("Monthly on signup date.");
  });

  it("approves via POST and calls onApproved", async () => {
    const user = userEvent.setup();
    const onApproved = vi.fn();
    const onOpenChange = vi.fn();
    mockedAxios.post.mockResolvedValue({ data: {} });
    renderWithProviders(
      <KbSuggestionApproveDialog
        suggestion={makeSuggestion()}
        onOpenChange={onOpenChange}
        onApproved={onApproved}
      />,
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Approve & publish" }));

    await waitFor(() => expect(mockedAxios.post).toHaveBeenCalledTimes(1));
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "/api/kb-suggestions/s1/approve",
      expect.objectContaining({ title: "Billing cycle questions", status: "published" }),
    );
    expect(onApproved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks approval when a required field is emptied", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <KbSuggestionApproveDialog
        suggestion={makeSuggestion()}
        onOpenChange={vi.fn()}
        onApproved={vi.fn()}
      />,
    );
    const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Title"));
    await user.click(dialog.getByRole("button", { name: "Approve & publish" }));
    expect(
      await screen.findByText("Title must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
