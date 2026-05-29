import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
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
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
