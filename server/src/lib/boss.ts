import * as Sentry from "@sentry/node";
import { PgBoss } from "pg-boss";

const boss = new PgBoss(process.env.DATABASE_URL!);
boss.on("error", (err) => {
  console.error("pg-boss error:", err);
  Sentry.captureException(err);
});

export default boss;
