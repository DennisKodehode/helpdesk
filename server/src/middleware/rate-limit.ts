import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../lib/env";

// In-memory store is fine for single-instance Railway deploys. If we scale
// horizontally, swap to rate-limit-redis with shared state across instances.

const isTest = env.NODE_ENV === "test";

function jsonHandler(status = 429, message = "Too many requests") {
  return (
    _req: unknown,
    res: { status: (n: number) => { json: (b: unknown) => void } },
  ) => {
    res.status(status).json({ error: message });
  };
}

/**
 * Per-IP limit for the inbound Resend webhook. Resend nowhere near approaches
 * 60/min in practice; this is defense-in-depth against signed-but-replayed
 * payloads or a misconfigured upstream that retries aggressively.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown", 56),
  handler: jsonHandler(),
});

/**
 * Per-authenticated-user limit for Gemini-backed endpoints (polish-reply,
 * summarize). These are the biggest cost-DoS surface in the app — a compromised
 * session or a runaway client script could rack up real money.
 *
 * Routes using this limiter MUST sit behind requireAuth so req.user is set.
 */
export const aiEndpointLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req) => {
    const userId = (req as { user?: { id: string } }).user?.id;
    return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? "unknown", 56);
  },
  handler: jsonHandler(),
});
