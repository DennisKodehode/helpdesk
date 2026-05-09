import app from "./app";
import boss from "./lib/boss";
import { setupQueues } from "./lib/queue";

if (!process.env.WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET environment variable is not set");
}

await boss.start();
await setupQueues();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGTERM", async () => {
  await boss.stop();
  process.exit(0);
});
