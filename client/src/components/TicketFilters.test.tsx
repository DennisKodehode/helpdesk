import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import TicketFilters from "./TicketFilters";
import { TicketStatus, TicketCategory, TicketPriority } from "@helpdesk/core";

afterEach(cleanup);

const baseProps = {
  search: "",
  status: "" as TicketStatus | "",
  category: "" as TicketCategory | "",
  priority: "" as TicketPriority | "",
  onSearchChange: vi.fn(),
  onStatusChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onPriorityChange: vi.fn(),
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
    renderWithProviders(<TicketFilters {...baseProps} onCategoryChange={onCategoryChange} />);
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
    renderWithProviders(<TicketFilters {...baseProps} onPriorityChange={onPriorityChange} />);
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
});
