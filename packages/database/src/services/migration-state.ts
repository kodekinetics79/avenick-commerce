import { withSpan } from "@avenick/observability";
import { db } from "../index";
import { EXPECTED_MIGRATIONS } from "../generated/migration-manifest";

export type MigrationState = "ready" | "pending" | "failed" | "unknown";

export interface MigrationHealth {
  ok: boolean;
  latencyMs: number;
  state: MigrationState;
  /** Migrations this build expects that the database has not finished applying. */
  pending: string[];
  /** Migrations recorded as rolled back or never finished. */
  failed: string[];
  expected: number;
  applied: number;
  error?: string;
}

export interface MigrationRow {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

/**
 * The decision, separated from the query that feeds it.
 *
 * This is the part that can take three portals out of rotation, so it is a pure
 * function of (rows, expected) and is unit-tested against the shapes a real
 * `_prisma_migrations` table produces — including the one that matters most,
 * a database carrying MORE migrations than this build knows about. Leaving it
 * inline would have made those cases reachable only through a live database,
 * which is how classification bugs reach production wearing a green test suite.
 */
export function classifyMigrations(
  rows: readonly MigrationRow[],
  expected: readonly string[] = EXPECTED_MIGRATIONS,
): { state: Exclude<MigrationState, "unknown">; pending: string[]; failed: string[]; applied: number } {
  const finished = new Set(
    rows.filter((r) => r.finished_at !== null && r.rolled_back_at === null).map((r) => r.migration_name),
  );
  const failed = rows
    .filter((r) => r.rolled_back_at !== null || r.finished_at === null)
    .map((r) => r.migration_name);
  const pending = expected.filter((name) => !finished.has(name));

  // Migrations the DATABASE has that this build does not is the normal shape of
  // a rolling deploy — the newer release has migrated and this older instance
  // is still draining. It is not drift in the direction that breaks queries, so
  // it is deliberately not a failure: treating it as one would 503 every
  // instance of the outgoing version during every deploy that carries a
  // migration, which is precisely when you need them serving.
  const state = failed.length > 0 ? "failed" : pending.length > 0 ? "pending" : "ready";
  return { state, pending, failed, applied: finished.size };
}

/**
 * Is the database actually carrying the schema this build was compiled against?
 *
 * `checkDatabaseHealth` answers "can I reach Postgres", which is a different
 * question and the reason this exists. Migrations are applied by the deploying
 * platform's pre-deploy step, and the portals deploy from more than one place:
 * a Vercel build that finishes before Render's `migrate deploy` serves code
 * whose queries name a column that does not exist yet. Every one of those
 * queries fails, and readiness — reachability being perfect — reports 200 the
 * whole time. A green health check over a broken deployment is worse than no
 * health check, because it is what the rollback decision is made against.
 *
 * WHAT COUNTS AS EVIDENCE. Only a definite answer fails this probe: the
 * migrations table exists, it is readable, and a migration this build expects
 * is missing from it or is recorded as unfinished/rolled back. Everything else
 * — no `_prisma_migrations` table (a schema managed by `db push` rather than by
 * migrate), a query error, a timeout — is reported as `unknown` and left
 * passing, with the reason in the body. A database that cannot answer is
 * already caught by the `database` probe, and failing here too only makes one
 * outage look like two.
 *
 * `ok: false` here does NOT remove the instance from rotation — /api/ready
 * registers this as non-critical, because every instance shares one database
 * and so drift is never something a healthy peer could absorb. See the comment
 * at the call site. What this probe changes is that the drift is stated instead
 * of being invisible behind a green reachability check.
 */
export async function checkMigrationState(timeoutMs = 2000): Promise<MigrationHealth> {
  return withSpan("db.migrations", async (span) => {
    const started = Date.now();
    const base = { expected: EXPECTED_MIGRATIONS.length, applied: 0, pending: [], failed: [] };

    function unknown(error: string, latencyMs: number): MigrationHealth {
      span.setAttribute("db.migrations.state", "unknown");
      // ok: true — see WHAT COUNTS AS EVIDENCE above. The reason travels in the
      // body so an operator reading the detailed probe is never left guessing
      // why the drift check has nothing to say.
      return { ...base, ok: true, latencyMs, state: "unknown", error };
    }

    let rows: MigrationRow[];
    try {
      rows = await Promise.race([
        db.$queryRaw<MigrationRow[]>`
          SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
        `,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("migration probe timed out")), timeoutMs),
        ),
      ]);
    } catch (e) {
      return unknown(e instanceof Error ? e.message : "unknown migration probe error", Date.now() - started);
    }

    const latencyMs = Date.now() - started;

    // An empty table is not proof of drift: it is what a database looks like
    // before its first `migrate deploy`, and also what one looks like when the
    // schema was created by `db push`. Refusing to guess between those is the
    // whole point.
    if (rows.length === 0) return unknown("no migration records", latencyMs);

    const { state, pending, failed, applied } = classifyMigrations(rows);
    span.setAttribute("db.migrations.state", state);
    span.setAttribute("db.migrations.pending", pending.length);

    return {
      ok: state === "ready",
      latencyMs,
      state,
      pending,
      failed,
      expected: EXPECTED_MIGRATIONS.length,
      applied,
      ...(state === "ready"
        ? {}
        : {
            error:
              state === "failed"
                ? `migrations recorded as unfinished or rolled back: ${failed.join(", ")}`
                : `database is missing ${pending.length} migration(s) this build requires: ${pending.join(", ")}`,
          }),
    };
  });
}
