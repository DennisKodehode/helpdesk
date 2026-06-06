import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./app";

describe("security headers (helmet)", () => {
  it("sets baseline security headers on responses", async () => {
    // Any route works — helmet runs before routing, so even a 401 carries the
    // headers. /api/tickets requires auth and returns 401 unauthenticated.
    const res = await request(app).get("/api/tickets");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    // CSP is deliberately disabled for now (SPA + cross-origin auth); assert it
    // stays off so a future helmet default doesn't silently break the client.
    expect(res.headers["content-security-policy"]).toBeUndefined();
  });
});
