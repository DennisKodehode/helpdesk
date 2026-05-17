import "./instrument";
import app from "./app";
import boss from "./lib/boss";
import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { setupQueues } from "./lib/queue";

await boss.start();
await setupQueues();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server started");
});

process.on("SIGTERM", async () => {
  await boss.stop();
  process.exit(0);
});
