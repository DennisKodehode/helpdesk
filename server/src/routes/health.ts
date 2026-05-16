import { Router } from "express";
import boss from "../lib/boss";
import { prisma } from "../lib/prisma";

const router = Router();

type CheckResult = { ok: true } | { ok: false; error: string };

async function check(fn: () => Promise<unknown>): Promise<CheckResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

router.get("/", async (_req, res) => {
  const [database, queue] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(() => boss.getQueues()),
  ]);

  const allOk = database.ok && queue.ok;
  res
    .status(allOk ? 200 : 503)
    .set("Cache-Control", "no-store")
    .json({
      status: allOk ? "ok" : "degraded",
      checks: { database, queue },
    });
});

export default router;
