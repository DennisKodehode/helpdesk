import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));
vi.mock("../lib/boss", () => ({
  default: { getQueues: vi.fn() },
}));

const { default: app } = await import("../app");
const { prisma } = await import("../lib/prisma");
const { default: boss } = await import("../lib/boss");

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);
const mockedGetQueues = vi.mocked(boss.getQueues);

describe("GET /api/health", () => {
  beforeEach(() => {
    // Happy-path defaults; individual tests override with mockRejectedValueOnce.
    mockedQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockedGetQueues.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with all checks ok when DB and queue are reachable", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      checks: { database: { ok: true }, queue: { ok: true } },
    });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("returns 503 with database.ok false when the DB check throws", async () => {
    mockedQueryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.database).toEqual({
      ok: false,
      error: "connection refused",
    });
    expect(res.body.checks.queue).toEqual({ ok: true });
  });

  it("returns 503 with queue.ok false when the pg-boss check throws", async () => {
    mockedGetQueues.mockRejectedValueOnce(new Error("boss not started"));

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.queue).toEqual({
      ok: false,
      error: "boss not started",
    });
    expect(res.body.checks.database).toEqual({ ok: true });
  });

  it("reports both checks as failed when both throw", async () => {
    mockedQueryRaw.mockRejectedValueOnce(new Error("db down"));
    mockedGetQueues.mockRejectedValueOnce(new Error("queue down"));

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toEqual({ ok: false, error: "db down" });
    expect(res.body.checks.queue).toEqual({ ok: false, error: "queue down" });
  });
});
