import { KbArticleSource, KbArticleStatus, TicketCategory } from "@helpdesk/core";
import { prisma } from "./prisma";

// One-time migration of the legacy knowledge-base.md into structured articles.
// Each Q&A pair from the markdown becomes a published article. Category-specific
// topics map to their TicketCategory (so they're injected only for matching
// tickets); foundational/cross-cutting FAQ is left `null` (general) so it's
// always injected. Section 10 (Escalation Rules) is internal policy, not a
// customer-facing article — it stays hardcoded in buildDraftPrompt and is
// intentionally NOT seeded here.
//
// knowledge-base.md remains in the repo as the human-readable source of these
// rows; the running app no longer reads it (see lib/kb-corpus.ts).
type SeedArticle = {
  title: string;
  question: string;
  answer: string;
  category: TicketCategory | null;
};

const SEED_ARTICLES: SeedArticle[] = [
  // --- Account & Login (general — always injected) ---
  {
    title: "Resetting a forgotten password",
    question: "I forgot my password. What should I do?",
    answer:
      "1. Go to the login page.\n2. Click **Forgot Password**.\n3. Enter your registered email address.\n4. Follow the instructions in the reset email.\n\nIf you do not receive the email, check your spam or promotions folder.",
    category: null,
  },
  {
    title: "Password reset email not arriving",
    question: "I'm not receiving the password reset email.",
    answer:
      "Possible reasons:\n- The email was entered incorrectly.\n- The account was created using a different email.\n- The email is in your spam folder.\n\nIf the email does not arrive within 10 minutes, contact support.",
    category: null,
  },
  // --- Course Access & Purchases (billing) ---
  {
    title: "Purchased course not visible",
    question: "I purchased a course but cannot see it.",
    answer:
      "Possible reasons:\n- You are logged in with a different email address.\n- The payment is still processing.\n- The purchase was not completed successfully.\n\nCheck your receipt email for confirmation.",
    category: TicketCategory.billing_inquiry,
  },
  {
    title: "Transferring a course to another account",
    question: "Can I transfer a purchased course to another account?",
    answer: "Courses are non-transferable and tied to the purchasing account.",
    category: TicketCategory.billing_inquiry,
  },
  // --- Lifetime Access (general) ---
  {
    title: "What Lifetime Access means",
    question: "What does Lifetime Access mean?",
    answer:
      "Lifetime Access means:\n- You pay once.\n- You keep access permanently.\n- You receive future updates for that course.\n\nLifetime Access applies only to the purchased course.",
    category: null,
  },
  // --- Refund Policy (refund) ---
  {
    title: "Refund policy",
    question: "What is the refund policy?",
    answer:
      "- 30-day money-back guarantee.\n- Full refund if requested within 30 days of purchase.\n- Partial refund available if less than 80% of the course has been completed.\n- No refund if 80% or more of the course has been completed.\n\nRefunds are processed within 5–10 business days.",
    category: TicketCategory.refund_request,
  },
  {
    title: "How to request a refund",
    question: "How do I request a refund?",
    answer:
      "To request a refund:\n1. Contact support within 30 days of purchase.\n2. Provide your order receipt.\n3. Include the reason for your request.",
    category: TicketCategory.refund_request,
  },
  // --- Certificates (general) ---
  {
    title: "Course completion certificates",
    question: "Do you provide certificates?",
    answer:
      "Yes. A certificate is issued upon course completion.\n\nCertificates are available inside your dashboard.\n\nCertificates are not accredited degrees.",
    category: null,
  },
  // --- Downloading Content (general) ---
  {
    title: "Downloading videos and source code",
    question: "Can I download videos?",
    answer:
      "- Videos are streamed online.\n- Source code is downloadable.\n- Offline video downloads are not supported.",
    category: null,
  },
  // --- Technical Issues (technical) ---
  {
    title: "Videos not playing",
    question: "Videos are not playing.",
    answer:
      "Try the following:\n- Clear your browser cache.\n- Use the latest version of Chrome or Edge.\n- Disable browser extensions.\n- Check your internet connection.",
    category: TicketCategory.technical_question,
  },
  {
    title: "Low video quality",
    question: "The video quality is low.",
    answer:
      "Video quality adjusts automatically based on internet speed. Ensure you have a stable internet connection.",
    category: TicketCategory.technical_question,
  },
  // --- Coupon Codes (billing) ---
  {
    title: "Coupon code not working",
    question: "My coupon code doesn't work.",
    answer:
      "Possible reasons:\n- The coupon has expired.\n- The coupon was already used.\n- The coupon is not valid for the selected course.\n\nOnly one coupon may be applied per purchase.",
    category: TicketCategory.billing_inquiry,
  },
  // --- Account Changes (general) ---
  {
    title: "Changing your email address",
    question: "How do I change my email address?",
    answer:
      "Contact support and provide:\n- Your current email\n- Your new email\n- Proof of purchase (if requested)",
    category: null,
  },
];

// Idempotent: skips any article whose title already exists, so re-running the
// seed (or running it after admins have edited/added articles) never clobbers
// or duplicates. Mirrors the "survive re-seeding" intent of seedWorkflowSettings.
export async function seedKbArticles() {
  let created = 0;
  for (const article of SEED_ARTICLES) {
    const existing = await prisma.kbArticle.findFirst({
      where: { title: article.title },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.kbArticle.create({
      data: {
        title: article.title,
        question: article.question,
        answer: article.answer,
        category: article.category,
        status: KbArticleStatus.published,
        source: KbArticleSource.seed,
      },
    });
    created += 1;
  }
  console.log(`KB articles seeded (${created} created, ${SEED_ARTICLES.length} total)`);
}
