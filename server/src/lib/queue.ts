import boss from "./boss";
import { initAiUserId } from "./ai-user";
import { CLASSIFY_TICKET_QUEUE, classifyTicketWorker } from "./classify-ticket";
import { AUTO_RESOLVE_TICKET_QUEUE, autoResolveTicketWorker } from "./auto-resolve-ticket";
import { SEND_REPLY_EMAIL_QUEUE, sendReplyEmailWorker } from "./send-reply-email-job";

export async function setupQueues() {
  await initAiUserId();
  await boss.createQueue(CLASSIFY_TICKET_QUEUE);
  await boss.createQueue(AUTO_RESOLVE_TICKET_QUEUE);
  await boss.createQueue(SEND_REPLY_EMAIL_QUEUE);
  await boss.work(CLASSIFY_TICKET_QUEUE, classifyTicketWorker);
  await boss.work(AUTO_RESOLVE_TICKET_QUEUE, autoResolveTicketWorker);
  await boss.work(SEND_REPLY_EMAIL_QUEUE, sendReplyEmailWorker);
}
