import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";
import type { RequestHandler } from "express";
import pinoHttp from "pino-http";
import { logger } from "../lib/logger";

export const requestLogger: RequestHandler = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = (req.headers["x-request-id"] as string | undefined) ?? undefined;
    const id = existing ?? randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  autoLogging: {
    ignore: (req) => req.url === "/api/health",
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

// Tag the active Sentry scope with the request id so captured exceptions
// can be cross-referenced with log lines. Runs after requestLogger so req.id
// is populated.
export const sentryRequestTag: RequestHandler = (req, _res, next) => {
  if (req.id) Sentry.getCurrentScope().setTag("requestId", String(req.id));
  next();
};
