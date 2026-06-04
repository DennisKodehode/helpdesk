import "dotenv/config";
import {
  AuditEventType,
  NotificationType,
  Role,
  SenderType,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserStatus,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import { auth } from "../src/lib/auth";
import { createInviteToken, inviteExpiresAt } from "../src/lib/invite";
import { prisma } from "../src/lib/prisma";
import { seedSlaPolicies } from "../src/lib/sla-defaults";

// ---------------------------------------------------------------------------
// Comprehensive demo seed — a diverse, realistic dataset for the live demo.
//
// Re-runnable: it WIPES tickets/replies/notifications/audit/invitations and all
// non-essential users, then recreates the demo. The two essentials are
// preserved by email: the seeded admin (SEED_ADMIN_EMAIL) and the AI user
// (ai@helpdesk.internal) — deleting the AI user would silently break
// auto-resolve. Run `bun run db:seed` first so those exist.
// ---------------------------------------------------------------------------

const AI_USER_EMAIL = "ai@helpdesk.internal";
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";

const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR);
const minsAfter = (base: Date, m: number) => new Date(base.getTime() + m * 60 * 1000);

// Demo agents/admins. `active` agents get a credential (loginable); `invited`
// get an Invitation and no credential; `inactive` keep a credential but the
// login gate blocks them. Spread across statuses + roles to fill the roster.
const DEMO_PASSWORD = "Agent@Helpdesk2026!";
type AgentKey =
  | "alice"
  | "noah"
  | "priya"
  | "kofi"
  | "mara"
  | "yuki"
  | "jordan"
  | "sofia";

const AGENTS: Record<
  AgentKey,
  {
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
    joinedDaysAgo: number;
  }
> = {
  alice: {
    name: "Alice Agent",
    email: "agent@example.com",
    role: Role.agent,
    status: UserStatus.active,
    joinedDaysAgo: 240,
  },
  noah: {
    name: "Noah Reyes",
    email: "noah.reyes@helpdesk.team",
    role: Role.agent,
    status: UserStatus.active,
    joinedDaysAgo: 180,
  },
  priya: {
    name: "Priya Nair",
    email: "priya.nair@helpdesk.team",
    role: Role.agent,
    status: UserStatus.active,
    joinedDaysAgo: 95,
  },
  kofi: {
    name: "Kofi Mensah",
    email: "kofi.mensah@helpdesk.team",
    role: Role.agent,
    status: UserStatus.active,
    joinedDaysAgo: 38,
  },
  mara: {
    name: "Mara Lindqvist",
    email: "mara.lindqvist@helpdesk.team",
    role: Role.admin,
    status: UserStatus.active,
    joinedDaysAgo: 320,
  },
  yuki: {
    name: "Yuki Tanaka",
    email: "yuki.tanaka@helpdesk.team",
    role: Role.agent,
    status: UserStatus.inactive,
    joinedDaysAgo: 150,
  },
  jordan: {
    name: "Jordan Ellis",
    email: "jordan.ellis@example.com",
    role: Role.agent,
    status: UserStatus.invited,
    joinedDaysAgo: 2,
  },
  sofia: {
    name: "Sofia Romano",
    email: "sofia.romano@example.com",
    role: Role.admin,
    status: UserStatus.invited,
    joinedDaysAgo: 1,
  },
};

// Last-active on the roster comes from MAX(session.updatedAt). Give the active
// agents a session stamped at a realistic recency. Invited users have none
// (no credential yet), and inactive users have theirs killed on deactivation —
// both correctly render "—".
const LAST_ACTIVE_HOURS: Partial<Record<AgentKey, number>> = {
  alice: 0.3,
  noah: 2,
  priya: 26,
  kofi: 4,
  mara: 0.5,
};

type Author = AgentKey | "ai";
type ReplyFrom = Author | "customer" | "note";
interface ReplySpec {
  from: ReplyFrom;
  afterMins: number;
  body: string;
}
interface TicketSpec {
  name: string;
  email: string;
  subject: string;
  body: string;
  category: TicketCategory | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: Author | null;
  ageHours: number;
  resolvedAfterHours?: number;
  closedAfterHours?: number;
  replies?: ReplySpec[];
  aiResolved?: boolean; // adds an auto_resolved audit event
  escalated?: boolean; // adds an ai_escalated audit event
  unread?: boolean; // generate an unread customer_reply notification for the assignee
}

