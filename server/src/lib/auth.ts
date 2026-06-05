import { UserStatus } from "@helpdesk/core";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { sendPasswordResetEmail } from "./email";
import { env } from "./env";
import { prisma } from "./prisma";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.CLIENT_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  rateLimit: {
    enabled: env.NODE_ENV === "production",
    window: 60,
    // 30 is comfortably above the worst-case first-load burst (~12) while still
    // throttling brute-force on /sign-in/email. Better Auth's framework default
    // is 100; we're keeping it tight but not so tight that the client's auth
    // hydration trips it. See client/src/main.tsx for the matching client-side
    // hygiene (no retries on 401/429).
    max: 30,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    // 1h — deliberately tighter than the 72h invite TTL. A reset link is a
    // credential-equivalent; invites only set a password for a brand-new account.
    resetPasswordTokenExpiresIn: 3600,
    // `url` is the server link (/api/auth/reset-password/:token?callbackURL=...);
    // clicking it validates the token then 302s to the client's redirectTo with
    // ?token=... (or ?error=INVALID_TOKEN). Errors propagate so a failed send
    // surfaces rather than silently dropping the reset. Note: this fires for any
    // matching email regardless of status, but the session.create gate below
    // still blocks non-active users from signing in afterward.
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        toName: user.name,
        resetUrl: url,
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "agent",
        input: false,
      },
    },
  },
  // Login gate: a session is only minted on a successful sign-in, so refusing to
  // create one here blocks Invited (no credential anyway) and Inactive users —
  // and the seeded admin/agents are `active`, so they're unaffected. Existing
  // sessions are untouched; deactivation separately deletes them.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true, deletedAt: true },
          });
          if (!user || user.deletedAt || user.status !== UserStatus.active) {
            throw new APIError("FORBIDDEN", {
              message: "Your account is not active. Contact an administrator.",
            });
          }
          return { data: session };
        },
      },
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
