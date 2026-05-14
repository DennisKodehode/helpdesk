import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, cleanup, renderWithProviders } from "../test/utils";
import userEvent from "@testing-library/user-event";
import LoginForm from "./LoginForm";

afterEach(cleanup);

function renderForm(
  serverError: string | null = null,
  onSubmit: (data: { email: string; password: string }) => Promise<void> = vi.fn(),
) {
  return renderWithProviders(<LoginForm onSubmit={onSubmit} serverError={serverError} />);
}

describe("LoginForm", () => {
  it("renders email and password fields", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows serverError when provided", () => {
    renderForm("Invalid credentials");
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  });
});

describe("validation", () => {
  it("shows 'Invalid email address' when email is empty", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
  });

  it("shows 'Invalid email address' for a bad email format", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "notanemail");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
  });

  it("shows 'Password is required' when password is empty", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Password is required")).toBeInTheDocument();
  });

  it("does not call onSubmit when the form is invalid", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    renderForm(null, onSubmit);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Invalid email address");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("pending state", () => {
  it("disables the button and shows 'Signing in…' while the request is in-flight", async () => {
    const user = userEvent.setup();
    renderForm(null, () => new Promise(() => {}));
    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    });
  });
});
