import { withSpan } from "@avenick/observability";
import { db } from "../index";

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
  /** False while this process has never completed a query — a cold start, not an outage. */
  warm: boolean;
  error?: string;
}

/**
 * Two budgets, because "the database is down" and "the database has not woken
 * up yet" are different claims and only one of them should fail a deploy.
 *
 * Neon suspends its compute after inactivity and takes seconds to resume, and a
 * freshly started container also has to open its first pooled connection. The
 * single 2s budget this file used to apply treated that entirely normal startup
 * as a failed dependency: /api/ready answered 503, and since Render gates a
 * deploy on /api/ready, the deploy was marked bad and rolled back to the
 * previous version — which, being already warm, passed its health check
 * immediately. The result is a service that looks like it "keeps failing to
 * deploy" while serving perfectly, and nothing in the logs says the word
 * timeout, because 2s is a timeout the probe imposed on itself.
 *
 * So: a generous budget until this process has proved it can reach the database
 * even once, and a tight one forever after. The tight budget is the one that
 * matters for outage detection — by then a slow SELECT 1 really is a signal —
 * and the generous one is only ever paid on the first probe after boot.
 */
const COLD_TIMEOUT_MS = 20_000;
const WARM_TIMEOUT_MS = 2_000;

/**
 * The ceiling a caller must allow this probe. `runProbe` races every dependency
 * against its own timeout, so a readiness spec that allows less than this would
 * cut the warm-up short and reintroduce the failure above one layer up. Exported
 * so the routes cannot drift from the value they have to accommodate.
 */
export const DB_HEALTH_PROBE_TIMEOUT_MS = COLD_TIMEOUT_MS + 1_000;

/**
 * Per-process, deliberately. It answers "has THIS container ever reached the
 * database", which is exactly the question that separates a cold start from an
 * outage; a shared or persisted flag would let one warm instance vouch for a
 * cold one and hand back the 2s budget it has not earned.
 */
let hasEverConnected = false;

/** Test seam: forget the warm-up state so cold-start behaviour can be asserted. */
export function resetDbHealthWarmState() {
  hasEverConnected = false;
}

export function dbHealthTimeoutMs(): number {
  return hasEverConnected ? WARM_TIMEOUT_MS : COLD_TIMEOUT_MS;
}

/**
 * Connectivity probe for readiness checks. Runs inside a "db.health" span so a
 * slow or failing database surfaces as a trace with timing and the error
 * recorded — this is what lets you go from "readiness is red" to "the DB
 * round-trip took 1.9s" in one click.
 */
export async function checkDatabaseHealth(timeoutMs?: number): Promise<DbHealth> {
  return withSpan("db.health", async (span) => {
    const budget = timeoutMs ?? dbHealthTimeoutMs();
    const warm = hasEverConnected;
    const started = Date.now();
    try {
      await Promise.race([
        db.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Database probe timed out after ${budget}ms`)),
            budget,
          ),
        ),
      ]);
      const latencyMs = Date.now() - started;
      // Only a completed round trip earns the tight budget.
      hasEverConnected = true;
      span.setAttribute("db.latency_ms", latencyMs);
      span.setAttribute("db.ok", true);
      span.setAttribute("db.warm", warm);
      return { ok: true, latencyMs, warm };
    } catch (e) {
      const latencyMs = Date.now() - started;
      span.setAttribute("db.latency_ms", latencyMs);
      span.setAttribute("db.ok", false);
      span.setAttribute("db.warm", warm);
      return {
        ok: false,
        latencyMs,
        warm,
        error: e instanceof Error ? e.message : "Unknown database error",
      };
    }
  });
}
