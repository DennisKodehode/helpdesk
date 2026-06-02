import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderWithProviders, screen } from "../test/utils";
import { TicketRef } from "./TicketRef";

afterEach(cleanup);

describe("TicketRef", () => {
  it("renders a zero-padded case number linking to the ticket", () => {
    renderWithProviders(<TicketRef id={42} />);
    const link = screen.getByRole("link", { name: "#0042" });
    expect(link).toHaveAttribute("href", "/tickets/42");
  });

  it("pads short ids to four digits", () => {
    renderWithProviders(<TicketRef id={7} />);
    expect(screen.getByRole("link", { name: "#0007" })).toBeInTheDocument();
  });
});
