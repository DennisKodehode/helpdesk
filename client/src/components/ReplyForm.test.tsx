import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import ReplyForm from "./ReplyForm";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe("ReplyForm", () => {
  it("renders a textarea, Polish button, and Send Reply button", () => {
    renderWithProviders(<ReplyForm ticketId="42" />);
    expect(screen.getByRole("textbox", { name: /reply body/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /polish/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
  });

  it("disables Send Reply and Polish buttons when the textarea is empty", () => {
    renderWithProviders(<ReplyForm ticketId="42" />);
    expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /polish/i })).toBeDisabled();
  });

  it("calls POST /api/tickets/:id/replies with the body", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "Hello there.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/tickets/42/replies", {
        body: "Hello there.",
      });
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

  it("calls POST /api/tickets/:id/polish-reply when Polish is clicked", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { body: "Polished." } });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/tickets/42/polish-reply", {
        body: "draft",
      });
    });
  });

  it("updates the textarea with polished text and shows Refine button", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { body: "Polished reply." } });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /reply body/i })).toHaveValue(
        "Polished reply.",
      );
    });
    expect(screen.getByRole("button", { name: /refine/i })).toBeInTheDocument();
  });

  it("shows an error alert when Polish fails", async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("disables Refine button when refinement note is empty", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { body: "Polished." } });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refine/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /refine/i })).toBeDisabled();
  });

  it("hides the refine box and restores the Polish button when the reply textarea is cleared after polishing", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { body: "Polished." } });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const replyTextarea = screen.getByRole("textbox", { name: /reply body/i });
    await user.type(replyTextarea, "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: /refinement note/i }),
      ).toBeInTheDocument();
    });

    await user.clear(replyTextarea);

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: /refinement note/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /polish/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /refine/i })).not.toBeInTheDocument();
  });

  it("also resets polished mode when the reply textarea contains only whitespace", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { body: "Polished." } });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const replyTextarea = screen.getByRole("textbox", { name: /reply body/i });
    await user.type(replyTextarea, "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: /refinement note/i }),
      ).toBeInTheDocument();
    });

    await user.clear(replyTextarea);
    await user.type(replyTextarea, "   ");

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: /refinement note/i }),
      ).not.toBeInTheDocument();
    });
  });
});
