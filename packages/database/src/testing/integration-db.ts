/**
 * The gate that decides whether a PostgreSQL integration suite may run.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * Every pg/security integration suite used to open with some spelling of:
 *
 *     const run = process.env.DATABASE_URL ? describe.sequential : describe.skip;
 *
 * which reads as "run when a database is configured". In this repository that
 * is not what it means. `.env` points DATABASE_URL at the Neon instance that
 * local development, Render and Vercel all share — the production database. So
 * the condition actually read "run against production whenever a developer has
 * a normal working `.env`", and `pnpm test` at the repo root did exactly that:
 * it created users, sellers, categories, products and orders in the live
 * catalogue, then deleted the ones it could still name.
 *
 * That also explains a symptom the team had already noticed and filed under
 * flakiness: integration suites failing intermittently under concurrency. They
 * were not flaky. They were several developers and CI runs sharing one live
 * database, competing for the same rows.
 *
 * ── What this gate does ──────────────────────────────────────────────────────
 *
 * Presence of a connection string is not consent. A suite runs only when the
 * target is demonstrably disposable:
 *
 *   1. DATABASE_URL points at a local host   → fine; this is CI's postgres
 *      (localhost / 127.0.0.1 / ::1 / db /     service and the docker-compose
 *      postgres / host.docker.internal)        stack from the README.
 *   2. Anything else                         → SKIP, loudly, once.
 *
 * Rule 2 is the whole point: a managed host (neon.tech, *.rds.amazonaws.com,
 * render.com, supabase.co …) is assumed to be somebody's real data until an
 * operator says otherwise, which they do with:
 *
 *     ALLOW_INTEGRATION_TESTS_ON_REMOTE_DB=1
 *
 * Setting that on a machine whose DATABASE_URL is production is the same class
 * of decision as `I_KNOW_THIS_HITS_PRODUCTION=1`, and it prints the host it is
 * about to write to before it proceeds.
 *
 * ── Why there is deliberately no TEST_DATABASE_URL ───────────────────────────
 *
 * A separate opt-in variable would be a trap. The Prisma client is constructed
 * from the `datasource db { url = env("DATABASE_URL") }` block in schema.prisma,
 * so honouring a TEST_DATABASE_URL *here* would let a suite believe it had been
 * pointed at a scratch database while every query still went to whatever
 * DATABASE_URL holds — production. The gate must judge the exact string the
 * client will connect with, and there is only one of those.
 *
 * ── How to run these suites properly ─────────────────────────────────────────
 *
 *     docker compose up -d postgres
 *     DATABASE_URL=postgresql://avenick:avenick@localhost:5432/avenick \
 *       pnpm --filter @avenick/database test
 */

import { describe } from "vitest";

/** Hostnames that are, by definition, not somebody's production data. */
const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "db",
  "postgres",
  "host.docker.internal",
]);

function hostOf(connectionString: string): string | null {
  try {
    // A postgres:// URL parses fine with WHATWG URL; hostname strips brackets.
    return new URL(connectionString).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export type IntegrationTarget =
  | { run: true; url: string; host: string; reason: "local-host" | "operator-override" }
  | { run: false; host: string | null; reason: "no-connection-string" | "remote-host" | "unparseable" };

/** Decide, without side effects, whether these suites may touch a database. */
export function resolveIntegrationTarget(env: NodeJS.ProcessEnv = process.env): IntegrationTarget {
  const url = env.DATABASE_URL?.trim();
  if (!url) return { run: false, host: null, reason: "no-connection-string" };

  const host = hostOf(url);
  if (!host) return { run: false, host: null, reason: "unparseable" };

  if (LOCAL_HOSTS.has(host)) return { run: true, url, host, reason: "local-host" };

  if (env.ALLOW_INTEGRATION_TESTS_ON_REMOTE_DB === "1") {
    return { run: true, url, host, reason: "operator-override" };
  }

  return { run: false, host, reason: "remote-host" };
}

let announced = false;

function announceOnce(target: IntegrationTarget): void {
  if (announced) return;
  announced = true;

  if (target.run && target.reason === "operator-override") {
    console.warn(
      `\n\x1b[33m\x1b[1m[integration]\x1b[0m writing to REMOTE database \x1b[1m${target.host}\x1b[0m ` +
        `because ALLOW_INTEGRATION_TESTS_ON_REMOTE_DB=1.\n` +
        `               These suites create and delete rows. Be certain this is not production.\n`,
    );
    return;
  }

  if (!target.run && target.reason === "remote-host") {
    console.warn(
      `\n\x1b[33m\x1b[1m[integration]\x1b[0m SKIPPED — DATABASE_URL points at \x1b[1m${target.host}\x1b[0m, ` +
        `a remote host.\n` +
        `               These suites write real rows; presence of a connection string is not consent.\n` +
        `               Run them against a disposable database instead:\n` +
        `                 docker compose up -d postgres\n` +
        `                 DATABASE_URL=postgresql://avenick:avenick@localhost:5432/avenick pnpm test\n` +
        `               See packages/database/src/__tests__/integration-db.ts\n`,
    );
  }
}

/**
 * `describe` for a suite that needs a real PostgreSQL.
 *
 * Use in place of the old inline ternary:
 *
 *     const run = integrationSuite();          // sequential by default
 *     const run = integrationSuite("parallel") // when the suite is independent
 */
export function integrationSuite(mode: "sequential" | "parallel" = "sequential"): typeof describe {
  const target = resolveIntegrationTarget();
  announceOnce(target);
  // The annotation is deliberate: vitest's `describe.skip` / `.sequential` infer
  // a type whose name lives in an unnameable internal module, which makes an
  // exported function using it fail `tsc --noEmit` with TS4058. Every variant is
  // the same callable suite API, so widening to `typeof describe` is honest.
  if (!target.run) return describe.skip as typeof describe;
  return (mode === "sequential" ? describe.sequential : describe) as typeof describe;
}

/** True when a suite may touch a database — for the odd file that branches itself. */
export function integrationDbEnabled(): boolean {
  const target = resolveIntegrationTarget();
  announceOnce(target);
  return target.run;
}
