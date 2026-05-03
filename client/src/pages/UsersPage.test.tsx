import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders, screen, waitFor, within, cleanup } from "../test/utils";
import UsersPage from "./UsersPage";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

const mockUsers = [
  {
    id: "1",
    name: "Alice Smith",
    email: "alice@example.com",
    role: "admin",
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "2",
    name: "Bob Jones",
    email: "bob@example.com",
    role: "agent",
    createdAt: "2024-03-20T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.get).mockResolvedValue({ data: mockUsers });
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("loading state", () => {
  it("shows skeleton rows while the query is pending", () => {
    vi.mocked(axios.get).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<UsersPage />);

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(25); // 5 rows × 5 cells
  });
});

// ---------------------------------------------------------------------------
// Loaded state
// ---------------------------------------------------------------------------

describe("loaded state", () => {
  it("renders all users in the table", async () => {
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows a role badge for each user", async () => {
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText("admin")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
  });

  it("shows 'No users found' when the list is empty", async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText("No users found")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("error state", () => {
  it("shows an error message when the fetch fails", async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error("Network error"));
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText("Failed to load users")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Add Agent dialog
// ---------------------------------------------------------------------------

describe("add agent", () => {
  it("opens the dialog when 'Add Agent' is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getByRole("button", { name: "Add Agent" }));

    expect(screen.getByRole("heading", { name: "Add Agent" })).toBeInTheDocument();
  });

  it("shows validation errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getByRole("button", { name: "Add Agent" }));
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("closes the dialog and refetches on successful creation", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getByRole("button", { name: "Add Agent" }));
    await user.type(screen.getByLabelText("Name"), "Carol White");
    await user.type(screen.getByLabelText("Email"), "carol@example.com");
    await user.type(screen.getByLabelText("Password"), "securepassword");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Add Agent" })).not.toBeInTheDocument();
    });
    expect(axios.post).toHaveBeenCalledWith("/api/users", {
      name: "Carol White",
      email: "carol@example.com",
      password: "securepassword",
    });
    expect(axios.get).toHaveBeenCalledTimes(2); // initial load + refetch
  });

  it("shows a server error on the email field when creation fails", async () => {
    const user = userEvent.setup();
    const axiosError = { response: { data: { error: "Email already in use" } } };
    vi.mocked(axios.post).mockRejectedValue(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getByRole("button", { name: "Add Agent" }));
    await user.type(screen.getByLabelText("Name"), "Alice Smith");
    await user.type(screen.getByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "securepassword");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Delete user
// ---------------------------------------------------------------------------

describe("delete user", () => {
  it("opens the confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Delete user?" })).toBeInTheDocument();
    expect(within(dialog).getByText(/alice@example\.com/)).toBeInTheDocument();
  });

  it("closes the dialog when Cancel is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Delete user?" })).not.toBeInTheDocument();
    });
  });

  it("calls the API and refetches after confirming delete", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.delete).mockResolvedValue({});
    renderWithProviders(<UsersPage />);

    await screen.findByText("Alice Smith");
    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith("/api/users/1");
    });
    expect(axios.get).toHaveBeenCalledTimes(2); // initial load + refetch
  });
});
