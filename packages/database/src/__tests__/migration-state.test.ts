import { describe, expect, it } from "vitest";
import { classifyMigrations, type MigrationRow } from "../services/migration-state";

const applied = (name: string): MigrationRow => ({
  migration_name: name,
  finished_at: new Date("2026-01-01T00:00:00Z"),
  rolled_back_at: null,
});
const unfinished = (name: string): MigrationRow => ({
  migration_name: name,
  finished_at: null,
  rolled_back_at: null,
});
const rolledBack = (name: string): MigrationRow => ({
  migration_name: name,
  finished_at: new Date("2026-01-01T00:00:00Z"),
  rolled_back_at: new Date("2026-01-01T00:05:00Z"),
});

const EXPECTED = ["20260101_a", "20260102_b", "20260103_c"];

describe("classifyMigrations", () => {
  it("is ready when the database has finished every migration this build expects", () => {
    const result = classifyMigrations(EXPECTED.map(applied), EXPECTED);
    expect(result).toEqual({ state: "ready", pending: [], failed: [], applied: 3 });
  });

  /**
   * The case this whole probe exists for: a portal deployed ahead of its own
   * migration. Reachability is perfect and every query naming the new column
   * fails, so nothing but this catches it.
   */
  it("reports pending when a migration this build requires is absent", () => {
    const result = classifyMigrations([applied("20260101_a"), applied("20260102_b")], EXPECTED);
    expect(result.state).toBe("pending");
    expect(result.pending).toEqual(["20260103_c"]);
  });

  /**
   * A rolling deploy: the new release has migrated, this older instance is
   * still draining. Failing here would 503 the outgoing version of every
   * deploy that carries a migration — exactly when it still has traffic.
   */
  it("stays ready when the database is AHEAD of this build", () => {
    const rows = [...EXPECTED.map(applied), applied("20260104_d"), applied("20260105_e")];
    expect(classifyMigrations(rows, EXPECTED).state).toBe("ready");
  });

  it("treats an interrupted migration as failed even though its name is present", () => {
    const rows = [applied("20260101_a"), applied("20260102_b"), unfinished("20260103_c")];
    const result = classifyMigrations(rows, EXPECTED);
    expect(result.state).toBe("failed");
    expect(result.failed).toEqual(["20260103_c"]);
    // Unfinished is not applied — it must still be counted as missing, or a
    // half-applied migration would report "failed" and an empty pending list,
    // which reads as "the schema is there, something else went wrong".
    expect(result.pending).toEqual(["20260103_c"]);
  });

  it("treats a rolled-back migration as failed, not applied", () => {
    const rows = [applied("20260101_a"), applied("20260102_b"), rolledBack("20260103_c")];
    const result = classifyMigrations(rows, EXPECTED);
    expect(result.state).toBe("failed");
    expect(result.failed).toEqual(["20260103_c"]);
  });

  it("prefers the failed verdict over pending when both are true", () => {
    // A failed migration and a genuinely missing one. "failed" names an
    // operator action (resolve it); "pending" only means "wait".
    const rows = [applied("20260101_a"), rolledBack("20260102_b")];
    expect(classifyMigrations(rows, EXPECTED).state).toBe("failed");
  });

  it("reports pending in chronological order", () => {
    const result = classifyMigrations([applied("20260102_b")], EXPECTED);
    expect(result.pending).toEqual(["20260101_a", "20260103_c"]);
  });
});