// Curated, realistic tickets across every status / category / priority / SLA
// state. Ages are chosen so SLA (computed at read time) lands a realistic mix
// of breached / at-risk / on-track on the open tickets.
const TICKETS: TicketSpec[] = [
  // ── Triaging (new / processing) — just arrived, AI hasn't classified yet ──
  {
    name: "Wendy Holloway",
    email: "wendy.holloway@bridgecorp.com",
    subject: "Does light mode follow my system setting?",
    body: "Hi — nothing urgent, just curious whether the dashboard's theme follows my OS preference automatically or if I toggle it manually.\n\nWendy",
    category: null,
    priority: TicketPriority.low,
    status: TicketStatus.new,
    assignee: null,
    ageHours: 0.3,
  },
  {
    name: "Diego Marin",
    email: "diego.marin@northstar.io",
    subject: "Question about webhook retries",
    body: "When a webhook delivery fails, how many times does the system retry and at what intervals? Sizing our idempotency window.\n\nDiego",
    category: null,
    priority: TicketPriority.normal,
    status: TicketStatus.processing,
    assignee: "ai",
    ageHours: 0.6,
  },

  // ── Open · urgent/high, old enough to be breached / at-risk ──────────────
  {
    name: "Greg Volkov",
    email: "greg.volkov@meridian.fund",
    subject: "URGENT: payment failed and account is locked",
    body: "Our monthly card payment failed (card was replaced) and now my whole team is locked out mid-day. We have a customer call in 90 minutes and need queue access. Please help asap.\n\nGreg",
    category: TicketCategory.billing_inquiry,
    priority: TicketPriority.urgent,
    status: TicketStatus.open,
    assignee: "alice",
    ageHours: 6,
    unread: true,
  },
  {
    name: "Aisha Rahman",
    email: "aisha@parallel.studio",
    subject: "Reports stopped generating since this morning",
    body: "Our scheduled reports normally drop at 7am and didn't run today. The Reports page shows a spinner that never resolves. This is blocking the team.\n\nAisha",
    category: TicketCategory.technical_question,
    priority: TicketPriority.high,
    status: TicketStatus.open,
    assignee: "noah",
    ageHours: 7,
    replies: [
      {
        from: "noah",
        afterMins: 35,
        body: "Hi Aisha — reproduced it, the report worker is backed up after an overnight deploy. I'm draining the queue now and will confirm once your 7am batch lands.",
      },
    ],
  },
  {
    name: "Sarah Chen",
    email: "sarah.chen@globex.com",
    subject: "Refund on order #4821 — arrived damaged",
    body: "I placed order #4821 on the 28th but the item arrived damaged. I have photos and would like a full refund.\n\nSarah",
    category: TicketCategory.refund_request,
    priority: TicketPriority.high,
    status: TicketStatus.open,
    assignee: null,
    ageHours: 30,
  },

  // ── Open · normal/low, recent (on-track) ────────────────────────────────
  {
    name: "Marcus Webb",
    email: "marcus@initech.io",
    subject: "How do I export my data?",
    body: "I need to export all my data for compliance. Is there a full export from the dashboard?\n\nMarcus",
    category: TicketCategory.general_question,
    priority: TicketPriority.normal,
    status: TicketStatus.open,
    assignee: "priya",
    ageHours: 3,
    replies: [
      {
        from: "priya",
        afterMins: 22,
        body: "Hi Marcus — yes: Settings → Data → Export queues a full archive and emails you a download link (usually within ~10 minutes). Let me know if it doesn't arrive.",
      },
    ],
  },
  {
    name: "Natalie Dunn",
    email: "natalie@shop.com",
    subject: "Wrong item shipped (order #9034)",
    body: "I ordered the blue version but received red. Order #9034 — please arrange a return and send the right one.\n\nNatalie",
    category: null,
    priority: TicketPriority.normal,
    status: TicketStatus.open,
    assignee: null,
    ageHours: 14,
  },
  {
    name: "Theo Lange",
    email: "theo@onsetlabs.com",
    subject: "Custom domain SSL renewal failed",
    body: "We got a cert-expiry email but the auto-renewal seems stuck. Is the renewal job hung?\n\nTheo",
    category: TicketCategory.technical_question,
    priority: TicketPriority.normal,
    status: TicketStatus.open,
    assignee: "kofi",
    ageHours: 9,
    replies: [
      {
        from: "kofi",
        afterMins: 28,
        body: "Hi Theo — looking now; the renewal worker had a hiccup overnight. Re-triggering it manually.",
      },
      {
        from: "customer",
        afterMins: 90,
        body: "Thanks — still showing 'pending' on my end.",
      },
    ],
  },
  {
    name: "Maya Bose",
    email: "maya@flux.design",
    subject: "Slack integration — post to a thread?",
    body: "Can the Slack integration post into a thread instead of a top-level message?\n\nMaya",
    category: TicketCategory.feature_request,
    priority: TicketPriority.low,
    status: TicketStatus.open,
    assignee: "alice",
    ageHours: 26,
    replies: [
      {
        from: "alice",
        afterMins: 14,
        body: "Hi Maya — not today, but it's on the Q3 roadmap. For now you can route via the webhook + Slack Workflow Builder; happy to share an example.",
      },
    ],
  },

  // ── Resolved within 30 days — drive throughput + avg resolution ──────────
  {
    name: "Jordan Bell",
    email: "jordan.bell@arcadia.io",
    subject: "Password reset loop",
    body: "Reset emails arrive but every click sends me back to login with no session. Cleared cookies, tried Incognito — same.\n\nJordan",
    category: TicketCategory.technical_question,
    priority: TicketPriority.high,
    status: TicketStatus.resolved,
    assignee: "alice",
    ageHours: 28 * 24 + 4,
    resolvedAfterHours: 4,
    replies: [
      { from: "alice", afterMins: 15, body: "Hi Jordan — which browser/OS are you on?" },
      { from: "customer", afterMins: 40, body: "Chrome on macOS." },
      {
        from: "alice",
        afterMins: 210,
        body: "Found it — your account was flagged after failed attempts and our middleware ate the new session cookie. Flag cleared; please try the reset link once more.",
      },
    ],
  },
  {
    name: "Mei Tanaka",
    email: "mei@solostudio.co",
    subject: "Billing on plan change",
    body: "We downgraded from Team to Solo last week but today's invoice still charges Team. Can you check?\n\nMei",
    category: TicketCategory.billing_inquiry,
    priority: TicketPriority.normal,
    status: TicketStatus.resolved,
    assignee: "noah",
    ageHours: 22 * 24 + 2,
    resolvedAfterHours: 2,
    replies: [
      {
        from: "noah",
        afterMins: 30,
        body: "Hi Mei — confirmed the downgrade went through but the proration credit didn't apply. Refunded the delta ($60); 3–5 business days.",
      },
    ],
  },
  {
    name: "Lena Acker",
    email: "lena@beaconhealth.org",
    subject: "Two-factor codes rejected",
    body: "2FA codes from my authenticator are rejected. Phone time is synced. Locked out completely.\n\nLena",
    category: TicketCategory.technical_question,
    priority: TicketPriority.high,
    status: TicketStatus.resolved,
    assignee: "priya",
    ageHours: 12 * 24 + 6,
    resolvedAfterHours: 5,
    replies: [
      {
        from: "priya",
        afterMins: 12,
        body: "Hi Lena — I'll verify identity before resetting 2FA. Can you reply from the email on file with the last 4 digits of the card we have on record?",
      },
      {
        from: "note",
        afterMins: 60,
        body: "Identity verified against billing record — safe to reset.",
      },
      {
        from: "priya",
        afterMins: 240,
        body: "Verified and 2FA reset. Please re-enroll your authenticator and let me know if anything else comes up.",
      },
    ],
  },
  {
    name: "Priscilla Vo",
    email: "priscilla@deltaflow.com",
    subject: "API rate limit on v2",
    body: "What's the per-minute rate limit on the v2 endpoints? The docs only mention daily.\n\nPriscilla",
    category: TicketCategory.general_question,
    priority: TicketPriority.low,
    status: TicketStatus.resolved,
    assignee: "kofi",
    ageHours: 5 * 24 + 3,
    resolvedAfterHours: 1,
    replies: [
      {
        from: "kofi",
        afterMins: 10,
        body: "Hi Priscilla — 600 req/min on v2 (Pro plan). I'll get the docs page updated, thanks for flagging.",
      },
    ],
  },
  {
    name: "Alex Hu",
    email: "alex@brightline.io",
    subject: "Export missing assigned_to column",
    body: "CSV export no longer includes assigned_to. Can it be added back?\n\nAlex",
    category: TicketCategory.feature_request,
    priority: TicketPriority.normal,
    status: TicketStatus.resolved,
    assignee: "alice",
    ageHours: 1 * 24 + 1,
    resolvedAfterHours: 1,
    replies: [
      {
        from: "alice",
        afterMins: 25,
        body: "Hi Alex — quick fix, it's back in the default export. Re-run and let me know if anything else is missing.",
      },
    ],
  },
  {
    name: "Emily Ross",
    email: "emily@consulting.biz",
    subject: "App crashes on mobile Safari",
    body: "Opening the dashboard on my iPhone (Safari, iOS 17) crashes after ~5 seconds. Fine on desktop Chrome.\n\nEmily",
    category: TicketCategory.technical_question,
    priority: TicketPriority.normal,
    status: TicketStatus.resolved,
    assignee: "mara",
    ageHours: 7 * 24 + 6,
    resolvedAfterHours: 9,
    replies: [
      {
        from: "mara",
        afterMins: 50,
        body: "Hi Emily — tracked it to a memory spike in the chart renderer on iOS. Patch is out; please hard-refresh Safari and retry.",
      },
    ],
  },

  // ── AI auto-resolved (assignee = AI) ────────────────────────────────────
  {
    name: "Hannah Park",
    email: "hannah@design.studio",
    subject: "What's your refund policy?",
    body: "Could you point me to your refund policy? I want the standard window before I submit a request.\n\nHannah",
    category: TicketCategory.general_question,
    priority: TicketPriority.low,
    status: TicketStatus.resolved,
    assignee: "ai",
    ageHours: 2 * 24 + 1,
    resolvedAfterHours: 0.1,
    aiResolved: true,
    replies: [
      {
        from: "ai",
        afterMins: 2,
        body: "Hi Hannah — our standard refund window is 30 days from purchase for unused subscriptions and 14 days for one-off items. You can start a request from Settings → Billing → Request refund. Let us know if you'd like a hand.",
      },
    ],
  },
  {
    name: "Daniel Okafor",
    email: "daniel@logistics.io",
    subject: "Change my notification email",
    body: "I need to change the address that receives ticket notifications. Where's that setting?\n\nDaniel",
    category: TicketCategory.general_question,
    priority: TicketPriority.low,
    status: TicketStatus.resolved,
    assignee: "ai",
    ageHours: 5 * 24 + 1,
    resolvedAfterHours: 0.05,
    aiResolved: true,
    replies: [
      {
        from: "ai",
        afterMins: 1,
        body: "Hi Daniel — head to Settings → Notifications → Recipient email. Update it there and save; a confirmation goes to both the old and new address. Happy to help if you hit a snag.",
      },
    ],
  },

  // ── Escalated by AI to a human ──────────────────────────────────────────
  {
    name: "Victor Salas",
    email: "victor@northwind.trade",
    subject: "Double charge on two cards this month",
    body: "I was charged on both my old and new cards this billing cycle. This needs a person — it's a real duplicate, not proration.\n\nVictor",
    category: TicketCategory.billing_inquiry,
    priority: TicketPriority.high,
    status: TicketStatus.open,
    assignee: "mara",
    ageHours: 5,
    escalated: true,
    replies: [
      {
        from: "mara",
        afterMins: 40,
        body: "Hi Victor — confirmed a duplicate authorisation across both cards. I've voided the second charge; the hold should drop in 1–3 days. Apologies for the scare.",
      },
    ],
  },

  // ── Closed (older) ──────────────────────────────────────────────────────
  {
    name: "James Liu",
    email: "james.liu@agency.net",
    subject: "Upgrade to Pro plan",
    body: "I'd like to upgrade from Starter to Pro. Can you apply it and let me know about any prorated charge?\n\nJames",
    category: TicketCategory.billing_inquiry,
    priority: TicketPriority.normal,
    status: TicketStatus.closed,
    assignee: "noah",
    ageHours: 14 * 24 + 2,
    resolvedAfterHours: 3,
    closedAfterHours: 96,
    replies: [
      {
        from: "noah",
        afterMins: 18,
        body: "Hi James — upgraded to Pro. Prorated charge for the rest of this cycle is $42, on your next invoice. Welcome to Pro!",
      },
    ],
  },
  {
    name: "Iris Holm",
    email: "iris@meadowworks.com",
    subject: "Onboarding help for a 12-person team",
    body: "New here — is there a recommended setup order? We're 12 people.\n\nIris",
    category: TicketCategory.general_question,
    priority: TicketPriority.normal,
    status: TicketStatus.closed,
    assignee: "yuki",
    ageHours: 50 * 24 + 3,
    resolvedAfterHours: 6,
    closedAfterHours: 96,
    replies: [
      {
        from: "yuki",
        afterMins: 22,
        body: "Hi Iris — for a team that size we recommend roles first, then the inbound webhook, then inviting agents. Sent a calendar link for a 20-min onboarding call.",
      },
    ],
  },
  {
    name: "Felix Marr",
    email: "felix@cobaltworks.io",
    subject: "Beta access for AI auto-categorization",
    body: "Is the AI auto-categorization beta still open? We'd love it on our queue.\n\nFelix",
    category: TicketCategory.feature_request,
    priority: TicketPriority.low,
    status: TicketStatus.closed,
    assignee: "yuki",
    ageHours: 75 * 24 + 8,
    resolvedAfterHours: 5,
    closedAfterHours: 96,
    replies: [
      {
        from: "yuki",
        afterMins: 35,
        body: "Hi Felix — enabled for your account; the toggle is in Settings → AI. Beta means no SLA on categorization quality yet, so flag any misses.",
      },
    ],
  },
  {
    name: "Sam Whittle",
    email: "sam@gridpoint.dev",
    subject: "Webhook payload format changed",
    body: "We're seeing nested arrays instead of objects on the attachments field. Was the format changed?\n\nSam",
    category: TicketCategory.technical_question,
    priority: TicketPriority.normal,
    status: TicketStatus.closed,
    assignee: "alice",
    ageHours: 9 * 24 + 2,
    resolvedAfterHours: 1,
    closedAfterHours: 96,
    replies: [
      {
        from: "alice",
        afterMins: 18,
        body: "Hi Sam — yes, the attachments shape changed in last Thursday's release. New format: helpdesk.dev/docs/webhooks#attachments. Sorry we didn't surface it louder.",
      },
    ],
  },
];

