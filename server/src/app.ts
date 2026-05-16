import * as Sentry from "@sentry/node";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { auth } from "./lib/auth";
import { env } from "./lib/env";
import agentsRouter from "./routes/agents";
import healthRouter from "./routes/health";
import inboundEmailRouter from "./routes/inbound-email";
import notificationsRouter from "./routes/notifications";
import statsRouter from "./routes/stats";
import ticketsRouter from "./routes/tickets";
import usersRouter from "./routes/users";

const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }) as RequestHandler);
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use("/api/health", healthRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/inbound-email", inboundEmailRouter);
app.use("/api/notifications", notificationsRouter);

Sentry.setupExpressErrorHandler(app);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({
    error: env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
};
app.use(errorHandler);

export default app;
