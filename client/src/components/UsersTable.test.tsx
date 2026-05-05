import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, cleanup } from "../test/utils";
import UsersTable from "./UsersTable";
import type { User } from "@helpdesk/core";

afterEach(cleanup);

const mockUsers: User[] = [
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

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("loading state", () => {
  it("shows skeleton rows while pending", () => {
    renderWithProviders(
      <UsersTable users={[]} isPending isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(30); // 5 rows × 6 skeletons (4 cells + 2 in actions cell)
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("error state", () => {
  it("shows an error message", () => {
    renderWithProviders(
      <UsersTable users={[]} isPending={false} isError onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("Failed to load users")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe("empty state", () => {
  it("shows 'No users found' when the list is empty", () => {
    renderWithProviders(
      <UsersTable users={[]} isPending={false} isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("No users found")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loaded state
// ---------------------------------------------------------------------------

describe("loaded state", () => {
  it("renders a row for each user", () => {
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows role badges for each user", () => {
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
  });

  it("calls onDelete with the correct user when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={onDelete} onEdit={vi.fn()} />
    );

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(onDelete).toHaveBeenCalledWith(mockUsers[0]);
  });

  it("calls onEdit with the correct user when Edit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={vi.fn()} onEdit={onEdit} />
    );

    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(onEdit).toHaveBeenCalledWith(mockUsers[0]);
  });
});
