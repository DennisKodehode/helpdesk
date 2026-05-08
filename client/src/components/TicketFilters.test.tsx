import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import TicketFilters from "./TicketFilters";
import { TicketStatus, TicketCategory } from "@helpdesk/core";

afterEach(cleanup);

describe("TicketFilters", () => {
  it("renders the search input, status combobox, and category combobox", () => {
    renderWithProviders(
      <TicketFilters
        search=""
        status=""
        category=""
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onCategoryChange={vi.fn()}
      />
    );
    expect(screen.getByRole("textbox", { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /category/i })).toBeInTheDocument();
  });

  it("calls onStatusChange with the selected value when a status option is chosen", async () => {
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters
        search=""
        status=""
        category=""
        onSearchChange={vi.fn()}
        onStatusChange={onStatusChange}
        onCategoryChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    await user.click(await screen.findByRole("option", { name: /^open$/i }));
    expect(onStatusChange).toHaveBeenCalledWith(TicketStatus.open);
  });

  it("calls onCategoryChange with the selected value when a category option is chosen", async () => {
    const onCategoryChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters
        search=""
        status=""
        category=""
        onSearchChange={vi.fn()}
        onStatusChange={vi.fn()}
        onCategoryChange={onCategoryChange}
      />
    );
    await user.click(screen.getByRole("combobox", { name: /category/i }));
    await user.click(await screen.findByRole("option", { name: /technical/i }));
    expect(onCategoryChange).toHaveBeenCalledWith(TicketCategory.technical_question);
  });

  it("calls onSearchChange when text is typed in the search input", async () => {
    const onSearchChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TicketFilters
        search=""
        status=""
        category=""
        onSearchChange={onSearchChange}
        onStatusChange={vi.fn()}
        onCategoryChange={vi.fn()}
      />
    );
    await user.type(screen.getByRole("textbox", { name: /search/i }), "Alice");
    expect(onSearchChange).toHaveBeenCalled();
  });
});