async function wipe() {
  // Tickets cascade to replies/audit/notifications/attachments, but delete
  // explicitly + in order to be safe and obvious.
  await prisma.notification.deleteMany({});
  await prisma.auditEvent.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.reply.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.invitation.deleteMany({});

  // Keep the seeded admin + the AI user; remove everyone else (their
  // sessions/accounts cascade).
  const keep = [SEED_ADMIN_EMAIL, AI_USER_EMAIL];
  const doomed = await prisma.user.findMany({
    where: { email: { notIn: keep } },
    select: { id: true },
  });
  const ids = doomed.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.account.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`Wiped demo data (removed ${ids.length} non-essential users).`);
}

async function seedUsers(): Promise<Record<AgentKey, string>> {
  const ctx = await auth.$context;
  const password = await ctx.password.hash(DEMO_PASSWORD);
  const ids = {} as Record<AgentKey, string>;

  for (const [key, a] of Object.entries(AGENTS) as [
    AgentKey,
    (typeof AGENTS)[AgentKey],
  ][]) {
    const id = generateId();
    const joined = hoursAgo(a.joinedDaysAgo * 24);
    await prisma.user.create({
      data: {
        id,
        name: a.name,
        email: a.email,
        emailVerified: true,
        role: a.role,
        status: a.status,
        createdAt: joined,
        updatedAt: joined,
      },
    });
    ids[key] = id;

    if (a.status === UserStatus.invited) {
      // No credential — a pending invite with a live token.
      const { tokenHash } = createInviteToken();
      await prisma.invitation.create({
        data: { userId: id, tokenHash, expiresAt: inviteExpiresAt() },
      });
    } else {
      // active + inactive both have a credential (the gate blocks inactive).
      await prisma.account.create({
        data: {
          id: generateId(),
          accountId: id,
          providerId: "credential",
          userId: id,
          password,
          createdAt: joined,
          updatedAt: joined,
        },
      });

      const lastActive = LAST_ACTIVE_HOURS[key];
      if (lastActive !== undefined) {
        const seen = hoursAgo(lastActive);
        await prisma.session.create({
          data: {
            id: generateId(),
            token: generateId() + generateId(),
            userId: id,
            expiresAt: new Date(Date.now() + 7 * 24 * HOUR),
            createdAt: seen,
            updatedAt: seen,
          },
        });
      }
    }
  }
  console.log(`Created ${Object.keys(AGENTS).length} demo agents/admins.`);
  return ids;
}

