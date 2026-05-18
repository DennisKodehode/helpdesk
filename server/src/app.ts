import fs from "node:fs";
import path from "node:path";
import * as Sentry from "@sentry/node";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { auth } from "./lib/auth";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { requestLogger, sentryRequestTag } from "./middleware/request-logger";
import agentsRouter from "./routes/agents";
import { attachmentsRouter, uploadRouter } from "./routes/attachments";
import inboundEmailRouter from "./routes/inbound-email";
import notificationsRouter from "./routes/notifications";
import statsRouter from "./routes/stats";
import ticketsRouter from "./routes/tickets";
import usersRouter from "./routes/users";

const app = express();

app.use(requestLogger);
app.use(sentryRequestTag);
app.use(cors({ origin: env.CLIENT_URL, credentials: true }) as RequestHandler);
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

// /api/health is handled by @godaddy/terminus on the http.Server (see index.ts).
app.use("/api/agents", agentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/inbound-email", inboundEmailRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/replies/:id/attachments", uploadRouter);
app.use("/api/attachments", attachmentsRouter);

// Serve the built SPA when it exists on disk. In the prod Docker image the
// Vite build always produces client/dist; in dev Vite serves the client on
// :5173 and client/dist doesn't exist, so this is a no-op. Gating on the
// build artefact rather than NODE_ENV makes local Docker smoke tests work
// regardless of the env value we pass to bypass env.ts's prod refinements.
const clientDist = path.resolve(import.meta.dirname, "../../client/dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  // SPA catch-all so deep links like /tickets/123 work on refresh. Express 5
  // requires a named wildcard ("/*splat") rather than the bare "*".
  app.get("/*splat", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

Sentry.setupExpressErrorHandler(app);

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  (req.log ?? logger).error({ err }, "request error");
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({
    error: env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
};
app.use(errorHandler);

export default app;
