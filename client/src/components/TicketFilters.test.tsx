import { TicketCategory, TicketPriority, TicketStatus } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import TicketFilters from "./TicketFilters";

afterEach(cleanup);

const baseProps = {
  search: "",
  status: "" as TicketStatus | "",
  category: "" as TicketCategory | "",
  priority: "" as TicketPriority | "",
  breachedOnly: false,
  onSearchChange: vi.fn(),
  onStatusChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onBreachedOnlyChange: vi.fn(),
};

describe("TicketFilters", () => {
  it("renders the search input and all three comboboxes", () => {
    renderWithProviders(<TicketFilters {...baseProps} />);
    expect(screen.getByRole("textbox", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /priority/i })).toBeInTheDocument();
  });

  it("calls onStatusChange with the selected value when a status option is chosen", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TicketFilters {...baseProps} onStatusChange={onStatusChange} />);
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: /^open$/i }));
    expect(onStatusChange).toHaveBeenCalledWith(TicketStatus.open);
  });

  it("calls onCategoryChange with the selected value when a category option is chosen", async () => {
    const onCategoryChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters {...baseProps} onCategoryChange={onCategoryChange} />,
    );
    await user.click(screen.getByRole("combobox", { name: /category/i }));
    await user.click(await screen.findByRole("option", { name: /technical/i }));
    expect(onCategoryChange).toHaveBeenCalledWith(TicketCategory.technical_question);
  });

  it("calls onStatusChange with 'triaging' when the Triaging option is chosen", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TicketFilters {...baseProps} onStatusChange={onStatusChange} />);
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: /^triaging$/i }));
    expect(onStatusChange).toHaveBeenCalledWith("triaging");
  });

  it("calls onPriorityChange with the selected value when a priority option is chosen", async () => {
    const onPriorityChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters {...baseProps} onPriorityChange={onPriorityChange} />,
    );
    await user.click(screen.getByRole("combobox", { name: /priority/i }));
    await user.click(await screen.findByRole("option", { name: /^urgent$/i }));
    expect(onPriorityChange).toHaveBeenCalledWith(TicketPriority.urgent);
  });

  it("calls onSearchChange when text is typed in the search input", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TicketFilters {...baseProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByRole("textbox", { name: /search/i }), "Alice");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("renders the Breached-only toggle in its unpressed default state", () => {
    renderWithProviders(<TicketFilters {...baseProps} />);
    const toggle = screen.getByRole("button", { name: /breached/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects the breachedOnly prop in the aria-pressed state", () => {
    renderWithProviders(<TicketFilters {...baseProps} breachedOnly={true} />);
    const toggle = screen.getByRole("button", { name: /breached/i });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onBreachedOnlyChange(true) when the toggle is clicked while unpressed", async () => {
    const onBreachedOnlyChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters {...baseProps} onBreachedOnlyChange={onBreachedOnlyChange} />,
    );
    await user.click(screen.getByRole("button", { name: /breached/i }));
    // base-ui's Toggle passes (pressed, eventDetails) — only the first arg
    // matters to us.
    expect(onBreachedOnlyChange).toHaveBeenCalled();
    expect(onBreachedOnlyChange.mock.calls[0][0]).toBe(true);
  });

  it("calls onBreachedOnlyChange(false) when the toggle is clicked while pressed", async () => {
    const onBreachedOnlyChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters
        {...baseProps}
        breachedOnly={true}
        onBreachedOnlyChange={onBreachedOnlyChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: /breached/i }));
    expect(onBreachedOnlyChange).toHaveBeenCalled();
    expect(onBreachedOnlyChange.mock.calls[0][0]).toBe(false);
  });
});
