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
      await prisma.reply.create({
        data: { ticketId: ticket.id, authorId, senderType, body: r.body, createdAt: at },
      });
      replyCount++;
    }

    // Audit trail.
    const events: {
      type: AuditEventType;
      actorId: string | null;
      at: Date;
      data?: object;
    }[] = [{ type: AuditEventType.ticket_created, actorId: null, at: createdAt }];
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

async function main() {
  const aiUser = await prisma.user.findUnique({ where: { email: AI_USER_EMAIL } });
  if (!aiUser) {
    throw new Error("AI user missing — run `bun run db:seed` first (admin + AI user).");
  }

  await wipe();
  await seedSlaPolicies(); // idempotent; ensures the four policies exist
  const agentIds = await seedUsers();
  await seedTickets(agentIds, aiUser.id);

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
