import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import TabletTicketsMasterDetail from "./TabletTicketsMasterDetail";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

// The detail pane reuses the full ticket-detail tree; stub it so this test
// focuses on the master-detail's pane-selection behavior, not detail internals
// (those are covered by TicketDetailPage's own tests).
vi.mock("./TabletTicketDetailPane", () => ({
  default: ({ id }: { id: string }) => <div>detail pane for {id}</div>,
}));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: { data: [], total: 0 } });
});

describe("TabletTicketsMasterDetail", () => {
  it("shows the 'select a ticket' empty state when nothing is selected", () => {
    renderWithProviders(
      <TabletTicketsMasterDetail scope="all" selectedId={undefined} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/select a ticket/i)).toBeInTheDocument();
    expect(screen.queryByText(/detail pane for/i)).not.toBeInTheDocument();
  });

  it("renders the detail pane for the selected id", () => {
    renderWithProviders(
      <TabletTicketsMasterDetail scope="all" selectedId="42" onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/detail pane for 42/i)).toBeInTheDocument();
    expect(screen.queryByText(/select a ticket/i)).not.toBeInTheDocument();
  });
});
