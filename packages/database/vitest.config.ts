import { defineConfig } from "vitest/config";

/**
 * The PostgreSQL integration suites here are concurrency tests: they open real
 * transactions, take `pg_advisory_xact_lock` fences, and deliberately race two
 * writers against each other. Each of those steps is a network round trip.
 *
 * They were written against a local Postgres, where vitest's 5s default was
 * comfortable. Against a managed remote database (Neon) the same test performs
 * the same work over a WAN link, and the slowest cases — governed purchase-order
 * placement racing a policy mutation — exceed 5s on round-trip latency alone.
 *
 * The timeout is raised rather than the tests weakened: these suites protect the
 * money paths, and the correct response to a slower link is to wait for the
 * assertion, not to stop making it. Keep this well above observed worst case so
 * a genuine deadlock still fails the run instead of hanging it.
 */
export default defineConfig({
  test: {
    testTimeout: 45_000,
    hookTimeout: 45_000,
  },
});
