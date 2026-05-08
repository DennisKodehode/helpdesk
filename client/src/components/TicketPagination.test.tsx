import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import TicketPagination from "./TicketPagination";

afterEach(cleanup);

function renderPagination(overrides: Partial<Parameters<typeof TicketPagination>[0]> = {}) {
  const defaults = {
    page: 1,
    totalPages: 3,
    start: 1,
    end: 10,
    total: 25,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  };
  return renderWithProviders(<TicketPagination {...defaults} {...overrides} />);
}

describe("TicketPagination", () => {
  it("renders Previous and Next buttons and the page count", () => {
    renderPagination({ page: 2, totalPages: 3 });
    expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    renderPagination({ page: 1 });
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
  });

  it("disables Next on the last page", () => {
    renderPagination({ page: 3, totalPages: 3 });
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("calls onPrevious when Previous is clicked", async () => {
    const onPrevious = vi.fn();
    const user = userEvent.setup();
    renderPagination({ page: 2, onPrevious });
    await user.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("calls onNext when Next is clicked", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderPagination({ page: 1, onNext });
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows the record count when total > 0", () => {
    renderPagination({ start: 11, end: 20, total: 25 });
    expect(screen.getByText("11–20 of 25")).toBeInTheDocument();
  });

  it("shows no record count when total is 0", () => {
    renderPagination({ start: 0, end: 0, total: 0 });
    expect(screen.queryByText(/–.*of/)).not.toBeInTheDocument();
  });
});
