import { withSpan } from "@avenick/observability";
import { db } from "../index";

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Lightweight connectivity probe for readiness checks. Runs inside a "db.health"
 * span so a slow or failing database surfaces as a trace (with timing and the
 * error recorded), not just a boolean — this is what lets you go from "readiness
 * is red" to "the DB round-trip took 1.9s" in one click.
 */
export async function checkDatabaseHealth(timeoutMs = 2000): Promise<DbHealth> {
  return withSpan("db.health", async (span) => {
    const started = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database probe timed out")), timeoutMs),
        ),
      ]);
      const latencyMs = Date.now() - started;
      span.setAttribute("db.latency_ms", latencyMs);
      span.setAttribute("db.ok", true);
      return { ok: true, latencyMs };
    } catch (e) {
      const latencyMs = Date.now() - started;
      span.setAttribute("db.latency_ms", latencyMs);
      span.setAttribute("db.ok", false);
      return {
        ok: false,
        latencyMs,
        error: e instanceof Error ? e.message : "Unknown database error",
      };
    }
  });
}
