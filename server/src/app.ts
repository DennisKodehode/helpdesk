import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import usersRouter from "./routes/users";
import webhooksRouter from "./routes/webhooks";
import { requireWebhookSecret } from "./middleware/webhook-middleware";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }) as RequestHandler);
app.use(express.json());

app.all("/api/auth/*splat", toNodeHandler(auth));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/users", usersRouter);
app.use("/api/webhooks", requireWebhookSecret, webhooksRouter);

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
