import app from "./app";
import boss from "./lib/boss";
import { CLASSIFY_TICKET_QUEUE, classifyTicketWorker } from "./lib/classify-ticket";

if (!process.env.WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET environment variable is not set");
}

await boss.start();
await boss.createQueue(CLASSIFY_TICKET_QUEUE);
await boss.work(CLASSIFY_TICKET_QUEUE, classifyTicketWorker);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGTERM", async () => {
  await boss.stop();
  process.exit(0);
});
