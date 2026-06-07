import { fireEvent } from "@testing-library/react";
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

  it("calls POST /api/tickets/:id/replies with a FormData containing body and isInternal=false by default", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "Hello there.");
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
    const [url, fd] = vi.mocked(axios.post).mock.calls[0];
    expect(url).toBe("/api/tickets/42/replies");
    expect(fd).toBeInstanceOf(FormData);
    expect((fd as FormData).get("body")).toBe("Hello there.");
    expect((fd as FormData).get("isInternal")).toBe("false");
    expect((fd as FormData).getAll("files")).toEqual([]);
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

  // Full PolishReplyResponse shape the endpoint now returns. The result card
  // reads confidence + sources, so a partial mock would crash the render.
  const polishData = (overrides: Record<string, unknown> = {}) => ({
    body: "Polished reply.",
    confidence: 88,
    changeSummary: "Tightened the tone and added a sign-off.",
    sources: [] as { id: string; title: string }[],
    ...overrides,
  });

  it("calls POST /api/tickets/:id/polish-reply when Polish is clicked", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: polishData() });
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

  it("shows the polished result in a card with a confidence pill and cited sources", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: polishData({
        body: "Hi Dana, refunds are available within 30 days.",
        confidence: 91,
        sources: [{ id: "kb1", title: "Refund window policy" }],
      }),
    });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    expect(
      await screen.findByText("Hi Dana, refunds are available within 30 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "SPAN" && el.textContent === "High · 91%",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Refund window policy")).toBeInTheDocument();
    // The card is a preview — the textarea keeps the agent's original draft.
    expect(screen.getByRole("textbox", { name: /reply body/i })).toHaveValue("draft");
    // Single apply action — no redundant "use & edit" variant.
    expect(screen.getByRole("button", { name: /use this reply/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /use & edit/i })).not.toBeInTheDocument();
  });

  it("applies the draft, dismisses the card, and shows the Polished badge after Use this reply", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: polishData({ body: "Polished reply." }),
    });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish with ai/i }));
    await user.click(await screen.findByRole("button", { name: /use this reply/i }));

    expect(screen.getByRole("textbox", { name: /reply body/i })).toHaveValue(
      "Polished reply.",
    );
    // Card is gone and the composer marks the reply as AI-polished.
    expect(
      screen.queryByRole("button", { name: /use this reply/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Polished")).toBeInTheDocument();
  });

  it("shows an error alert when Polish fails", async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("refines the card's draft in place via the Refine disclosure", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: polishData({ body: "First polished draft." }),
    });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "draft");
    await user.click(screen.getByRole("button", { name: /polish with ai/i }));
    expect(await screen.findByText("First polished draft.")).toBeInTheDocument();

    // The note field is hidden until the disclosure is opened.
    expect(
      screen.queryByRole("textbox", { name: /what should change/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^refine$/i }));

    const note = screen.getByRole("textbox", { name: /what should change/i });
    // "Refine draft" stays disabled until there's a note to act on.
    expect(screen.getByRole("button", { name: /refine draft/i })).toBeDisabled();
    await user.type(note, "too formal, shorten it");

    vi.mocked(axios.post).mockResolvedValueOnce({
      data: polishData({ body: "Shorter, friendlier draft." }),
    });
    await user.click(screen.getByRole("button", { name: /refine draft/i }));

    // Refine re-polishes the card's *current* draft plus the note.
    await waitFor(() => {
      expect(axios.post).toHaveBeenLastCalledWith("/api/tickets/42/polish-reply", {
        body: "First polished draft.",
        refinementNote: "too formal, shorten it",
      });
    });
    expect(await screen.findByText("Shorter, friendlier draft.")).toBeInTheDocument();
  });

  it("removes the Polished badge when the composer is cleared after applying", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: polishData() });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const replyTextarea = screen.getByRole("textbox", { name: /reply body/i });
    await user.type(replyTextarea, "draft");
    await user.click(screen.getByRole("button", { name: /polish with ai/i }));
    await user.click(await screen.findByRole("button", { name: /use this reply/i }));

    expect(screen.getByText("Polished")).toBeInTheDocument();

    await user.clear(replyTextarea);

    await waitFor(() => {
      expect(screen.queryByText("Polished")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /polish with ai/i })).toBeInTheDocument();
  });

  it("toggling to Internal note swaps the submit label and hides Polish", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.click(screen.getByRole("tab", { name: /internal note/i }));

    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /polish with ai/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send reply/i })).not.toBeInTheDocument();
  });

  it("submits with isInternal=true when Internal note is active", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.click(screen.getByRole("tab", { name: /internal note/i }));
    await user.type(
      screen.getByRole("textbox", { name: /internal note body/i }),
      "Called the customer yesterday.",
    );
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
    const [, fd] = vi.mocked(axios.post).mock.calls[0];
    expect((fd as FormData).get("body")).toBe("Called the customer yesterday.");
    expect((fd as FormData).get("isInternal")).toBe("true");
  });

  it("toggling back to Reply to customer restores Send reply and Polish", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.click(screen.getByRole("tab", { name: /internal note/i }));
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /reply to customer/i }));

    expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /polish with ai/i })).toBeInTheDocument();
  });

  it("shows a chip with filename and size after a valid file is picked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(2048)], "screenshot.png", {
      type: "image/png",
    });
    await user.upload(fileInput, file);

    const list = await screen.findByRole("list", { name: /attached files/i });
    expect(list).toHaveTextContent("screenshot.png");
    expect(list).toHaveTextContent("2 KB");
  });

  it("rejects a file with disallowed MIME and shows an inline error", async () => {
    renderWithProviders(<ReplyForm ticketId="42" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["<svg/>"], "evil.svg", { type: "image/svg+xml" });
    // fireEvent.change bypasses userEvent's `accept`-attribute filter so the
    // server-mirrored validation in addFiles is what actually runs.
    fireEvent.change(fileInput, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/evil\.svg/);
    expect(alert.textContent).toMatch(/not allowed/i);
    expect(
      screen.queryByRole("list", { name: /attached files/i }),
    ).not.toBeInTheDocument();
  });

  it("rejects a file larger than 10 MB and shows an inline error", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    await user.upload(fileInput, big);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/big\.png/);
    expect(alert.textContent).toMatch(/10 MB/i);
  });

  it("removes a chip when × is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, [
      new File(["a"], "first.png", { type: "image/png" }),
      new File(["bb"], "second.png", { type: "image/png" }),
    ]);

    const list = await screen.findByRole("list", { name: /attached files/i });
    expect(list).toHaveTextContent("first.png");
    expect(list).toHaveTextContent("second.png");

    await user.click(screen.getByRole("button", { name: /remove first\.png/i }));

    const updated = await screen.findByRole("list", { name: /attached files/i });
    expect(updated).not.toHaveTextContent("first.png");
    expect(updated).toHaveTextContent("second.png");
  });

  it("submits multipart with picked files appended to FormData", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(
      screen.getByRole("textbox", { name: /reply body/i }),
      "Here is your fix.",
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(512)], "fix.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
    const [, fd] = vi.mocked(axios.post).mock.calls[0];
    expect(fd).toBeInstanceOf(FormData);
    expect((fd as FormData).get("body")).toBe("Here is your fix.");
    expect((fd as FormData).getAll("files")).toHaveLength(1);
    const sent = (fd as FormData).get("files");
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("fix.png");
  });

  it("clears all chips on successful submit", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    await user.type(screen.getByRole("textbox", { name: /reply body/i }), "Done");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["a"], "a.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: /send reply/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("list", { name: /attached files/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("caps picking at 5 files and surfaces a message", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ReplyForm ticketId="42" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const six = Array.from(
      { length: 6 },
      (_, i) => new File([String(i)], `f${i}.png`, { type: "image/png" }),
    );
    await user.upload(fileInput, six);

    const list = await screen.findByRole("list", { name: /attached files/i });
    expect(list.querySelectorAll("li")).toHaveLength(5);
    expect(await screen.findByText(/5 max per reply/i)).toBeInTheDocument();
  });
});
