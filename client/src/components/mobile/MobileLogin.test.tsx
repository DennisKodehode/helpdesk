import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "../../test/utils";
import MobileLogin from "./MobileLogin";

afterEach(cleanup);

describe("MobileLogin", () => {
  it("renders the hero and the login form", () => {
    renderWithProviders(<MobileLogin onSubmit={vi.fn()} serverError={null} />);
    expect(screen.getByText(/ai-powered ticket/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("surfaces a server error", () => {
    renderWithProviders(
      <MobileLogin onSubmit={vi.fn()} serverError="Invalid credentials" />,
    );
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it("submits the entered credentials", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<MobileLogin onSubmit={onSubmit} serverError={null} />);
    await user.type(screen.getByLabelText("Email"), "agent@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2pass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
