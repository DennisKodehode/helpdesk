import { Role, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Resend so request-password-reset never attempts a real send. The mock is
// reached through app → auth (sendResetPassword) → email (sendPasswordResetEmail).
vi.mock("../lib/resend", () => ({
  default: { emails: { send: vi.fn() } },
}));

const app = (await import("../app")).default;
const { auth } = await import("../lib/auth");
const { prisma } = await import("../lib/prisma");
const resend = (await import("../lib/resend")).default;

// Create an active (or otherwise) user WITH a credential account so the reset
// flow has a password to overwrite — mirrors the seeding in agents.test.ts.
async function seedUser(opts: { email: string; password: string; status?: UserStatus }) {
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(opts.password);
  const now = new Date();
  const id = generateId();
  await prisma.user.create({
    data: {
      id,
      name: "Reset Test User",
      email: opts.email,
      emailVerified: true,
      role: Role.agent,
      status: opts.status ?? UserStatus.active,
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.account.create({
    data: {
      id: generateId(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    },
  });
  return id;
}

// Better Auth stores the reset token in Verification as identifier
// `reset-password:<token>` with value = userId.
async function readResetToken(userId: string): Promise<string> {
  const row = await prisma.verification.findFirst({
    where: { identifier: { startsWith: "reset-password:" }, value: userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) throw new Error("no reset token found");
  return row.identifier.replace("reset-password:", "");
}

async function cleanup(id: string) {
  await prisma.verification.deleteMany({ where: { value: id } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.account.deleteMany({ where: { userId: id } });
  await prisma.user.deleteMany({ where: { id } });
}

describe("password reset (Better Auth built-in)", () => {
  let id: string | undefined;

  beforeEach(() => {
    vi.mocked(resend.emails.send).mockReset();
    vi.mocked(resend.emails.send).mockResolvedValue({ data: null, error: null } as never);
  });

  afterEach(async () => {
    if (id) {
      await cleanup(id);
      id = undefined;
    }
  });

  it("returns a generic 200 and emails a known address", async () => {
    id = await seedUser({ email: "reset-known@example.com", password: "oldpassword1" });
    const res = await request(app).post("/api/auth/request-password-reset").send({
      email: "reset-known@example.com",
      redirectTo: "http://localhost:5173/reset-password",
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledOnce();
  });

  it("returns the same generic 200 for an unknown address (no enumeration)", async () => {
    const res = await request(app).post("/api/auth/request-password-reset").send({
      email: "reset-nobody@example.com",
      redirectTo: "http://localhost:5173/reset-password",
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(resend.emails.send)).not.toHaveBeenCalled();
  });

  it("resets the password with a valid token and lets the user sign in", async () => {
    id = await seedUser({ email: "reset-flow@example.com", password: "oldpassword1" });
    await request(app).post("/api/auth/request-password-reset").send({
      email: "reset-flow@example.com",
      redirectTo: "http://localhost:5173/reset-password",
    });

    const token = await readResetToken(id);
    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ newPassword: "brandnewpass1", token });
    expect(reset.status).toBe(200);

    // Old password no longer works; new one does.
    const oldSignIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "reset-flow@example.com", password: "oldpassword1" });
    expect(oldSignIn.status).not.toBe(200);

    const newSignIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "reset-flow@example.com", password: "brandnewpass1" });
    expect(newSignIn.status).toBe(200);
  });

  it("returns the same generic 200 but sends no email to an inactive user", async () => {
    id = await seedUser({
      email: "reset-inactive@example.com",
      password: "oldpassword1",
      status: UserStatus.inactive,
    });
    const res = await request(app).post("/api/auth/request-password-reset").send({
      email: "reset-inactive@example.com",
      redirectTo: "http://localhost:5173/reset-password",
    });
    // Generic 200 (no account-state leak), but sendResetPassword short-circuits
    // before emailing a non-active account — they shouldn't set a credential.
    expect(res.status).toBe(200);
    expect(vi.mocked(resend.emails.send)).not.toHaveBeenCalled();
  });

  it("sends no email to an invited (not-yet-active) user", async () => {
    id = await seedUser({
      email: "reset-invited@example.com",
      password: "oldpassword1",
      status: UserStatus.invited,
    });
    const res = await request(app).post("/api/auth/request-password-reset").send({
      email: "reset-invited@example.com",
      redirectTo: "http://localhost:5173/reset-password",
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(resend.emails.send)).not.toHaveBeenCalled();
  });
});
