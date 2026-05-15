import { generateId } from "better-auth";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const ctx = await auth.$context;

  // AI agent user (virtual agent for auto-resolution tracking)
  let aiUser = await prisma.user.findUnique({ where: { email: "ai@helpdesk.internal" } });
  if (aiUser) {
    console.log("AI user already exists:", aiUser.email);
  } else {
    const now = new Date();
    aiUser = await prisma.user.create({
      data: {
        id: generateId(),
        email: "ai@helpdesk.internal",
        name: "AI",
        role: "agent",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    console.log("AI user created: ai@helpdesk.internal");
  }

  // Agent
  const agentEmail = "agent@example.com";
  let agent = await prisma.user.findUnique({ where: { email: agentEmail } });
  if (!agent) {
    const id = generateId();
    const now = new Date();
    agent = await prisma.user.create({
      data: { id, name: "Alice Agent", email: agentEmail, emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    await prisma.account.create({
      data: {
        id: generateId(), accountId: id, providerId: "credential", userId: id,
        password: await ctx.password.hash("Agent@Helpdesk2026!"),
        createdAt: now, updatedAt: now,
      },
    });
    console.log("Agent created:", agentEmail, "/ Agent@Helpdesk2026!");
  } else {
    console.log("Agent already exists:", agentEmail);
  }

  // Tickets
  const count = await prisma.ticket.count();
  if (count > 0) {
    console.log("Tickets already exist, skipping.");
    return;
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  const tickets = [
    {
      fromName: "Bob Johnson", fromEmail: "bob@acme.com",
      subject: "Cannot log into my account",
      body: "Hi,\n\nI have been trying to log in since yesterday but keep getting an \"invalid credentials\" error. I have already reset my password twice.\n\nPlease help!\n\nBob",
      status: "open" as const, category: "technical_question" as const, assignedToId: agent.id,
    },
    {
      fromName: "Sarah Chen", fromEmail: "sarah.chen@globex.com",
      subject: "Request for refund on order #4821",
      body: "Hello,\n\nI placed order #4821 on April 28th but the item arrived damaged. I took photos and would like a full refund.\n\nKind regards,\nSarah",
      status: "open" as const, category: "refund_request" as const, assignedToId: null,
    },
    {
      fromName: "Marcus Webb", fromEmail: "marcus@initech.io",
      subject: "How do I export my data?",
      body: "Hi there,\n\nI need to export all my data for compliance reasons. Is there a way to do a full export from the dashboard?\n\nThanks,\nMarcus",
      status: "open" as const, category: "general_question" as const, assignedToId: null,
    },
    {
      fromName: "Priya Patel", fromEmail: "priya@startup.dev",
      subject: "Billing discrepancy on invoice #2024-089",
      body: "Hi,\n\nI was charged $149 this month but my plan is $99/month. Could you please review invoice #2024-089 and issue a correction?\n\nBest,\nPriya",
      status: "open" as const, category: "billing_inquiry" as const, assignedToId: agent.id,
    },
    {
      fromName: "Tom Ridley", fromEmail: "tom.ridley@enterprise.co",
      subject: "Feature request: bulk ticket export",
      body: "Hello team,\n\nIt would be very helpful to have a bulk export feature for tickets in CSV format. We have a reporting requirement and this would save hours each week.\n\nRegards,\nTom",
      status: "resolved" as const, category: "feature_request" as const, assignedToId: agent.id,
      resolvedAt: daysAgo(3),
    },
    {
      fromName: "Emily Ross", fromEmail: "emily@consulting.biz",
      subject: "App crashes on mobile Safari",
      body: "Hi,\n\nEvery time I try to open the dashboard on my iPhone (Safari, iOS 17) the page crashes after about 5 seconds. Works fine on desktop Chrome.\n\nLet me know if you need more info.\n\nEmily",
      status: "resolved" as const, category: "technical_question" as const, assignedToId: null,
      resolvedAt: daysAgo(7),
    },
    {
      fromName: "James Liu", fromEmail: "james.liu@agency.net",
      subject: "Upgrade to Pro plan",
      body: "Hi,\n\nI would like to upgrade from the Starter plan to Pro. Can you apply the upgrade and let me know if there is a prorated charge?\n\nThanks,\nJames",
      status: "closed" as const, category: "billing_inquiry" as const, assignedToId: agent.id,
      resolvedAt: daysAgo(14),
    },
    {
      fromName: "Natalie Dunn", fromEmail: "natalie@shop.com",
      subject: "Wrong item shipped",
      body: "Hello,\n\nI ordered the blue version but received the red one. Order number is #9034. Please arrange a return and ship the correct item.\n\nNatalie",
      status: "open" as const, category: null, assignedToId: null,
    },
    {
      fromName: "Hannah Park", fromEmail: "hannah@design.studio",
      subject: "What's your refund policy?",
      body: "Hi,\n\nCould you point me to your refund policy? I want to know the standard window before I submit a request.\n\nHannah",
      status: "resolved" as const, category: "general_question" as const, assignedToId: aiUser.id,
      resolvedAt: daysAgo(2),
    },
    {
      fromName: "Daniel Okafor", fromEmail: "daniel@logistics.io",
      subject: "How do I change my notification email?",
      body: "Hello,\n\nI need to change the email address that receives ticket notifications. Where is that setting in the dashboard?\n\nThanks,\nDaniel",
      status: "resolved" as const, category: "general_question" as const, assignedToId: aiUser.id,
      resolvedAt: daysAgo(5),
    },
  ];

  for (const t of tickets) {
    await prisma.ticket.create({ data: t });
  }
  console.log(`Created ${tickets.length} tickets.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
