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

  // Intro tickets — only seeded on a fresh DB. Detected via Bob Johnson,
  // the canonical starter ticket. Re-running the script on a populated DB
  // skips this block but still runs seedAliceHistory below.
  const introSeeded = await prisma.ticket.findFirst({ where: { fromEmail: "bob@acme.com" } });
  if (introSeeded) {
    console.log("Intro tickets already seeded, skipping.");
    await seedAliceHistory(agent.id);
    return;
  }

  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
  const daysAgo = (n: number) => hoursAgo(n * 24);

  const tickets = [
    {
      fromName: "Bob Johnson", fromEmail: "bob@acme.com",
      subject: "Cannot log into my account",
      body: "Hi,\n\nI have been trying to log in since yesterday but keep getting an \"invalid credentials\" error. I have already reset my password twice.\n\nPlease help!\n\nBob",
      status: "open" as const, category: "technical_question" as const, assignedToId: agent.id,
      createdAt: hoursAgo(20),
    },
    {
      fromName: "Sarah Chen", fromEmail: "sarah.chen@globex.com",
      subject: "Request for refund on order #4821",
      body: "Hello,\n\nI placed order #4821 on April 28th but the item arrived damaged. I took photos and would like a full refund.\n\nKind regards,\nSarah",
      status: "open" as const, category: "refund_request" as const, assignedToId: null,
      createdAt: hoursAgo(40),
    },
    {
      fromName: "Marcus Webb", fromEmail: "marcus@initech.io",
      subject: "How do I export my data?",
      body: "Hi there,\n\nI need to export all my data for compliance reasons. Is there a way to do a full export from the dashboard?\n\nThanks,\nMarcus",
      status: "open" as const, category: "general_question" as const, assignedToId: null,
      createdAt: hoursAgo(60),
    },
    {
      fromName: "Priya Patel", fromEmail: "priya@startup.dev",
      subject: "Billing discrepancy on invoice #2024-089",
      body: "Hi,\n\nI was charged $149 this month but my plan is $99/month. Could you please review invoice #2024-089 and issue a correction?\n\nBest,\nPriya",
      status: "open" as const, category: "billing_inquiry" as const, assignedToId: agent.id,
      createdAt: hoursAgo(8),
    },
    {
      fromName: "Tom Ridley", fromEmail: "tom.ridley@enterprise.co",
      subject: "Feature request: bulk ticket export",
      body: "Hello team,\n\nIt would be very helpful to have a bulk export feature for tickets in CSV format. We have a reporting requirement and this would save hours each week.\n\nRegards,\nTom",
      status: "resolved" as const, category: "feature_request" as const, assignedToId: agent.id,
      createdAt: hoursAgo(3 * 24 + 5), resolvedAt: daysAgo(3),
    },
    {
      fromName: "Emily Ross", fromEmail: "emily@consulting.biz",
      subject: "App crashes on mobile Safari",
      body: "Hi,\n\nEvery time I try to open the dashboard on my iPhone (Safari, iOS 17) the page crashes after about 5 seconds. Works fine on desktop Chrome.\n\nLet me know if you need more info.\n\nEmily",
      status: "resolved" as const, category: "technical_question" as const, assignedToId: null,
      createdAt: hoursAgo(7 * 24 + 6), resolvedAt: daysAgo(7),
    },
    {
      fromName: "James Liu", fromEmail: "james.liu@agency.net",
      subject: "Upgrade to Pro plan",
      body: "Hi,\n\nI would like to upgrade from the Starter plan to Pro. Can you apply the upgrade and let me know if there is a prorated charge?\n\nThanks,\nJames",
      status: "closed" as const, category: "billing_inquiry" as const, assignedToId: agent.id,
      createdAt: hoursAgo(14 * 24 + 2), resolvedAt: daysAgo(14), closedAt: daysAgo(10),
    },
    {
      fromName: "Natalie Dunn", fromEmail: "natalie@shop.com",
      subject: "Wrong item shipped",
      body: "Hello,\n\nI ordered the blue version but received the red one. Order number is #9034. Please arrange a return and ship the correct item.\n\nNatalie",
      status: "open" as const, category: null, assignedToId: null,
      createdAt: hoursAgo(16),
    },
    {
      fromName: "Hannah Park", fromEmail: "hannah@design.studio",
      subject: "What's your refund policy?",
      body: "Hi,\n\nCould you point me to your refund policy? I want to know the standard window before I submit a request.\n\nHannah",
      status: "resolved" as const, category: "general_question" as const, assignedToId: aiUser.id,
      createdAt: hoursAgo(2 * 24 + 1), resolvedAt: daysAgo(2),
    },
    {
      fromName: "Daniel Okafor", fromEmail: "daniel@logistics.io",
      subject: "How do I change my notification email?",
      body: "Hello,\n\nI need to change the email address that receives ticket notifications. Where is that setting in the dashboard?\n\nThanks,\nDaniel",
      status: "resolved" as const, category: "general_question" as const, assignedToId: aiUser.id,
      createdAt: hoursAgo(5 * 24 + 1), resolvedAt: daysAgo(5),
    },
  ];

  for (const t of tickets) {
    await prisma.ticket.create({ data: t });
  }
  console.log(`Created ${tickets.length} tickets.`);

  await seedAliceHistory(agent.id);
}

