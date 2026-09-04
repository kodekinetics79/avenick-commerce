import { beforeEach, describe, expect, it } from "vitest";
import {
  checkDatabaseHealth,
  dbHealthTimeoutMs,
  resetDbHealthWarmState,
  DB_HEALTH_PROBE_TIMEOUT_MS,
} from "../services/health";

/**
 * The defect these cover: a 2s budget applied to a database that suspends its
 * compute and takes seconds to resume. /api/ready answered 503 on the first
 * probe after boot, Render gates deploys on /api/ready, and so a perfectly
 * healthy release was rolled back in favour of the already-warm version that
 * passed instantly — a deploy that "keeps failing" with nothing in the logs
 * saying timeout, because the timeout was one the probe imposed on itself.
 */
describe("database health cold start", () => {
  beforeEach(() => resetDbHealthWarmState());

  it("allows a cold process far longer than a warm one", () => {
    const cold = dbHealthTimeoutMs();
    expect(cold).toBeGreaterThanOrEqual(15_000);
  });

  /**
   * The bug is only fixed if the CALLER also allows the budget. runProbe races
   * each dependency against the spec's own ceiling, so a ceiling below the cold
   * budget cuts the warm-up short and restores the 503 one layer up — the fix
   * would look present in this file and be absent in production.
   */
  it("publishes a probe ceiling that accommodates the cold budget", () => {
    expect(DB_HEALTH_PROBE_TIMEOUT_MS).toBeGreaterThan(dbHealthTimeoutMs());
  });

  it("tightens to the warm budget only after a completed round trip", async () => {
    expect(dbHealthTimeoutMs()).toBeGreaterThanOrEqual(15_000);

    const first = await checkDatabaseHealth();
    expect(first.ok).toBe(true);
    // The first probe reports itself as having run cold, which is what lets an
    // operator tell a slow start apart from a slow database.
    expect(first.warm).toBe(false);

    expect(dbHealthTimeoutMs()).toBe(2_000);
    const second = await checkDatabaseHealth();
    expect(second.ok).toBe(true);
    expect(second.warm).toBe(true);
  });

  it("does not go warm on a failed probe", async () => {
    // A 1ms budget cannot complete a round trip, so this fails the way a cold
    // database does — and must not earn the tight budget by failing.
    const result = await checkDatabaseHealth(1);
    expect(result.ok).toBe(false);
    expect(dbHealthTimeoutMs()).toBeGreaterThanOrEqual(15_000);
  });
});
