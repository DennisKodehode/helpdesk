import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /api/tickets", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });
});
