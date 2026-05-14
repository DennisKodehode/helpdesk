import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen, within, cleanup } from "../test/utils";
import UsersTable from "./UsersTable";
import { Role, type User } from "@helpdesk/core";

afterEach(cleanup);

const mockUsers: User[] = [
  {
    id: "1",
    name: "Alice Smith",
    email: "alice@example.com",
    role: Role.admin,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "2",
    name: "Bob Jones",
    email: "bob@example.com",
    role: Role.agent,
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
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument();
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
  it("shows an empty state when the list is empty", () => {
    renderWithProviders(
      <UsersTable users={[]} isPending={false} isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    // Empty state is rendered in both the desktop table and the mobile card list.
    expect(screen.getAllByText(/no agents yet/i).length).toBeGreaterThan(0);
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

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Alice Smith")).toBeInTheDocument();
    expect(table.getByText("alice@example.com")).toBeInTheDocument();
    expect(table.getByText("Bob Jones")).toBeInTheDocument();
    expect(table.getByText("bob@example.com")).toBeInTheDocument();
  });

  it("shows role badges for each user", () => {
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Admin")).toBeInTheDocument();
    expect(table.getByText("Agent")).toBeInTheDocument();
  });

  it("calls onDelete with the correct user when Delete is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={onDelete} onEdit={vi.fn()} />
    );

    const table = within(screen.getByRole("table"));
    await user.click(table.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledWith(mockUsers[1]);
  });

  it("does not show a Delete button for admin users", () => {
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={vi.fn()} onEdit={vi.fn()} />
    );

    // Scoped to the desktop table; the mobile card list mirrors this rule.
    const table = within(screen.getByRole("table"));
    expect(table.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("calls onEdit with the correct user when Edit is clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(
      <UsersTable users={mockUsers} isPending={false} isError={false} onDelete={vi.fn()} onEdit={onEdit} />
    );

    const table = within(screen.getByRole("table"));
    await user.click(table.getAllByRole("button", { name: "Edit" })[0]);

    expect(onEdit).toHaveBeenCalledWith(mockUsers[0]);
  });
});
