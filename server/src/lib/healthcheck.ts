import { HealthCheckError } from "@godaddy/terminus";
import boss from "./boss";
import { prisma } from "./prisma";

type CheckResult = { ok: true } | { ok: false; error: string };

async function check(fn: () => Promise<unknown>): Promise<CheckResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Probes the load-bearing external dependencies. Returns the per-check status
 * on success; throws HealthCheckError on any failure so terminus can render a
 * 503 with the failure causes attached.
 */
export async function performHealthCheck() {
  const [database, queue] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(() => boss.getQueues()),
  ]);

  if (!database.ok || !queue.ok) {
    throw new HealthCheckError("dependencies unhealthy", { database, queue });
  }

  return { status: "ok", checks: { database, queue } };
}