async function seedTickets(agentIds: Record<AgentKey, string>, aiUserId: string) {
  const resolve = (a: Author | null): string | null =>
    a == null ? null : a === "ai" ? aiUserId : agentIds[a];

  let ticketCount = 0;
  let replyCount = 0;

  for (const t of TICKETS) {
    const createdAt = hoursAgo(t.ageHours);
    const assignedToId = resolve(t.assignee);
    const resolvedAt =
      t.resolvedAfterHours !== undefined
        ? new Date(createdAt.getTime() + t.resolvedAfterHours * HOUR)
        : null;
    const closedAt =
      t.closedAfterHours !== undefined
        ? new Date(createdAt.getTime() + t.closedAfterHours * HOUR)
        : null;

    // Derive first agent reply + last reply sender from the thread.
    const replies = t.replies ?? [];
    let firstAgentReplyAt: Date | null = null;
    let lastReplySenderType: SenderType | null = null;
    for (const r of replies) {
      const at = minsAfter(createdAt, r.afterMins);
      const senderType =
        r.from === "customer"
          ? SenderType.customer
          : r.from === "note"
            ? SenderType.internal_note
            : SenderType.agent;
      if (senderType === SenderType.agent && firstAgentReplyAt === null) {
        firstAgentReplyAt = at;
      }
      lastReplySenderType = senderType;
    }

    const ticket = await prisma.ticket.create({
      data: {
        fromName: t.name,
        fromEmail: t.email,
        subject: t.subject,
        body: t.body,
        category: t.category,
        priority: t.priority,
        status: t.status,
        assignedToId,
        createdAt,
        updatedAt: resolvedAt ?? createdAt,
        resolvedAt,
        closedAt,
        firstAgentReplyAt,
        lastReplySenderType,
      },
    });
    ticketCount++;

    // Track the AI reply so the auto_resolved audit event can link to it,
    // mirroring the real pipeline (auto-resolve-ticket.ts records the reply id).
    let aiReplyId: number | null = null;
    for (const r of replies) {
      const at = minsAfter(createdAt, r.afterMins);
      const authorId =
        r.from === "customer"
          ? null
          : r.from === "ai"
            ? aiUserId
            : r.from === "note"
              ? assignedToId
              : agentIds[r.from as AgentKey];
      const senderType =
        r.from === "customer"
          ? SenderType.customer
          : r.from === "note"
            ? SenderType.internal_note
            : SenderType.agent;
      const reply = await prisma.reply.create({
        data: { ticketId: ticket.id, authorId, senderType, body: r.body, createdAt: at },
      });
      if (r.from === "ai") aiReplyId = reply.id;
      replyCount++;
    }

    // Audit trail.
    const events: {
      type: AuditEventType;
      actorId: string | null;
      at: Date;
      data?: object;
    }[] = [
      {
        type: AuditEventType.ticket_created,
        actorId: null,
        at: createdAt,
        data: { fromEmail: t.email },
      },
    ];
    if (assignedToId) {
      events.push({
        type: AuditEventType.assignee_changed,
        actorId: t.assignee === "ai" ? null : assignedToId,
        at: minsAfter(createdAt, 1),
        data: { to: assignedToId },
      });
    }
    if (t.escalated) {
      events.push({
        type: AuditEventType.ai_escalated,
        actorId: aiUserId,
        at: minsAfter(createdAt, 2),
        data: { reason: "needs_human" },
      });
    }
    if (t.aiResolved) {
      events.push({
        type: AuditEventType.auto_resolved,
        actorId: aiUserId,
        at: resolvedAt ?? createdAt,
        data: { replyId: aiReplyId },
      });
    } else if (resolvedAt) {
      events.push({
        type: AuditEventType.status_changed,
        actorId: assignedToId,
        at: resolvedAt,
        data: { from: TicketStatus.open, to: TicketStatus.resolved },
      });
    }
    if (closedAt) {
      events.push({
        type: AuditEventType.auto_closed,
        actorId: null,
        at: closedAt,
        data: { from: TicketStatus.resolved, to: TicketStatus.closed },
      });
    }
    for (const e of events) {
      await prisma.auditEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: e.actorId,
          type: e.type,
          data: e.data,
          createdAt: e.at,
        },
      });
    }

    // An unread notification for the assignee on a couple of live tickets, so
    // the bell shows activity.
    if (t.unread && assignedToId) {
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: NotificationType.customer_reply,
          ticketId: ticket.id,
          data: { subject: t.subject, fromName: t.name },
          createdAt: minsAfter(createdAt, 3),
        },
      });
    }
  }

  console.log(`Created ${ticketCount} tickets, ${replyCount} replies + audit trail.`);
}

// ===========================================================================
// Procedural backfill — high-volume "background" traffic so the aggregate
// views (dashboard 30-day chart, SLA compliance ring, and especially the
// Activity Watchlist's 10-week sparklines + 7-day signal thresholds) read like
// a real, busy desk rather than a handful of hand-written tickets.
//
// The hero tickets above stay the curated, readable threads people click into;
// these are the statistics underneath them. Spread across the full 10-week
// (~70-day) Watchlist window, with the CURRENT 7-day week tuned to land the
// five health signals in a deliberate mix of states (see WK9_* below).
// ===========================================================================

// Stable PRNG (mulberry32) so re-runs produce the same dataset — a demo that
// looks identical each seed is easier to talk through than one that drifts.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0xc0ffee);
const randInt = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const randFloat = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;

const DAY = 24 * HOUR;

// Per-priority SLA targets — mirrors SLA_POLICY_DEFAULTS in sla-defaults.ts.
// Used to place firstAgentReplyAt / resolvedAt mostly inside target (so the
// compliance ring lands ~85–90%, not a flat 100%).
const SLA_TARGETS: Record<TicketPriority, { fr: number | null; res: number | null }> = {
  [TicketPriority.urgent]: { fr: 60, res: 240 },
  [TicketPriority.high]: { fr: 240, res: 1440 },
  [TicketPriority.normal]: { fr: 480, res: 4320 },
  [TicketPriority.low]: { fr: 1440, res: null },
};

// Active agents take live load; yuki (now inactive) only owns older tickets,
// reflecting her tenure before deactivation.
const ACTIVE_POOL: AgentKey[] = ["alice", "noah", "priya", "kofi", "mara"];
const HIST_POOL: AgentKey[] = ["alice", "noah", "priya", "kofi", "mara", "yuki"];

