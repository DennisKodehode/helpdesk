import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { TicketCategory } from "@helpdesk/core";
import { prisma } from "./prisma";

const CATEGORIES = Object.values(TicketCategory);

export async function classifyTicket(ticket: { id: number; subject: string; body: string }) {
  const prompt =
    `Classify this customer support ticket into exactly one of these categories:\n\n` +
    `- general_question: how-to questions, account navigation, feature questions, and general inquiries\n` +
    `- technical_question: bug reports, errors, broken functionality, API or integration issues\n` +
    `- refund_request: requests for a refund or money back\n` +
    `- billing_inquiry: questions about charges, invoices, subscriptions, or pricing\n` +
    `- feature_request: suggestions or requests for new features\n\n` +
    `Reply with only the category name, nothing else.\n\n` +
    `Subject: ${ticket.subject}\n` +
    `Message: ${ticket.body}`;

  const { text } = await generateText({
    model: google("gemini-2.5-flash-lite"),
    prompt,
  });

  const category = text.trim() as TicketCategory;
  if (!CATEGORIES.includes(category)) return;

  await prisma.ticket.update({ where: { id: ticket.id }, data: { category } });
}
