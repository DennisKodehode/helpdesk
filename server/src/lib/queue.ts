import boss from "./boss";
import { initAiUserId } from "./ai-user";
import { CLASSIFY_TICKET_QUEUE, classifyTicketWorker } from "./classify-ticket";
import { AUTO_RESOLVE_TICKET_QUEUE, autoResolveTicketWorker } from "./auto-resolve-ticket";
import { SEND_REPLY_EMAIL_QUEUE, sendReplyEmailWorker } from "./send-reply-email-job";
import { AUTO_CLOSE_TICKETS_QUEUE, autoCloseTicketsWorker, AUTO_CLOSE_CRON } from "./auto-close-tickets";

export async function setupQueues() {
  await initAiUserId();
  await boss.createQueue(CLASSIFY_TICKET_QUEUE);
  await boss.createQueue(AUTO_RESOLVE_TICKET_QUEUE);
  await boss.createQueue(SEND_REPLY_EMAIL_QUEUE);
  await boss.createQueue(AUTO_CLOSE_TICKETS_QUEUE);
  await boss.work(CLASSIFY_TICKET_QUEUE, classifyTicketWorker);
  await boss.work(AUTO_RESOLVE_TICKET_QUEUE, autoResolveTicketWorker);
  await boss.work(SEND_REPLY_EMAIL_QUEUE, sendReplyEmailWorker);
  await boss.work(AUTO_CLOSE_TICKETS_QUEUE, autoCloseTicketsWorker);
  await boss.schedule(AUTO_CLOSE_TICKETS_QUEUE, AUTO_CLOSE_CRON);
}
