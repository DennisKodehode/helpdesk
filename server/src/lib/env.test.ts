import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  CLIENT_URL: "http://localhost:5173",
  RESEND_API_KEY: "re_test",
  RESEND_WEBHOOK_SECRET: "whsec_test",
  GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
} satisfies NodeJS.ProcessEnv;

const PROD_ENV = {
  ...VALID_ENV,
  NODE_ENV: "production",
  BETTER_AUTH_URL: "https://helpdesk.example.com",
  CLIENT_URL: "https://app.example.com",
} satisfies NodeJS.ProcessEnv;

describe("loadEnv", () => {
  it("parses a valid environment and applies defaults", () => {
    const env = loadEnv(VALID_ENV);
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.EMAIL_FROM).toBe("support@helpdesk.internal");
  });

  it("transforms CLIENT_URL into a typed array of origins", () => {
    const env = loadEnv({
      ...VALID_ENV,
      CLIENT_URL: "http://localhost:5173, http://192.168.1.5:5173 ,",
    });
    expect(env.CLIENT_URL).toEqual(["http://localhost:5173", "http://192.168.1.5:5173"]);
  });

  it("rejects CLIENT_URL entries that are not URLs", () => {
    expect(() =>
      loadEnv({ ...VALID_ENV, CLIENT_URL: "http://localhost:5173, not-a-url" }),
    ).toThrow(/CLIENT_URL/);
  });

  it("coerces PORT from string", () => {
    const env = loadEnv({ ...VALID_ENV, PORT: "4000" });
    expect(env.PORT).toBe(4000);
  });

  it("throws a consolidated error listing every missing required var", () => {
    const broken: NodeJS.ProcessEnv = {
      DATABASE_URL: VALID_ENV.DATABASE_URL,
      BETTER_AUTH_URL: VALID_ENV.BETTER_AUTH_URL,
      CLIENT_URL: VALID_ENV.CLIENT_URL,
    };
    expect(() => loadEnv(broken)).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadEnv(broken)).toThrow(/RESEND_API_KEY/);
    expect(() => loadEnv(broken)).toThrow(/RESEND_WEBHOOK_SECRET/);
    expect(() => loadEnv(broken)).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters", () => {
    expect(() => loadEnv({ ...VALID_ENV, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET.*32/,
    );
  });

  it("rejects DATABASE_URL that does not use the postgres scheme", () => {
    expect(() =>
      loadEnv({ ...VALID_ENV, DATABASE_URL: "mysql://user:pass@localhost/db" }),
    ).toThrow(/DATABASE_URL.*postgres/);
  });

  it("rejects a malformed DATABASE_URL", () => {
    expect(() => loadEnv({ ...VALID_ENV, DATABASE_URL: "not a url" })).toThrow(
      /DATABASE_URL/,
    );
  });

  describe("production-only refinements", () => {
    it("accepts a fully-configured production environment", () => {
      expect(() => loadEnv(PROD_ENV)).not.toThrow();
    });

    it("rejects a localhost BETTER_AUTH_URL in production", () => {
      expect(() =>
        loadEnv({ ...PROD_ENV, BETTER_AUTH_URL: "http://localhost:3000" }),
      ).toThrow(/BETTER_AUTH_URL.*localhost/);
    });

    it("rejects placeholder Gemini key in production", () => {
      expect(() =>
        loadEnv({ ...PROD_ENV, GOOGLE_GENERATIVE_AI_API_KEY: "your-key-here" }),
      ).toThrow(/GOOGLE_GENERATIVE_AI_API_KEY.*placeholder/);
    });

    it("does not enforce production-only rules in development", () => {
      expect(() =>
        loadEnv({
          ...VALID_ENV,
          GOOGLE_GENERATIVE_AI_API_KEY: "your-key-here",
        }),
      ).not.toThrow();
    });
  });
});
