import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import resend from "./resend";

vi.mock("./resend", () => ({
  default: { emails: { send: vi.fn() } },
}));

const { sendReplyEmail } = await import("./email");

describe("sendReplyEmail", () => {
  beforeEach(() => {
    vi.mocked(resend.emails.send).mockReset();
    vi.mocked(resend.emails.send).mockResolvedValue({ data: null, error: null } as never);
  });

  afterEach(async () => {
    await prisma.emailSuppression.deleteMany({
      where: { email: { startsWith: "email-test-" } },
    });
  });

  it("calls resend.emails.send for a non-suppressed recipient", async () => {
    const to = `email-test-${Date.now()}@example.com`;
    await sendReplyEmail({
      to,
      toName: "Customer",
      subject: "Hello",
      replyBody: "Body",
    });
    expect(vi.mocked(resend.emails.send)).toHaveBeenCalledOnce();
  });

  it("skips resend.emails.send when the recipient is suppressed", async () => {
    const to = `email-test-suppressed-${Date.now()}@example.com`;
    await prisma.emailSuppression.create({
      data: { email: to.toLowerCase(), reason: "hard_bounce" },
    });

    await sendReplyEmail({
      to,
      toName: "Customer",
      subject: "Hello",
      replyBody: "Body",
    });

    expect(vi.mocked(resend.emails.send)).not.toHaveBeenCalled();
  });

  it("matches suppression case-insensitively", async () => {
    const to = `email-test-CASE-${Date.now()}@example.com`;
    await prisma.emailSuppression.create({
      data: { email: to.toLowerCase(), reason: "complaint" },
    });

    await sendReplyEmail({
      to: to.toUpperCase(),
      toName: "Customer",
      subject: "Hello",
      replyBody: "Body",
    });

    expect(vi.mocked(resend.emails.send)).not.toHaveBeenCalled();
  });
});
