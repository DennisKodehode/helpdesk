import "./instrument";
import { createTerminus } from "@godaddy/terminus";
import app from "./app";
import boss from "./lib/boss";
import { env } from "./lib/env";
import { performHealthCheck } from "./lib/healthcheck";
import { logger } from "./lib/logger";
import { setupQueues } from "./lib/queue";

await boss.start();
await setupQueues();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server started");
});

createTerminus(server, {
  signals: ["SIGTERM", "SIGINT"],
  // Total time allowed for HTTP drain + onSignal (queue drain) before force-exit.
  timeout: 35_000,
  healthChecks: {
    "/api/health": performHealthCheck,
    verbatim: true,
  },
  headers: { "Cache-Control": "no-store" },
  beforeShutdown: async () => {
    logger.info("shutdown: starting");
  },
  onSignal: async () => {
    logger.info("shutdown: HTTP drained");
    await boss.stop({ graceful: true, timeout: 30_000 });
    logger.info("shutdown: queue drained");
  },
  onShutdown: async () => {
    logger.info("shutdown: complete");
  },
  logger: (msg, err) => {
    if (err) logger.error({ err }, `terminus: ${msg}`);
    else logger.info(`terminus: ${msg}`);
  },
});
