import { initAiUserId } from "./ai-user";
import {
  AUTO_CLOSE_CRON,
  AUTO_CLOSE_TICKETS_QUEUE,
  autoCloseTicketsWorker,
} from "./auto-close-tickets";
import {
  AUTO_RESOLVE_TICKET_QUEUE,
  autoResolveTicketWorker,
} from "./auto-resolve-ticket";
import boss from "./boss";
import { CLASSIFY_TICKET_QUEUE, classifyTicketWorker } from "./classify-ticket";
import { SEND_REPLY_EMAIL_QUEUE, sendReplyEmailWorker } from "./send-reply-email-job";
import {
  SLA_BREACH_CHECK_CRON,
  SLA_BREACH_CHECK_QUEUE,
  slaBreachCheckWorker,
} from "./sla-breach-check";

export async function setupQueues() {
  await initAiUserId();
  await boss.createQueue(CLASSIFY_TICKET_QUEUE);
  await boss.createQueue(AUTO_RESOLVE_TICKET_QUEUE);
  await boss.createQueue(SEND_REPLY_EMAIL_QUEUE);
  await boss.createQueue(AUTO_CLOSE_TICKETS_QUEUE);
  await boss.createQueue(SLA_BREACH_CHECK_QUEUE);
  await boss.work(CLASSIFY_TICKET_QUEUE, classifyTicketWorker);
  await boss.work(AUTO_RESOLVE_TICKET_QUEUE, autoResolveTicketWorker);
  await boss.work(SEND_REPLY_EMAIL_QUEUE, sendReplyEmailWorker);
  await boss.work(AUTO_CLOSE_TICKETS_QUEUE, autoCloseTicketsWorker);
  await boss.work(SLA_BREACH_CHECK_QUEUE, slaBreachCheckWorker);
  await boss.schedule(AUTO_CLOSE_TICKETS_QUEUE, AUTO_CLOSE_CRON);
  await boss.schedule(SLA_BREACH_CHECK_QUEUE, SLA_BREACH_CHECK_CRON);
}
