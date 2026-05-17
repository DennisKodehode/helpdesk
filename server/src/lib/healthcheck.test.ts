import { HealthCheckError } from "@godaddy/terminus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock("./boss", () => ({
  default: { getQueues: vi.fn() },
}));

const { performHealthCheck } = await import("./healthcheck");
const { prisma } = await import("./prisma");
const { default: boss } = await import("./boss");

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);
const mockedGetQueues = vi.mocked(boss.getQueues);

describe("performHealthCheck", () => {
  beforeEach(() => {
    mockedQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockedGetQueues.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the per-check status when both checks pass", async () => {
    const result = await performHealthCheck();
    expect(result).toEqual({
      status: "ok",
      checks: { database: { ok: true }, queue: { ok: true } },
    });
  });

  it("throws HealthCheckError with causes when the DB check fails", async () => {
    mockedQueryRaw.mockRejectedValueOnce(new Error("connection refused"));

    await expect(performHealthCheck()).rejects.toMatchObject({
      causes: {
        database: { ok: false, error: "connection refused" },
        queue: { ok: true },
      },
    });
  });

  it("throws HealthCheckError when the queue check fails", async () => {
    mockedGetQueues.mockRejectedValueOnce(new Error("boss not started"));

    await expect(performHealthCheck()).rejects.toMatchObject({
      causes: {
        database: { ok: true },
        queue: { ok: false, error: "boss not started" },
      },
    });
  });

  it("reports both checks failed when both throw", async () => {
    mockedQueryRaw.mockRejectedValueOnce(new Error("db down"));
    mockedGetQueues.mockRejectedValueOnce(new Error("queue down"));

    await expect(performHealthCheck()).rejects.toMatchObject({
      causes: {
        database: { ok: false, error: "db down" },
        queue: { ok: false, error: "queue down" },
      },
    });
  });

  it("error is an instance of HealthCheckError so terminus renders 503", async () => {
    mockedQueryRaw.mockRejectedValueOnce(new Error("boom"));
    await expect(performHealthCheck()).rejects.toBeInstanceOf(HealthCheckError);
  });
});
