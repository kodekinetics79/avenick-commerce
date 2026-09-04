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
 * How long the FIRST probe of a process is willing to wait before answering.
 *
 * Blocking for the whole cold budget would be its own bug: a health check that
 * takes 20s to answer can exceed the platform's own per-request timeout, and
 * then it never returns at all — strictly worse than the 2s budget it replaced,
 * and failing for a reason no log would name. So the probe waits only this long
 * for the warm-up to finish, and if it has not, says "starting" immediately
 * while the warm-up carries on in the background.
 *
 * A deploy therefore converges in seconds without any single response ever
 * being slow: probe 1 answers 503 "starting" in well under a second, the
 * connection opens behind it, and the platform's next health check gets a 200.
 */
export const DB_HEALTH_FIRST_ANSWER_MS = 2_500;

/**
 * The ceiling a caller must allow this probe. `runProbe` races every dependency
 * against its own timeout, so a readiness spec allowing less than this would cut
 * the probe short one layer up. Exported so the routes cannot drift from it.
 */
export const DB_HEALTH_PROBE_TIMEOUT_MS = DB_HEALTH_FIRST_ANSWER_MS + 1_500;

/**
 * Per-process, deliberately. It answers "has THIS container ever reached the
 * database", which is exactly the question that separates a cold start from an
 * outage; a shared or persisted flag would let one warm instance vouch for a
 * cold one and hand back the 2s budget it has not earned.
 */
let hasEverConnected = false;

/**
 * The in-flight warm-up, so concurrent probes join one connection attempt
 * instead of each opening their own against a database that is already
 * struggling to wake.
 */
let warmup: Promise<DbHealth> | null = null;

/** Test seam: forget the warm-up state so cold-start behaviour can be asserted. */
export function resetDbHealthWarmState() {
  hasEverConnected = false;
  warmup = null;
}

export function dbHealthTimeoutMs(): number {
  return hasEverConnected ? WARM_TIMEOUT_MS : COLD_TIMEOUT_MS;
}

/** Run `SELECT 1` under an explicit budget. The one place the query is issued. */
async function probe(budgetMs: number): Promise<DbHealth> {
  const warm = hasEverConnected;
  const started = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Database probe timed out after ${budgetMs}ms`)), budgetMs),
      ),
    ]);
    // Only a completed round trip earns the tight budget.
    hasEverConnected = true;
    return { ok: true, latencyMs: Date.now() - started, warm };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      warm,
      error: e instanceof Error ? e.message : "Unknown database error",
    };
  }
}

export async function checkDatabaseHealth(timeoutMs?: number): Promise<DbHealth> {
  return withSpan("db.health", async (span) => {
    // An explicit budget is a caller that knows what it wants (tests, scripts):
    // honour it exactly and stay out of the warm-up machinery.
    if (timeoutMs !== undefined) {
      const direct = await probe(timeoutMs);
      span.setAttribute("db.ok", direct.ok);
      span.setAttribute("db.latency_ms", direct.latencyMs);
      return direct;
    }

    if (hasEverConnected) {
      const result = await probe(WARM_TIMEOUT_MS);
      span.setAttribute("db.ok", result.ok);
      span.setAttribute("db.latency_ms", result.latencyMs);
      span.setAttribute("db.warm", true);
      return result;
    }

    // Cold. Start the warm-up if nobody has, then wait only long enough to
    // answer promptly. The promise is kept either way, so the connection keeps
    // opening after this response goes out and the next probe finds it ready.
    warmup ??= probe(COLD_TIMEOUT_MS).finally(() => {
      warmup = null;
    });

    const starting: DbHealth = {
      ok: false,
      latencyMs: DB_HEALTH_FIRST_ANSWER_MS,
      warm: false,
      error: "database connection is still opening (cold start)",
    };
    const result = await Promise.race([
      warmup,
      new Promise<DbHealth>((resolve) => setTimeout(() => resolve(starting), DB_HEALTH_FIRST_ANSWER_MS)),
    ]);

    span.setAttribute("db.ok", result.ok);
    span.setAttribute("db.latency_ms", result.latencyMs);
    span.setAttribute("db.warm", false);
    return result;
  });
}
