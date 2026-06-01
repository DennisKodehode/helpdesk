import type { AiActivityResponse } from "@helpdesk/core";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen, waitFor } from "../../test/utils";
import AiThisWeekCard from "./AiThisWeekCard";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const DATA: AiActivityResponse = {
  autoResolved: 14,
  autoClassified: 96,
  escalated: 5,
  repliesSent: 41,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AiThisWeekCard", () => {
  it("renders the four AI metrics with values", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: DATA });
    renderWithProviders(<AiThisWeekCard />);
    expect(await screen.findByText("14")).toBeInTheDocument();
    expect(screen.getByText("96")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getByText("Auto-resolved")).toBeInTheDocument();
    expect(screen.getByText("Auto-classified")).toBeInTheDocument();
    expect(screen.getByText("Escalated")).toBeInTheDocument();
    expect(screen.getByText("Replies sent")).toBeInTheDocument();
  });

  it("renders an error alert when the query fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("nope"));
    renderWithProviders(<AiThisWeekCard />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/failed to load ai activity/i),
    );
  });
});