/**
 * Seeds a backlog of Alice's resolved tickets and authored replies so the
 * "My stats" dashboard has realistic numbers in dev. Idempotent — gated by a
 * sentinel ticket email, so it's safe to re-run.
 */
async function seedAliceHistory(aliceId: string) {
  const SENTINEL = "alice-history-01@seed.local";
  const existing = await prisma.ticket.findFirst({ where: { fromEmail: SENTINEL } });
  if (existing) {
    console.log("Alice's demo history already seeded, skipping.");
    return;
  }

  const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

  type Spec = {
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    category: "general_question" | "technical_question" | "billing_inquiry" | "refund_request" | "feature_request" | null;
    status: "open" | "resolved" | "closed";
    createdHoursAgo: number;
    resolvedHoursAgo?: number; // must be < createdHoursAgo
    closedHoursAgo?: number;   // must be < resolvedHoursAgo
    replies: Array<{ minutesAfter: number; body: string }>;
  };

  const specs: Spec[] = [
    // ── Resolved within the 30-day window — drives both lifetime + 30d ──
    {
      fromName: "Jordan Bell", fromEmail: SENTINEL,
      subject: "Password reset loop",
      body: "Hi,\n\nReset link emails are arriving but every click sends me back to the login page with no session. Cleared cookies, tried Incognito, same thing.\n\nJordan",
      category: "technical_question", status: "resolved",
      createdHoursAgo: 28 * 24 + 4, resolvedHoursAgo: 28 * 24,
      replies: [
        { minutesAfter: 15, body: "Hi Jordan — taking a look now. Can you confirm which browser and OS you're on?" },
        { minutesAfter: 220, body: "Found it — your account was flagged after several failed attempts and our middleware was eating the new session cookie. Flag is cleared, please try the reset link one more time. Sorry for the runaround." },
      ],
    },
    {
      fromName: "Mei Tanaka", fromEmail: "alice-history-02@seed.local",
      subject: "Billing on plan change",
      body: "Hi,\n\nWe downgraded from Team to Solo last week but the invoice today still charges the Team price. Could you check?\n\nMei",
      category: "billing_inquiry", status: "resolved",
      createdHoursAgo: 22 * 24 + 2, resolvedHoursAgo: 22 * 24,
      replies: [
        { minutesAfter: 30, body: "Hi Mei — confirmed the downgrade went through but the proration credit didn't apply. I've issued a refund for the delta ($60). It should land in 3–5 business days." },
      ],
    },
    {
      fromName: "Ravi Shah", fromEmail: "alice-history-03@seed.local",
      subject: "Invoice for January",
      body: "Hello,\n\nOur accounting team needs the January invoice in PDF form. Could you send it across?\n\nThanks,\nRavi",
      category: "billing_inquiry", status: "resolved",
      createdHoursAgo: 18 * 24 + 1, resolvedHoursAgo: 18 * 24 - 1,
      replies: [
        { minutesAfter: 20, body: "Hi Ravi — attached. You can also download any past invoice from Settings → Billing → Invoices going forward." },
      ],
    },
    {
      fromName: "Lena Acker", fromEmail: "alice-history-04@seed.local",
      subject: "Two-factor auth not working",
      body: "Hey,\n\n2FA codes from the authenticator app are being rejected. Phone time is synced. Locked out completely.\n\nLena",
      category: "technical_question", status: "resolved",
      createdHoursAgo: 12 * 24 + 6, resolvedHoursAgo: 12 * 24,
      replies: [
        { minutesAfter: 12, body: "Hi Lena — I'll need to verify identity before resetting 2FA. Can you reply from the email on file with the last 4 digits of the card we have on record?" },
        { minutesAfter: 240, body: "Verified, 2FA has been reset. Please re-enroll your authenticator and let me know if you hit any further issues." },
      ],
    },
    {
      fromName: "Owen Pratt", fromEmail: "alice-history-05@seed.local",
      subject: "Custom domain DNS",
      body: "Hi,\n\nI added support.ourcompany.co as a custom domain but it's been pending verification for 24h. CNAME is set per the docs.\n\nOwen",
      category: "technical_question", status: "resolved",
      createdHoursAgo: 9 * 24 + 24, resolvedHoursAgo: 9 * 24,
      replies: [
        { minutesAfter: 45, body: "Hi Owen — the CNAME looks right from here but our verifier is on a 6-hour cadence right now. I've kicked off a manual verify pass — back to you shortly." },
        { minutesAfter: 480, body: "DNS is now verified our side. Last step on yours is generating the SSL cert from the dashboard — should take a couple minutes." },
        { minutesAfter: 1380, body: "Cert issued, domain is live. Closing this out — flag me if anything pops up." },
      ],
    },
    {
      fromName: "Priscilla Vo", fromEmail: "alice-history-06@seed.local",
      subject: "API rate limit question",
      body: "Hi,\n\nWhat's the per-minute rate limit on the v2 endpoints? Docs only mention daily.\n\nThanks,\nPriscilla",
      category: "general_question", status: "resolved",
      createdHoursAgo: 5 * 24 + 3, resolvedHoursAgo: 5 * 24,
      replies: [
        { minutesAfter: 10, body: "Hi Priscilla — 600 req/min for v2 on the Pro plan. I'll get the docs page updated, thanks for flagging." },
      ],
    },
    {
      fromName: "Sam Whittle", fromEmail: "alice-history-07@seed.local",
      subject: "Webhook payload format",
      body: "Hi team,\n\nWe're seeing nested arrays instead of objects on the `attachments` field. Was the format changed?\n\nSam",
      category: "technical_question", status: "resolved",
      createdHoursAgo: 3 * 24 + 2, resolvedHoursAgo: 3 * 24,
      replies: [
        { minutesAfter: 18, body: "Hi Sam — yes, the `attachments` shape changed in last Thursday's release. New format is documented here: helpdesk.dev/docs/webhooks#attachments. Sorry we didn't surface this more loudly." },
      ],
    },
    {
      fromName: "Alex Hu", fromEmail: "alice-history-08@seed.local",
      subject: "Export columns",
      body: "Hi,\n\nCSV export doesn't include the `assigned_to` field anymore. Can it be added back?\n\nAlex",
      category: "feature_request", status: "resolved",
      createdHoursAgo: 1 * 24 + 1, resolvedHoursAgo: 1 * 24,
      replies: [
        { minutesAfter: 25, body: "Hi Alex — quick fix, it's now included in the default export. Re-run your export and let me know if anything else is missing." },
      ],
    },

    // ── Closed tickets older than 30 days — drive lifetime only ───────
    {
      fromName: "Iris Holm", fromEmail: "alice-history-09@seed.local",
      subject: "Onboarding help",
      body: "Hi,\n\nNew to the platform — is there a recommended setup order? Our team is 12 people.\n\nIris",
      category: "general_question", status: "closed",
      createdHoursAgo: 50 * 24 + 3, resolvedHoursAgo: 50 * 24, closedHoursAgo: 46 * 24,
      replies: [
        { minutesAfter: 22, body: "Hi Iris — happy to walk you through it. For teams that size we usually recommend setting up roles first, then the inbound webhook, then inviting agents. I've sent a calendar link if you'd like a 20-min onboarding call." },
      ],
    },
    {
      fromName: "Felix Marr", fromEmail: "alice-history-10@seed.local",
      subject: "Beta access request",
      body: "Hello,\n\nIs the AI auto-categorization beta still open? We'd love to try it on our queue.\n\nFelix",
      category: "feature_request", status: "closed",
      createdHoursAgo: 75 * 24 + 8, resolvedHoursAgo: 75 * 24, closedHoursAgo: 71 * 24,
      replies: [
        { minutesAfter: 35, body: "Hi Felix — yes, opened it for your account. You should see the toggle in Settings → AI within a few minutes. Beta means no SLA on the categorization quality yet, so please flag misses." },
      ],
    },

    // ── Still-open tickets where Alice replied first ──────────────────
    // These don't add to resolved counts but do contribute to avg first reply
    // and to lifetime/30d reply counts.
    {
      fromName: "Maya Bose", fromEmail: "alice-history-11@seed.local",
      subject: "Slack integration question",
      body: "Hey,\n\nCan the Slack integration post to a thread instead of a top-level channel message?\n\nMaya",
      category: "general_question", status: "open",
      createdHoursAgo: 2 * 24,
      replies: [
        { minutesAfter: 14, body: "Hi Maya — not today, but it's on the roadmap for Q3. In the meantime you can use the webhook + Slack Workflow Builder to route into a thread. Happy to share an example workflow if useful." },
        { minutesAfter: 60, body: "Following up — also worth knowing: threading is the #1 ask we've heard for that integration, so it's likely to land sooner rather than later." },
      ],
    },
    {
      fromName: "Theo Lange", fromEmail: "alice-history-12@seed.local",
      subject: "Custom domain SSL renewal",
      body: "Hi,\n\nWe got a cert expiry email but the renewal seems to have failed. Is the auto-renew job stuck?\n\nTheo",
      category: "technical_question", status: "open",
      createdHoursAgo: 10,
      replies: [
        { minutesAfter: 28, body: "Hi Theo — looking into it now. Our renewal worker had a hiccup overnight. I'll re-trigger it manually and get back to you shortly." },
      ],
    },
  ];

  let ticketsCreated = 0;
  let repliesCreated = 0;

  for (const s of specs) {
    const createdAt = hoursAgo(s.createdHoursAgo);
    const firstReplyAt =
      s.replies.length > 0
        ? new Date(createdAt.getTime() + s.replies[0].minutesAfter * 60 * 1000)
        : null;

    const ticket = await prisma.ticket.create({
      data: {
        fromName: s.fromName,
        fromEmail: s.fromEmail,
        subject: s.subject,
        body: s.body,
        category: s.category,
        status: s.status,
        assignedToId: aliceId,
        createdAt,
        resolvedAt: s.resolvedHoursAgo !== undefined ? hoursAgo(s.resolvedHoursAgo) : null,
        closedAt: s.closedHoursAgo !== undefined ? hoursAgo(s.closedHoursAgo) : null,
        firstAgentReplyAt: firstReplyAt,
      },
    });
    ticketsCreated++;

    for (const r of s.replies) {
      await prisma.reply.create({
        data: {
          ticketId: ticket.id,
          authorId: aliceId,
          senderType: "agent",
          body: r.body,
          createdAt: new Date(createdAt.getTime() + r.minutesAfter * 60 * 1000),
        },
      });
      repliesCreated++;
    }
  }

  console.log(`Seeded Alice's demo history: ${ticketsCreated} tickets, ${repliesCreated} replies.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
