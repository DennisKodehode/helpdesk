import * as Sentry from "@sentry/node";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import agentsRouter from "./routes/agents";
import usersRouter from "./routes/users";
import ticketsRouter from "./routes/tickets";
import statsRouter from "./routes/stats";
import inboundEmailRouter from "./routes/inbound-email";

const app = express();

const clientOrigins = (process.env.CLIENT_URL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: clientOrigins, credentials: true }) as RequestHandler);
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/agents", agentsRouter);
app.use("/api/users", usersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/inbound-email", inboundEmailRouter);

Sentry.setupExpressErrorHandler(app);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({
    error:
      process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
};
app.use(errorHandler);

export default app;
