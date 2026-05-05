import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import EditUserDialog from "./EditUserDialog";
import type { User } from "@helpdesk/core";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

const mockUser: User = {
  id: "1",
  name: "Alice Smith",
  email: "alice@example.com",
  role: "agent",
  createdAt: "2024-01-15T00:00:00Z",
};

function renderDialog(open = true, user: User | null = mockUser, onOpenChange = vi.fn()) {
  return renderWithProviders(
    <EditUserDialog open={open} user={user} onOpenChange={onOpenChange} />
  );
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe("visibility", () => {
  it("renders the form when open", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Edit Agent" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("does not render the form when closed", () => {
    renderDialog(false);

    expect(screen.queryByRole("heading", { name: "Edit Agent" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Pre-population
// ---------------------------------------------------------------------------

describe("pre-population", () => {
  it("pre-fills name and email from the user prop", () => {
    renderDialog();

    expect(screen.getByLabelText("Name")).toHaveValue("Alice Smith");
    expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
  });

  it("leaves the password field empty", () => {
    renderDialog();

    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validation", () => {
  it("shows field errors when submitting with invalid data", async () => {
    const user = userEvent.setup();
    renderDialog(true, { ...mockUser, name: "" });

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
  });

  it("shows an error when name is shorter than 3 characters", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Al");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
  });

  it("shows an error for a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    renderDialog();

    await screen.findByDisplayValue("alice@example.com"); // ensure useEffect pre-population has run
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });
  });

  it("does not show a password error when the password field is left blank", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.patch).mockResolvedValue({ data: mockUser });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalled();
    });
    expect(screen.queryByText("Password must be at least 8 characters")).not.toBeInTheDocument();
  });

  it("does not call PATCH when the form is invalid", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
    expect(axios.patch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

describe("submission", () => {
  it("calls PATCH /api/users/:id with correct data and closes on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    vi.mocked(axios.patch).mockResolvedValue({ data: mockUser });
    renderDialog(true, mockUser, onOpenChange);

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Alice Updated");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/users/1", {
        name: "Alice Updated",
        email: "alice@example.com",
        password: "",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends a new password when provided", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.patch).mockResolvedValue({ data: mockUser });
    renderDialog();

    await screen.findByDisplayValue("alice@example.com"); // ensure useEffect pre-population has run
    await user.type(screen.getByLabelText("Password"), "newpassword123");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith("/api/users/1", expect.objectContaining({
        password: "newpassword123",
      }));
    });
  });

  it("shows a server error on the email field when the request fails", async () => {
    const user = userEvent.setup();
    const axiosError = { response: { data: { error: "Email already in use" } } };
    vi.mocked(axios.patch).mockRejectedValue(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });

  it("disables the button and shows 'Saving...' while the request is pending", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.patch).mockReturnValue(new Promise(() => {}));
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    });
  });
});