// Escalation reasons, split by what they signal. Content-gap reasons drive the
// ai-escalation signal; the two HARD ones additionally drive ai-failures.
// Mirrors escalateToOpen(...) in auto-resolve-ticket.ts.
const CONTENT_REASONS = [
  "ai_chose_escalate",
  "below_confidence_threshold",
  "resolution_gate_category",
  "resolution_gate_assignee",
];
const HARD_REASONS = ["ai_call_failed", "json_parse_failure"];

const FIRST_NAMES = [
  "Oliver",
  "Amara",
  "Lucas",
  "Freya",
  "Mateo",
  "Nadia",
  "Ezra",
  "Lena",
  "Caleb",
  "Ines",
  "Rohan",
  "Talia",
  "Bjorn",
  "Carmen",
  "Devon",
  "Esme",
  "Tobias",
  "Ruth",
  "Malik",
  "Saoirse",
  "Henrik",
  "Paloma",
  "Quinn",
  "Zara",
  "Otis",
  "Marisol",
  "Cyrus",
  "Birgit",
  "Nico",
  "Aiko",
  "Soren",
  "Imani",
  "Hugo",
  "Delphine",
  "Rafael",
  "Noor",
  "Levi",
  "Sana",
  "Gideon",
  "Yara",
];
const LAST_NAMES = [
  "Okonkwo",
  "Vasquez",
  "Larsen",
  "Petrov",
  "Haddad",
  "Bianchi",
  "Nguyen",
  "Sorensen",
  "Khan",
  "Rivera",
  "Adeyemi",
  "Kowalski",
  "Mendez",
  "Falk",
  "Oduya",
  "Castellano",
  "Bauer",
  "Iqbal",
  "Holloway",
  "Romero",
  "Steiner",
  "Abara",
  "Lindgren",
  "Costa",
  "Voss",
  "Maric",
  "Pereira",
];
const DOMAINS = [
  "northgate.io",
  "brightpeak.com",
  "ardent.dev",
  "lumeo.app",
  "tessellate.co",
  "vantix.net",
  "fernwood.org",
  "claritus.io",
  "halcyon.studio",
  "redpine.com",
  "boreal.tech",
  "quill.so",
  "outset.io",
  "meridian.works",
  "cobalt.co",
];

// Per-category opener templates ({subject} drives the list; {body} is short
// realistic prose). Kept compact — these are background volume, not hero copy.
const TEMPLATES: Record<TicketCategory, { subject: string; body: string }[]> = {
  [TicketCategory.general_question]: [
    {
      subject: "How do I add a teammate?",
      body: "Trying to invite a colleague but can't find where. Can you point me to it?",
    },
    {
      subject: "Where are my invoices?",
      body: "I need past invoices for our finance team — where do I download them?",
    },
    {
      subject: "Does the export include attachments?",
      body: "When I export tickets, are file attachments bundled in or just the text?",
    },
    {
      subject: "Time zone for scheduled digests",
      body: "Which time zone do the daily digest emails use? Ours seem an hour off.",
    },
    {
      subject: "Can I rename a category?",
      body: "We'd like to rename one of the ticket categories to match our wording.",
    },
    {
      subject: "What happens when an agent is removed?",
      body: "If I deactivate an agent, what happens to their open tickets?",
    },
  ],
  [TicketCategory.technical_question]: [
    {
      subject: "Webhook returning 500s intermittently",
      body: "About 1 in 20 webhook deliveries fails with a 500 on our end after the last release. Anything change?",
    },
    {
      subject: "API pagination cursor expired",
      body: "Our sync job gets 'cursor expired' midway through large pulls. How long are cursors valid?",
    },
    {
      subject: "SSO redirect loop",
      body: "After enabling SSO, some users bounce between the IdP and the app without landing. Logs attached.",
    },
    {
      subject: "Rate limit headers missing",
      body: "The X-RateLimit headers aren't present on v2 responses — are they being sent?",
    },
    {
      subject: "CSV import drops the last row",
      body: "Importing a 500-row CSV consistently lands 499 records. Trailing newline issue?",
    },
    {
      subject: "Dashboard slow to load on Firefox",
      body: "The dashboard takes 8–10s to paint on Firefox but is instant on Chrome.",
    },
  ],
  [TicketCategory.refund_request]: [
    {
      subject: "Refund for duplicate charge",
      body: "I was billed twice for this month's subscription. Please refund the duplicate.",
    },
    {
      subject: "Cancel and refund unused seats",
      body: "We bought 10 seats but only use 4. Can we refund the 6 unused for this cycle?",
    },
    {
      subject: "Order arrived too late to use",
      body: "The order showed up after our event. We'd like a refund as it's now useless to us.",
    },
    {
      subject: "Refund after accidental upgrade",
      body: "I clicked upgrade by mistake and was charged the annual rate. Can you reverse it?",
    },
    {
      subject: "Partial refund for downtime",
      body: "We had several hours of outage last week — are service credits or a partial refund possible?",
    },
    {
      subject: "Refund to a different card",
      body: "The card I paid with is closed. Can the refund go to a new card?",
    },
  ],
  [TicketCategory.billing_inquiry]: [
    {
      subject: "Why did my invoice go up?",
      body: "This month's invoice is higher than last with no plan change I'm aware of. Can you break it down?",
    },
    {
      subject: "Update billing email",
      body: "Invoices go to the wrong address. Where do I change the billing contact?",
    },
    {
      subject: "Proration on mid-cycle upgrade",
      body: "If I upgrade today, how is the rest of this billing cycle prorated?",
    },
    {
      subject: "VAT number on receipts",
      body: "Our finance team needs our VAT number printed on receipts. Is that possible?",
    },
    {
      subject: "Switch from monthly to annual",
      body: "We'd like to move to annual billing — how is the changeover handled?",
    },
    {
      subject: "Failed payment, card is fine",
      body: "Got a failed-payment notice but the card works elsewhere. Can you retry it?",
    },
  ],
  [TicketCategory.feature_request]: [
    {
      subject: "Bulk-assign tickets",
      body: "Would love to select multiple tickets and assign them to an agent in one action.",
    },
    {
      subject: "Saved filters on the queue",
      body: "Can we save a filter view (e.g. 'my urgent open') and pin it to the sidebar?",
    },
    {
      subject: "Dark mode for the agent app",
      body: "Any plans for a dark theme? We stare at this all day.",
    },
    {
      subject: "Slack notifications per category",
      body: "We'd like Slack pings only for refund_request tickets, not everything.",
    },
    {
      subject: "Customer satisfaction survey",
      body: "Is a post-resolution CSAT survey on the roadmap? We'd use it.",
    },
    {
      subject: "Keyboard shortcuts",
      body: "Power users would love j/k navigation and quick-reply shortcuts.",
    },
  ],
};

