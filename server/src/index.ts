import "./instrument";
import app from "./app";
import boss from "./lib/boss";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { setupQueues } from "./lib/queue";

await boss.start();
await setupQueues();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server started");
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutdown: starting");

  // Failsafe: if shutdown stalls (e.g. a wedged job worker), force-exit so
  // the orchestrator can move on. 35s is slightly longer than the queue's
  // 30s graceful window so the queue gets a chance to finish first.
  const hardKill = setTimeout(() => {
    logger.error("shutdown: forced exit after timeout");
    process.exit(1);
  }, 35_000);
  hardKill.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    logger.info("shutdown: HTTP drained");

    await boss.stop({ graceful: true, timeout: 30_000 });
    logger.info("shutdown: queue drained");

    process.exit(0);
  } catch (err) {
    logger.error({ err }, "shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
