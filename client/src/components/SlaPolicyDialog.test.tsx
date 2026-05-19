import { type SlaPolicy, TicketPriority } from "@helpdesk/core";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../test/utils";
import SlaPolicyDialog from "./SlaPolicyDialog";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const URGENT_POLICY: SlaPolicy = {
  priority: TicketPriority.urgent,
  firstResponseMinutes: 60,
  resolutionMinutes: 240,
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("SlaPolicyDialog", () => {
  it("does not render content when closed", () => {
    renderWithProviders(
      <SlaPolicyDialog policy={URGENT_POLICY} open={false} onOpenChange={vi.fn()} />,
    );
    expect(screen.queryByText(/edit urgent priority sla/i)).not.toBeInTheDocument();
  });

  it("renders form prefilled with the current policy values when open", () => {
    renderWithProviders(
      <SlaPolicyDialog policy={URGENT_POLICY} open={true} onOpenChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("heading", { name: /edit urgent priority sla/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/first-response target/i)).toHaveValue(60);
    expect(screen.getByLabelText(/resolution target/i)).toHaveValue(240);
  });

  it("submits PATCH with updated values and closes on success", async () => {
    vi.mocked(axios.patch).mockResolvedValue({
      data: { ...URGENT_POLICY, firstResponseMinutes: 30 },
    });
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <SlaPolicyDialog policy={URGENT_POLICY} open={true} onOpenChange={onOpenChange} />,
    );

    const frInput = screen.getByLabelText(/first-response target/i);
    await user.clear(frInput);
    await user.type(frInput, "30");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/sla-policies/urgent", {
        firstResponseMinutes: 30,
        resolutionMinutes: 240,
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("treats an empty input as null (drops the target for that metric)", async () => {
    vi.mocked(axios.patch).mockResolvedValue({ data: URGENT_POLICY });
    const user = userEvent.setup();
    renderWithProviders(
      <SlaPolicyDialog policy={URGENT_POLICY} open={true} onOpenChange={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText(/resolution target/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/sla-policies/urgent", {
        firstResponseMinutes: 60,
        resolutionMinutes: null,
      });
    });
  });

  it("rejects a negative-minutes submission and does not call the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <SlaPolicyDialog policy={URGENT_POLICY} open={true} onOpenChange={vi.fn()} />,
    );

    const frInput = screen.getByLabelText(/first-response target/i);
    await user.clear(frInput);
    await user.type(frInput, "-5");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    // Schema rejects min(1) — the exact Zod wording can shift between
    // versions, so we just assert the API was never called.
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("surfaces a server error in the field when the PATCH fails", async () => {
    const axiosError = Object.assign(new Error("Server boom"), {
      isAxiosError: true,
      response: { data: { error: "Something went wrong on the server" } },
    });
    vi.mocked(axios.patch).mockRejectedValue(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(
      <SlaPolicyDialog policy={URGENT_POLICY} open={true} onOpenChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(/something went wrong on the server/i),
    ).toBeInTheDocument();
  });
});
