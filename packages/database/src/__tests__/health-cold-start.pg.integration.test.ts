import { beforeEach, describe, expect, it } from "vitest";
import {
  checkDatabaseHealth,
  dbHealthTimeoutMs,
  resetDbHealthWarmState,
  DB_HEALTH_PROBE_TIMEOUT_MS,
  DB_HEALTH_FIRST_ANSWER_MS,
} from "../services/health";

/**
 * The defect: a 2s budget applied to a database that suspends its compute and
 * takes seconds to resume. /api/ready answered 503 on the first probe after
 * boot, and Render gates deploys on /api/ready.
 *
 * The fix has two halves, and the second is easy to get wrong: give the cold
 * process a real budget, but never make a health check WAIT for it. A probe
 * that blocks for the whole cold budget can exceed the platform's own
 * per-request timeout, and then it never answers at all — worse than the tight
 * budget it replaced, and failing for a reason no log would name.
 */
describe("database health cold start", () => {
  beforeEach(() => resetDbHealthWarmState());

  it("allows a cold process far longer than a warm one", () => {
    expect(dbHealthTimeoutMs()).toBeGreaterThanOrEqual(15_000);
  });

  /**
   * The ceiling the readiness route must allow. runProbe races each dependency
   * against the spec's ceiling, so it has to exceed the longest this probe can
   * take when called without an explicit budget — which is the first-answer
   * bound, NOT the cold budget, because the cold budget is served in the
   * background and never awaited by a request.
   */
  it("publishes a ceiling that exceeds the longest possible answer", () => {
    expect(DB_HEALTH_PROBE_TIMEOUT_MS).toBeGreaterThan(DB_HEALTH_FIRST_ANSWER_MS);
  });

  /**
   * The property that protects the deploy: no single call blocks longer than
   * the ceiling the route allows, cold or warm. This is the assertion that
   * would have caught the 20s blocking version.
   */
  it("never blocks longer than its published ceiling, cold or warm", async () => {
    const coldStarted = Date.now();
    await checkDatabaseHealth();
    expect(Date.now() - coldStarted).toBeLessThan(DB_HEALTH_PROBE_TIMEOUT_MS);

    const warmStarted = Date.now();
    await checkDatabaseHealth();
    expect(Date.now() - warmStarted).toBeLessThan(DB_HEALTH_PROBE_TIMEOUT_MS);
  });

  /**
   * Convergence, asserted as convergence rather than as "the first call
   * succeeds". Whether probe one returns ready or "starting" depends on how
   * fast the database wakes, which is the machine's business, not this test's —
   * pinning it is how a timing test starts failing in CI while nothing is
   * wrong. What must be true is that repeated probing reaches warm and stays
   * there, which is exactly what the platform's health check does.
   */
  it("converges to warm, and reports the cold probe honestly", async () => {
    expect(dbHealthTimeoutMs()).toBeGreaterThanOrEqual(15_000);

    const first = await checkDatabaseHealth();
    // Either answer is legitimate; neither may claim to be warm.
    expect(first.warm).toBe(false);
    if (!first.ok) expect(first.error).toMatch(/cold start/i);

    let attempts = 0;
    while (!hasWarmed() && attempts < 40) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await checkDatabaseHealth();
      attempts += 1;
    }
    expect(hasWarmed(), "database never became reachable").toBe(true);

    const settled = await checkDatabaseHealth();
    expect(settled.ok).toBe(true);
    expect(settled.warm).toBe(true);
  });
});

/** Warm state is observable only through the budget it selects. */
function hasWarmed() {
  return dbHealthTimeoutMs() === 2_000;
}
