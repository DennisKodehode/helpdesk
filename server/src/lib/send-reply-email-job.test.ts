import type { Job } from "pg-boss";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendReplyEmailJobData } from "./send-reply-email-job";

vi.mock("./email", () => ({
  sendReplyEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./prisma", () => ({
  prisma: {
    attachment: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("./storage", () => ({
  storage: {
    get: vi.fn(),
  },
}));

const { sendReplyEmailWorker } = await import("./send-reply-email-job");
const { sendReplyEmail } = await import("./email");
const { prisma } = await import("./prisma");
const { storage } = await import("./storage");

function jobFor(data: Partial<SendReplyEmailJobData> = {}): Job<SendReplyEmailJobData>[] {
  return [
    {
      data: {
        to: "customer@example.com",
        toName: "Customer",
        subject: "A subject",
        replyBody: "Hi there.",
        replyId: 1,
        ...data,
      },
    } as never,
  ];
}

describe("sendReplyEmailWorker", () => {
  beforeEach(() => {
    vi.mocked(prisma.attachment.findMany).mockReset();
    vi.mocked(storage.get).mockReset();
    vi.mocked(sendReplyEmail).mockReset();
    vi.mocked(sendReplyEmail).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends without attachments when the reply has none", async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([]);

    await sendReplyEmailWorker(jobFor({ replyId: 42 }));

    expect(prisma.attachment.findMany).toHaveBeenCalledWith({
      where: { replyId: 42 },
      select: { filename: true, contentType: true, storageKey: true },
    });
    expect(storage.get).not.toHaveBeenCalled();
    expect(sendReplyEmail).toHaveBeenCalledWith({
      to: "customer@example.com",
      toName: "Customer",
      subject: "A subject",
      replyBody: "Hi there.",
      attachments: undefined,
    });
  });

  it("fetches storage bytes and passes them as Buffer attachments to sendReplyEmail", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const pdf = Buffer.from("%PDF-1.4");
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([
      {
        filename: "shot.png",
        contentType: "image/png",
        storageKey: "attachments/42/abc-shot.png",
      },
      {
        filename: "doc.pdf",
        contentType: "application/pdf",
        storageKey: "attachments/42/def-doc.pdf",
      },
    ] as never);
    vi.mocked(storage.get).mockImplementation(async (key: string) => {
      if (key === "attachments/42/abc-shot.png") return png;
      if (key === "attachments/42/def-doc.pdf") return pdf;
      throw new Error(`unexpected key: ${key}`);
    });

    await sendReplyEmailWorker(jobFor({ replyId: 42 }));

    expect(storage.get).toHaveBeenCalledTimes(2);
    expect(sendReplyEmail).toHaveBeenCalledTimes(1);
    const params = vi.mocked(sendReplyEmail).mock.calls[0][0];
    expect(params.attachments).toHaveLength(2);
    expect(params.attachments![0]).toEqual({
      filename: "shot.png",
      content_type: "image/png",
      content: png,
    });
    expect(params.attachments![1]).toEqual({
      filename: "doc.pdf",
      content_type: "application/pdf",
      content: pdf,
    });
  });

  it("propagates storage errors so pg-boss retries the job", async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([
      {
        filename: "x.png",
        contentType: "image/png",
        storageKey: "attachments/1/x.png",
      },
    ] as never);
    vi.mocked(storage.get).mockRejectedValue(new Error("storage down"));

    await expect(sendReplyEmailWorker(jobFor())).rejects.toThrow("storage down");
    expect(sendReplyEmail).not.toHaveBeenCalled();
  });
});