const AGENT_ACK = [
  "Thanks for reaching out — taking a look now and will follow up shortly.",
  "Got it, I can help with this. Digging into the details on our side.",
  "Appreciate the report — reproducing it now to find the root cause.",
  "Thanks for flagging this. Pulling up your account to investigate.",
];
const AGENT_RESOLVE = [
  "All sorted on our end — please give it another try and let me know if anything's off.",
  "Fixed and verified. You should be good now; reopen this if it resurfaces.",
  "Done — the change is live for your account. Thanks for your patience!",
  "Resolved. I've also noted it internally so it doesn't recur. Anything else I can do?",
];
const AI_RESOLVE = [
  "Happy to help! You can do this from Settings — here's the exact path and a quick tip. Let us know if you need anything else.",
  "Great question — the short answer is yes, and here's how it works plus where to find it in the app.",
  "Here's what you need: the steps below should sort it in under a minute. Reply if anything looks different on your side.",
];
const CUSTOMER_FOLLOWUP = [
  "Thanks — that worked!",
  "Appreciate the quick turnaround.",
  "Hmm, still seeing it on my end.",
  "Perfect, that's exactly what I needed.",
];

// ── 10-week plan (index 0 = oldest, 9 = current). Counts rise toward the
// present (a growing desk → upward volume sparkline). Rates encode a story:
// escalation falling (KB improving), churn rising (routing degrading → the
// current-week alert). Week 9 numerators are pinned explicitly below so the
// live signal states are exact despite ~14 hero tickets sharing the window.
const COUNTS = [10, 11, 11, 12, 13, 13, 14, 15, 17, 20];
const AI_FRAC = [0.45, 0.45, 0.5, 0.5, 0.5, 0.55, 0.55, 0.6, 0.6, 0.7];
const ESC_FRAC = [0.55, 0.5, 0.5, 0.45, 0.45, 0.4, 0.4, 0.42, 0.42, 0.43];
const HARDFAIL = [0, 1, 0, 0, 1, 0, 0, 0, 1, 2];
const REOPENS = [1, 0, 1, 1, 0, 1, 1, 1, 1, 1];
const PRI_FRAC = [0.08, 0.1, 0.08, 0.1, 0.09, 0.1, 0.1, 0.11, 0.1, 0.09];
const CHURN_FRAC = [0.06, 0.06, 0.08, 0.08, 0.1, 0.1, 0.12, 0.15, 0.18, 0.0];
// Week 9 churn is pinned (not a fraction) so reassignment clears the >15% alert
// line even with ~14 churn-free hero tickets diluting the denominator.
const WK9_CHURN = 7;

type BackfillRole = "ai_resolved" | "escalated" | "human";

function priorityFor(): TicketPriority {
  const r = rnd();
  if (r < 0.07) return TicketPriority.urgent;
  if (r < 0.25) return TicketPriority.high;
  if (r < 0.7) return TicketPriority.normal;
  return TicketPriority.low;
}

