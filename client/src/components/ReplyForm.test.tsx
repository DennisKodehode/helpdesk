import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import ReplyForm from "./ReplyForm";

vi.mock("axios", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), isAxiosError: vi.fn() },
}));

afterEach(cleanup);

describe("ReplyForm", () => {
  it("renders a textarea and submit button", () => {
    renderWithProviders(<ReplyForm ticketId="42" />);
    expect(screen.getByRole("textbox", { name: /reply body/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
  });

  it("shows a validation error when submitted empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.click(screen.getByRole("button", { name: /send reply/i }));

    expect(await screen.findByText(/reply cannot be empty/i)).toBeInTheDocument();
  });

  it("calls POST /api/tickets/:id/replies with the body", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "Hello there.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/tickets/42/replies", { body: "Hello there." });
    });
  });

  it("clears the textarea after a successful submission", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const textarea = screen.getByRole("textbox", { name: /reply body/i });
    await user.type(textarea, "Cleared.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });
});
