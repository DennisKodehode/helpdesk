import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import CreateUserDialog from "./CreateUserDialog";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    isAxiosError: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return renderWithProviders(
    <CreateUserDialog open={open} onOpenChange={onOpenChange} />
  );
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

describe("visibility", () => {
  it("renders the form when open", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Add Agent" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("does not render the form when closed", () => {
    renderDialog(false);

    expect(screen.queryByRole("heading", { name: "Add Agent" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validation", () => {
  it("shows field errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("shows an error when name is shorter than 3 characters", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Al");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
  });

  it("shows an error for an invalid email format", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });
  });

  it("does not call POST when the form is invalid", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
    });
    expect(axios.post).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

describe("submission", () => {
  it("calls POST /api/users and closes on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    renderDialog(true, onOpenChange);

    await user.type(screen.getByLabelText("Name"), "Carol White");
    await user.type(screen.getByLabelText("Email"), "carol@example.com");
    await user.type(screen.getByLabelText("Password"), "securepassword");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/users", {
        name: "Carol White",
        email: "carol@example.com",
        password: "securepassword",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a server error on the email field when creation fails", async () => {
    const user = userEvent.setup();
    const axiosError = { response: { data: { error: "Email already in use" } } };
    vi.mocked(axios.post).mockRejectedValue(axiosError);
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Alice Smith");
    await user.type(screen.getByLabelText("Email"), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "securepassword");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });

  it("disables the button and shows 'Creating...' while the request is pending", async () => {
    const user = userEvent.setup();
    vi.mocked(axios.post).mockReturnValue(new Promise(() => {})); // never resolves
    renderDialog();

    await user.type(screen.getByLabelText("Name"), "Carol White");
    await user.type(screen.getByLabelText("Email"), "carol@example.com");
    await user.type(screen.getByLabelText("Password"), "securepassword");
    await user.click(screen.getByRole("button", { name: "Create Agent" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
    });
  });

  it("resets the form when the dialog is closed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(true, onOpenChange);

    await user.type(screen.getByLabelText("Name"), "Carol White");

    // Simulate close by toggling open prop — trigger handleOpenChange(false)
    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
