import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import { renderWithProviders, screen, waitFor, cleanup } from "../test/utils";
import UserDialog from "./UserDialog";
import { Role, type User } from "@helpdesk/core";

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
  role: Role.agent,
  createdAt: "2024-01-15T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------------------

describe("create mode", () => {
  function renderCreate(open = true, onOpenChange = vi.fn()) {
    return renderWithProviders(<UserDialog open={open} onOpenChange={onOpenChange} />);
  }

  describe("visibility", () => {
    it("renders the form when open", () => {
      renderCreate();

      expect(screen.getByRole("heading", { name: "New agent" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("does not render the form when closed", () => {
      renderCreate(false);

      expect(screen.queryByRole("heading", { name: "New agent" })).not.toBeInTheDocument();
    });
  });

  describe("validation", () => {
    it("shows field errors when submitting an empty form", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.click(screen.getByRole("button", { name: "Create agent" }));

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
      });
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });

    it("shows an error when name is shorter than 3 characters", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Al");
      await user.click(screen.getByRole("button", { name: "Create agent" }));

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
      });
    });

    it("shows an error for an invalid email format", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.type(screen.getByLabelText("Email"), "not-an-email");
      await user.click(screen.getByRole("button", { name: "Create agent" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid email address")).toBeInTheDocument();
      });
    });

    it("does not call POST when the form is invalid", async () => {
      const user = userEvent.setup();
      renderCreate();

      await user.click(screen.getByRole("button", { name: "Create agent" }));

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
      });
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe("submission", () => {
    it("calls POST /api/users and closes on success", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      vi.mocked(axios.post).mockResolvedValue({ data: {} });
      renderCreate(true, onOpenChange);

      await user.type(screen.getByLabelText("Name"), "Carol White");
      await user.type(screen.getByLabelText("Email"), "carol@example.com");
      await user.type(screen.getByLabelText("Password"), "securepassword");
      await user.click(screen.getByRole("button", { name: "Create agent" }));

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
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Alice Smith");
      await user.type(screen.getByLabelText("Email"), "alice@example.com");
      await user.type(screen.getByLabelText("Password"), "securepassword");
      await user.click(screen.getByRole("button", { name: "Create agent" }));

      expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    });

    it("disables the button and shows 'Creating…' while the request is pending", async () => {
      const user = userEvent.setup();
      vi.mocked(axios.post).mockReturnValue(new Promise(() => {}));
      renderCreate();

      await user.type(screen.getByLabelText("Name"), "Carol White");
      await user.type(screen.getByLabelText("Email"), "carol@example.com");
      await user.type(screen.getByLabelText("Password"), "securepassword");
      await user.click(screen.getByRole("button", { name: "Create agent" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
      });
    });

    it("resets the form when the dialog is closed", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderCreate(true, onOpenChange);

      await user.type(screen.getByLabelText("Name"), "Carol White");
      await user.keyboard("{Escape}");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

describe("edit mode", () => {
  function renderEdit(open = true, user: User | null = mockUser, onOpenChange = vi.fn()) {
    return renderWithProviders(
      <UserDialog open={open} user={user} onOpenChange={onOpenChange} />
    );
  }

  describe("visibility", () => {
    it("renders the form when open", () => {
      renderEdit();

      expect(screen.getByRole("heading", { name: "Edit agent" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });

    it("does not render the form when closed", () => {
      renderEdit(false);

      expect(screen.queryByRole("heading", { name: "Edit agent" })).not.toBeInTheDocument();
    });
  });

  describe("pre-population", () => {
    it("pre-fills name and email from the user prop", () => {
      renderEdit();

      expect(screen.getByLabelText("Name")).toHaveValue("Alice Smith");
      expect(screen.getByLabelText("Email")).toHaveValue("alice@example.com");
    });

    it("leaves the password field empty", () => {
      renderEdit();

      expect(screen.getByLabelText("Password")).toHaveValue("");
    });
  });

  describe("validation", () => {
    it("shows field errors when submitting with invalid data", async () => {
      const user = userEvent.setup();
      renderEdit(true, { ...mockUser, name: "" });

      await user.clear(screen.getByLabelText("Name"));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
      });
    });

    it("shows an error when name is shorter than 3 characters", async () => {
      const user = userEvent.setup();
      renderEdit();

      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Al");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
      });
    });

    it("shows an error for a password shorter than 8 characters", async () => {
      const user = userEvent.setup();
      renderEdit();

      await screen.findByDisplayValue("alice@example.com");
      await user.type(screen.getByLabelText("Password"), "short");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
      });
    });

    it("does not show a password error when the password field is left blank", async () => {
      const user = userEvent.setup();
      vi.mocked(axios.patch).mockResolvedValue({ data: mockUser });
      renderEdit();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(axios.patch).toHaveBeenCalled();
      });
      expect(screen.queryByText("Password must be at least 8 characters")).not.toBeInTheDocument();
    });

    it("does not call PATCH when the form is invalid", async () => {
      const user = userEvent.setup();
      renderEdit();

      await user.clear(screen.getByLabelText("Name"));
      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(screen.getByText("Name must be at least 3 characters")).toBeInTheDocument();
      });
      expect(axios.patch).not.toHaveBeenCalled();
    });
  });

  describe("submission", () => {
    it("calls PATCH /api/users/:id with correct data and closes on success", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      vi.mocked(axios.patch).mockResolvedValue({ data: mockUser });
      renderEdit(true, mockUser, onOpenChange);

      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Alice Updated");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

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
      renderEdit();

      await screen.findByDisplayValue("alice@example.com");
      const passwordInput = screen.getByLabelText("Password");
      await user.click(passwordInput);
      await waitFor(() => expect(document.activeElement).toBe(passwordInput));
      await user.type(passwordInput, "newpassword123");
      await user.click(screen.getByRole("button", { name: "Save changes" }));

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
      renderEdit();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    });

    it("disables the button and shows 'Saving…' while the request is pending", async () => {
      const user = userEvent.setup();
      vi.mocked(axios.patch).mockReturnValue(new Promise(() => {}));
      renderEdit();

      await user.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
      });
    });
  });
});