async function seedBackfill(agentIds: Record<AgentKey, string>, aiUserId: string) {
  const now = Date.now();
  let tickets = 0;
  let replies = 0;
  let events = 0;

  for (let w = 0; w < 10; w++) {
    const count = COUNTS[w];
    const aiHandled = Math.round(count * AI_FRAC[w]);
    const escalated = Math.round(aiHandled * ESC_FRAC[w]);
    const aiResolved = aiHandled - escalated;
    const hardFails = HARDFAIL[w];
    const reopensLeft0 = REOPENS[w];
    const priChanges = Math.round(count * PRI_FRAC[w]);
    const churnCount = w === 9 ? WK9_CHURN : Math.round(count * CHURN_FRAC[w]);

    // Recent weeks keep some tickets live (open); older weeks are fully wound
    // down (resolved → auto-closed) so ancient tickets don't sit in the queue.
    const humanCount = count - aiHandled;
    const humanOpen = w === 9 ? 3 : w === 8 ? 2 : 0;

    // Build role tags for this week's tickets.
    const roles: BackfillRole[] = [
      ...Array(escalated).fill("escalated" as BackfillRole),
      ...Array(aiResolved).fill("ai_resolved" as BackfillRole),
      ...Array(humanCount).fill("human" as BackfillRole),
    ];

    let reopensLeft = reopensLeft0;
    let hardLeft = hardFails;
    let priLeft = priChanges;
    let churnLeft = churnCount;
    let humanOpenLeft = humanOpen;

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      // createdAt jittered inside week w's 7-day band: age ∈ [(9-w)*7, (10-w)*7) days.
      const ageDays = randFloat((9 - w) * 7 + 0.2, (10 - w) * 7 - 0.2);
      const createdAt = new Date(now - ageDays * DAY);
      const priority = priorityFor();
      const category = Object.values(TicketCategory)[randInt(0, 4)] as TicketCategory;
      const tmpl = pick(TEMPLATES[category]);
      const tname = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const email = `${tname.toLowerCase().replace(/[^a-z]+/g, ".")}@${pick(DOMAINS)}`;
      const target = SLA_TARGETS[priority];

      // Decide final status by role + week age.
      let status: TicketStatus;
      if (role === "ai_resolved") {
        status = w <= 6 ? TicketStatus.closed : TicketStatus.resolved;
      } else if (role === "escalated") {
        // Escalated to a human: recent ones still open, older ones wound down.
        status =
          w >= 9
            ? TicketStatus.open
            : w <= 6
              ? TicketStatus.closed
              : TicketStatus.resolved;
      } else {
        if (humanOpenLeft > 0) {
          status = TicketStatus.open;
          humanOpenLeft--;
        } else {
          status = w <= 6 ? TicketStatus.closed : TicketStatus.resolved;
        }
      }
      const isOpen = status === TicketStatus.open;
      const isClosed = status === TicketStatus.closed;

      // Assignee: AI for auto-resolved; a human otherwise (yuki only on old wks).
      const pool = w <= 4 ? HIST_POOL : ACTIVE_POOL;
      const assigneeKey: AgentKey | "ai" = role === "ai_resolved" ? "ai" : pick(pool);
      const assignedToId = assigneeKey === "ai" ? aiUserId : agentIds[assigneeKey];

      // First response: AI-resolved respond near-instantly; humans within (or
      // sometimes past) target. Open+escalated may have no response yet.
      const ageMs = now - createdAt.getTime();
      let firstAgentReplyAt: Date | null = null;
      const frTarget = target.fr ?? 480;
      const responded = role === "ai_resolved" || !isOpen || chance(0.6);
      if (responded) {
        const frMin =
          role === "ai_resolved"
            ? randFloat(1, 6)
            : (chance(0.82) ? randFloat(0.2, 0.9) : randFloat(1.1, 2.2)) * frTarget;
        const frMs = Math.min(frMin * 60_000, ageMs * 0.4);
        firstAgentReplyAt = new Date(createdAt.getTime() + frMs);
      }

      // Resolution timestamp for resolved/closed tickets.
      let resolvedAt: Date | null = null;
      let closedAt: Date | null = null;
      if (!isOpen) {
        const resTarget = target.res ?? randInt(720, 4320);
        const resMin =
          role === "ai_resolved"
            ? randFloat(2, 12)
            : (chance(0.85) ? randFloat(0.3, 0.95) : randFloat(1.05, 1.8)) * resTarget;
        const resMs = Math.min(resMin * 60_000, ageMs * 0.85);
        resolvedAt = new Date(
          createdAt.getTime() +
            Math.max(
              resMs,
              (firstAgentReplyAt
                ? firstAgentReplyAt.getTime() - createdAt.getTime()
                : 0) + 60_000,
            ),
        );
        if (isClosed) {
          // Auto-close after the quiet period (default 7d), clamped to the past.
          const cAt = resolvedAt.getTime() + 7 * DAY;
          closedAt = new Date(Math.min(cAt, now - 1 * HOUR));
        }
      }

      // Reopen marker: a customer reply reopened the ticket within ~a day of
      // resolution. Modelled faithfully to production (inbound-email.ts): below,
      // status flips back to open and resolvedAt is nulled. The reopened signal
      // reads the resolution audit event + this auto_reopened event, not the
      // (nulled) resolvedAt column.
      let reopenedAt: Date | null = null;
      if (resolvedAt && reopensLeft > 0 && rnd() < 0.5) {
        const candidate = new Date(resolvedAt.getTime() + randFloat(2, 20) * HOUR);
        if (candidate.getTime() < now) {
          reopenedAt = candidate;
          reopensLeft--;
        }
      }

      // Build replies.
      const replyRows: {
        authorId: string | null;
        senderType: SenderType;
        body: string;
        createdAt: Date;
      }[] = [];
      if (role === "ai_resolved" && firstAgentReplyAt) {
        replyRows.push({
          authorId: aiUserId,
          senderType: SenderType.agent,
          body: pick(AI_RESOLVE),
          createdAt: firstAgentReplyAt,
        });
      } else if (firstAgentReplyAt) {
        replyRows.push({
          authorId: assignedToId,
          senderType: SenderType.agent,
          body: pick(AGENT_ACK),
          createdAt: firstAgentReplyAt,
        });
        if (resolvedAt && chance(0.5)) {
          const followAt = new Date(
            (firstAgentReplyAt.getTime() + resolvedAt.getTime()) / 2,
          );
          replyRows.push({
            authorId: null,
            senderType: SenderType.customer,
            body: pick(CUSTOMER_FOLLOWUP),
            createdAt: followAt,
          });
        }
        if (resolvedAt) {
          replyRows.push({
            authorId: assignedToId,
            senderType: SenderType.agent,
            body: pick(AGENT_RESOLVE),
            createdAt: new Date(resolvedAt.getTime() - 60_000),
          });
        }
      }
      const lastReplySenderType = replyRows.length
        ? replyRows[replyRows.length - 1].senderType
        : null;

      // The (first) resolution still happened — it drives the resolution audit
      // event and the reopened-signal denominator. A reopen rolls the ticket's
      // live columns back to open (exactly as the production reopen flow does).
      // Recent reopens (last ~2 weeks) are left open — freshly bounced, still
      // being worked. Older ones have since been re-resolved (and auto-closed if
      // old enough), so the queue doesn't accumulate ancient open tickets.
      const resolutionAt = resolvedAt;
      let secondResolutionAt: Date | null = null;
      if (reopenedAt) {
        if (w >= 8) {
          status = TicketStatus.open;
          resolvedAt = null;
          closedAt = null;
        } else {
          secondResolutionAt = new Date(
            Math.min(reopenedAt.getTime() + randFloat(1, 8) * HOUR, now - HOUR),
          );
          resolvedAt = secondResolutionAt;
          status = w <= 6 ? TicketStatus.closed : TicketStatus.resolved;
          closedAt =
            w <= 6
              ? new Date(Math.min(secondResolutionAt.getTime() + 7 * DAY, now - HOUR))
              : null;
        }
      }

      const ticket = await prisma.ticket.create({
        data: {
          fromName: tname,
          fromEmail: email,
          subject: tmpl.subject,
          body: `${tmpl.body}\n\n${tname.split(" ")[0]}`,
          category,
          priority,
          status,
          assignedToId,
          createdAt,
          updatedAt: closedAt ?? resolvedAt ?? reopenedAt ?? firstAgentReplyAt ?? createdAt,
          resolvedAt,
          closedAt,
          firstAgentReplyAt,
          lastReplySenderType,
        },
      });
      tickets++;

      let aiReplyId: number | null = null;
      for (const r of replyRows) {
        const row = await prisma.reply.create({ data: { ticketId: ticket.id, ...r } });
        if (r.authorId === aiUserId) aiReplyId = row.id;
        replies++;
      }

      // ── Audit events ──
      const ev: {
        type: AuditEventType;
        actorId: string | null;
        data?: object;
        at: Date;
      }[] = [
        {
          type: AuditEventType.ticket_created,
          actorId: null,
          at: createdAt,
          data: { fromEmail: email },
        },
        // AI auto-classification — drives the dashboard "auto-classified" count.
        {
          type: AuditEventType.category_changed,
          actorId: aiUserId,
          at: minsAfter(createdAt, 1),
          data: { to: category },
        },
      ];

      // Assignment / churn: churn tickets get ≥2 assignee_changed (handoffs).
      const wantChurn = role !== "ai_resolved" && churnLeft > 0;
      if (assigneeKey === "ai") {
        ev.push({
          type: AuditEventType.assignee_changed,
          actorId: null,
          at: minsAfter(createdAt, 2),
          data: { to: assignedToId },
        });
      } else if (wantChurn) {
        churnLeft--;
        const hops = randInt(2, 3);
        let prev: string | null = null;
        for (let h = 0; h < hops; h++) {
          const toKey = pick(pool);
          const toId = h === hops - 1 ? assignedToId : agentIds[toKey];
          ev.push({
            type: AuditEventType.assignee_changed,
            actorId: prev,
            at: minsAfter(createdAt, 2 + h * randInt(20, 180)),
            data: { from: prev, to: toId },
          });
          prev = toId;
        }
      } else {
        ev.push({
          type: AuditEventType.assignee_changed,
          actorId: assignedToId,
          at: minsAfter(createdAt, 2),
          data: { to: assignedToId },
        });
      }

      // Priority re-grade.
      if (priLeft > 0 && role !== "ai_resolved" && chance(0.6)) {
        priLeft--;
        ev.push({
          type: AuditEventType.priority_changed,
          actorId: assignedToId,
          at: minsAfter(createdAt, randInt(10, 120)),
          data: { from: TicketPriority.normal, to: priority },
        });
      }

      // Escalation marker (+ hard-failure reason for ai-failures signal).
      if (role === "escalated") {
        const useHard = hardLeft > 0;
        if (useHard) hardLeft--;
        ev.push({
          type: AuditEventType.ai_escalated,
          actorId: aiUserId,
          at: minsAfter(createdAt, randInt(1, 4)),
          data: { reason: useHard ? pick(HARD_REASONS) : pick(CONTENT_REASONS) },
        });
      }

      // Resolution / auto-resolution / close. Use resolutionAt (the original
      // resolve time) so a reopened ticket — whose resolvedAt column is now
      // nulled — still records when it was resolved, feeding the reopened signal.
      if (role === "ai_resolved" && resolutionAt) {
        ev.push({
          type: AuditEventType.auto_resolved,
          actorId: aiUserId,
          at: resolutionAt,
          data: { replyId: aiReplyId },
        });
      } else if (resolutionAt) {
        ev.push({
          type: AuditEventType.status_changed,
          actorId: assignedToId,
          at: resolutionAt,
          data: { from: TicketStatus.open, to: TicketStatus.resolved },
        });
      }
      if (reopenedAt) {
        ev.push({ type: AuditEventType.auto_reopened, actorId: null, at: reopenedAt });
      }
      // Older reopened tickets were re-resolved by a human after the bounce — a
      // second resolution event (no reopen follows it, so it lands in the
      // reopened-signal denominator but not the numerator).
      if (secondResolutionAt) {
        ev.push({
          type: AuditEventType.status_changed,
          actorId: assignedToId,
          at: secondResolutionAt,
          data: { from: TicketStatus.open, to: TicketStatus.resolved },
        });
      }
      if (closedAt) {
        ev.push({
          type: AuditEventType.auto_closed,
          actorId: null,
          at: closedAt,
          data: { from: TicketStatus.resolved, to: TicketStatus.closed },
        });
      }

      for (const e of ev) {
        await prisma.auditEvent.create({
          data: {
            ticketId: ticket.id,
            actorId: e.actorId,
            type: e.type,
            data: e.data,
            createdAt: e.at,
          },
        });
        events++;
      }

      // A few unread bells on recent live tickets so the indicator shows life.
      if (
        isOpen &&
        w === 9 &&
        lastReplySenderType === SenderType.customer &&
        assigneeKey !== "ai"
      ) {
        await prisma.notification.create({
          data: {
            userId: assignedToId,
            type: NotificationType.customer_reply,
            ticketId: ticket.id,
            data: { subject: tmpl.subject, fromName: tname },
            createdAt: minsAfter(createdAt, 5),
          },
        });
      }
    }
  }

  // ── At-risk showcase ── A handful of open tickets pinned into the 75–100%
  // SLA band (between the at_risk threshold and breach) so the amber SLA state
  // is actually represented — the rate-based backfill above leaves open tickets
  // either fresh (ok) or aged-out (breached), never mid-window. Ages are derived
  // from the LIVE policy rows (not the SLA_TARGETS constant) so the band is
  // correct even when an admin has customised a target on the Workflow screen.
  const livePolicies = await prisma.slaPolicy.findMany();
  const liveTarget = new Map(livePolicies.map((p) => [p.priority, p]));
  const bandFraction = 0.82; // ~82% elapsed: safely inside [0.75, 1.0).
  const atRisk: {
    priority: TicketPriority;
    metric: "fr" | "res";
    category: TicketCategory;
  }[] = [
    {
      priority: TicketPriority.urgent,
      metric: "fr",
      category: TicketCategory.billing_inquiry,
    },
    {
      priority: TicketPriority.high,
      metric: "fr",
      category: TicketCategory.technical_question,
    },
    {
      priority: TicketPriority.normal,
      metric: "fr",
      category: TicketCategory.general_question,
    },
    // fr satisfied (early reply) but approaching the resolution target:
    {
      priority: TicketPriority.high,
      metric: "res",
      category: TicketCategory.refund_request,
    },
  ];
  for (const a of atRisk) {
    const pol = liveTarget.get(a.priority);
    const targetMin =
      a.metric === "fr" ? pol?.firstResponseMinutes : pol?.resolutionMinutes;
    if (targetMin == null) continue; // no target for this metric → can't be at-risk
    const minutesAgo = Math.round(targetMin * bandFraction);
    const responded = a.metric === "res"; // res-band tickets have answered first response
    const createdAt = new Date(now - minutesAgo * 60_000);
    const tmpl = pick(TEMPLATES[a.category]);
    const tname = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    const email = `${tname.toLowerCase().replace(/[^a-z]+/g, ".")}@${pick(DOMAINS)}`;
    const agentKey = pick(ACTIVE_POOL);
    const assignedToId = agentIds[agentKey];
    const firstAgentReplyAt = responded ? minsAfter(createdAt, randInt(8, 25)) : null;
    const ticket = await prisma.ticket.create({
      data: {
        fromName: tname,
        fromEmail: email,
        subject: tmpl.subject,
        body: `${tmpl.body}\n\n${tname.split(" ")[0]}`,
        category: a.category,
        priority: a.priority,
        status: TicketStatus.open,
        assignedToId,
        createdAt,
        updatedAt: firstAgentReplyAt ?? createdAt,
        firstAgentReplyAt,
        lastReplySenderType: firstAgentReplyAt ? SenderType.agent : null,
      },
    });
    tickets++;
    if (firstAgentReplyAt) {
      await prisma.reply.create({
        data: {
          ticketId: ticket.id,
          authorId: assignedToId,
          senderType: SenderType.agent,
          body: pick(AGENT_ACK),
          createdAt: firstAgentReplyAt,
        },
      });
      replies++;
    }
    for (const e of [
      {
        type: AuditEventType.ticket_created,
        actorId: null as string | null,
        data: { fromEmail: email },
        at: createdAt,
      },
      {
        type: AuditEventType.category_changed,
        actorId: aiUserId,
        data: { to: a.category },
        at: minsAfter(createdAt, 1),
      },
      {
        type: AuditEventType.assignee_changed,
        actorId: assignedToId,
        data: { to: assignedToId },
        at: minsAfter(createdAt, 2),
      },
    ]) {
      await prisma.auditEvent.create({
        data: {
          ticketId: ticket.id,
          actorId: e.actorId,
          type: e.type,
          data: e.data,
          createdAt: e.at,
        },
      });
      events++;
    }
  }

  console.log(
    `Backfill: ${tickets} tickets, ${replies} replies, ${events} audit events across 10 weeks.`,
  );
}

async function main() {
  const aiUser = await prisma.user.findUnique({ where: { email: AI_USER_EMAIL } });
  if (!aiUser) {
    throw new Error("AI user missing — run `bun run db:seed` first (admin + AI user).");
  }

  await wipe();
  await seedSlaPolicies(); // idempotent; ensures the four policies exist
  const agentIds = await seedUsers();
  await seedTickets(agentIds, aiUser.id);
  await seedBackfill(agentIds, aiUser.id);

  const counts = {
    users: await prisma.user.count({ where: { deletedAt: null } }),
    tickets: await prisma.ticket.count(),
    open: await prisma.ticket.count({ where: { status: TicketStatus.open } }),
    replies: await prisma.reply.count(),
  };
  console.log(
    `Demo seed complete — ${counts.users} users, ${counts.tickets} tickets ` +
      `(${counts.open} open), ${counts.replies} replies.`,
  );
  console.log(`Demo agent login: ${AGENTS.alice.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
