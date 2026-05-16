import * as Sentry from "@sentry/node";
import { PgBoss } from "pg-boss";
import { env } from "./env";

const boss = new PgBoss(env.DATABASE_URL);
boss.on("error", (err) => {
  console.error("pg-boss error:", err);
  Sentry.captureException(err);
});

export default boss;
