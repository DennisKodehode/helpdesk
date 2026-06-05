import {
  type KbSuggestion,
  KbSuggestionSource,
  KbSuggestionStatus,
  TicketCategory,
} from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, within } from "../test/utils";
import KbSuggestionTable from "./KbSuggestionTable";

afterEach(cleanup);

function makeSuggestion(overrides: Partial<KbSuggestion> = {}): KbSuggestion {
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
    ...overrides,
  };
}

const noop = () => {};

function render(props: Partial<React.ComponentProps<typeof KbSuggestionTable>> = {}) {
  return renderWithProviders(
    <KbSuggestionTable
      suggestions={[makeSuggestion()]}
      isPending={false}
      isError={false}
      onApprove={noop}
      onReject={noop}
      {...props}
    />,
  );
}

describe("KbSuggestionTable", () => {
  it("renders an empty state", () => {
    render({ suggestions: [] });
    expect(screen.getByText("No suggestions waiting.")).toBeInTheDocument();
  });

  it("renders an error state", () => {
    render({ isError: true });
    expect(screen.getByText("Failed to load suggestions")).toBeInTheDocument();
  });

  it("renders suggestion fields and ticket count", () => {
    const table = () => within(screen.getByRole("table"));
    render();
    expect(table().getByText("Billing cycle questions")).toBeInTheDocument();
    expect(table().getByText("Billing")).toBeInTheDocument();
    expect(table().getByText("AI")).toBeInTheDocument();
    expect(table().getByText("3")).toBeInTheDocument();
  });

  it("shows the requester name for an agent-sourced suggestion", () => {
    const table = () => within(screen.getByRole("table"));
    render({
      suggestions: [
        makeSuggestion({ source: KbSuggestionSource.agent, requestedByName: "Dana" }),
      ],
    });
    expect(table().getByText("Dana")).toBeInTheDocument();
  });

  it("fires onApprove and onReject", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const s = makeSuggestion();
    render({ suggestions: [s], onApprove, onReject });
    const table = () => within(screen.getByRole("table"));

    await user.click(table().getByRole("button", { name: "Review" }));
    expect(onApprove).toHaveBeenCalledWith(s);

    await user.click(table().getByLabelText("Reject Billing cycle questions"));
    expect(onReject).toHaveBeenCalledWith(s);
  });
});
