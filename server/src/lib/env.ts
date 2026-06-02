import { z } from "zod";

// BETTER_AUTH_SECRET is already caught by .min(32) since every example
// default is short — only fields without a strong length bound need this list.
const PLACEHOLDER_API_KEYS = new Set(["test-placeholder", "your-key-here"]);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z
      .string()
      .url("must be a valid URL")
      .refine(
        (s) => /^postgres(ql)?:\/\//.test(s),
        "must use the postgres:// or postgresql:// scheme",
      ),
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    BETTER_AUTH_URL: z.url(),
    CLIENT_URL: z
      .string()
      .min(1, "must be non-empty (comma-separated origins)")
      .transform((s) =>
        s
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()).min(1, "at least one origin is required")),
    RESEND_API_KEY: z.string().min(1),
    RESEND_WEBHOOK_SECRET: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    EMAIL_FROM: z.string().min(1).default("support@helpdesk.internal"),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    // Railway Buckets (and AWS/R2) use virtual-hosted-style URLs, so this
    // defaults to false. Set to "true" only for path-style providers (e.g. a
    // local MinIO, or pre-2025 Railway buckets per their Credentials tab).
    // NB: a plain z.coerce.boolean() would treat the string "false" as true.
    S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((s) => s === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of [
        "S3_ENDPOINT",
        "S3_REGION",
        "S3_BUCKET",
        "S3_ACCESS_KEY",
        "S3_SECRET_KEY",
      ] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `must be set when STORAGE_DRIVER=s3`,
          });
        }
      }
    }

    if (env.NODE_ENV !== "production") return;

    if (PLACEHOLDER_API_KEYS.has(env.GOOGLE_GENERATIVE_AI_API_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_GENERATIVE_AI_API_KEY"],
        message: "must not be a placeholder value in production",
      });
    }
    if (/localhost|127\.0\.0\.1/.test(env.BETTER_AUTH_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "must not point at localhost in production",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Check server/.env against server/.env.example.`,
    );
  }
  return result.data;
}

export const env = loadEnv();
