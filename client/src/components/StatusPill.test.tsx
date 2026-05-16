import { TicketStatus } from "@helpdesk/core";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import StatusPill from "./StatusPill";

afterEach(cleanup);

describe("StatusPill", () => {
  it("renders 'Triaging' for new tickets", () => {
    renderWithProviders(<StatusPill status={TicketStatus.new} />);
    expect(screen.getByText("Triaging")).toBeInTheDocument();
  });

  it("renders 'Triaging' for processing tickets", () => {
    renderWithProviders(<StatusPill status={TicketStatus.processing} />);
    expect(screen.getByText("Triaging")).toBeInTheDocument();
  });

  it("renders the normal label for open tickets", () => {
    renderWithProviders(<StatusPill status={TicketStatus.open} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("Triaging")).not.toBeInTheDocument();
  });

  it("renders the normal label for resolved tickets", () => {
    renderWithProviders(<StatusPill status={TicketStatus.resolved} />);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });
});
