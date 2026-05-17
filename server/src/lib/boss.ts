import * as Sentry from "@sentry/node";
import { PgBoss } from "pg-boss";
import { env } from "./env";
import { logger } from "./logger";

const boss = new PgBoss(env.DATABASE_URL);
boss.on("error", (err) => {
  logger.error({ err }, "pg-boss error");
  Sentry.captureException(err);
});

export default boss;
