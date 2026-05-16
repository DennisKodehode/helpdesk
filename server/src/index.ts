import "./instrument";
import app from "./app";
import boss from "./lib/boss";
import { env } from "./lib/env";
import { setupQueues } from "./lib/queue";

await boss.start();
await setupQueues();

app.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});

process.on("SIGTERM", async () => {
  await boss.stop();
  process.exit(0);
});
