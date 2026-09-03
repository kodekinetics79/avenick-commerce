import { describe, expect, it } from "vitest";
import { monthOverMonth } from "../services/analytics";

// Pure unit test: nothing here touches the database. Only the arithmetic that
// turns two monthly sums into the percentage the executive dashboard shows —
// and, more importantly, when it refuses to produce one.

describe("monthOverMonth", () => {
  it("returns null, not 0, when the previous month is empty", () => {
    expect(monthOverMonth(100, 0)).toBeNull();
    expect(monthOverMonth(0, 0)).toBeNull();
  });

  it("measures a rise against the previous month", () => {
    expect(monthOverMonth(150, 100)).toBe(50);
  });

  it("measures a fall against the previous month", () => {
    expect(monthOverMonth(100, 200)).toBe(-50);
  });

  it("reports a measured flat month as 0, distinct from unmeasured", () => {
    expect(monthOverMonth(100, 100)).toBe(0);
  });

  it("rounds to a whole percent", () => {
    expect(monthOverMonth(101, 300)).toBe(-66);
    expect(monthOverMonth(4, 3)).toBe(33);
  });

  it("reports a dip that rounds away as 0, never -0", () => {
    // Math.round(-0.1) is -0; the badge must not serialise or compare differently
    // from a measured flat month.
    expect(Object.is(monthOverMonth(999, 1000), 0)).toBe(true);
  });

  it("refuses inputs it cannot measure against", () => {
    expect(monthOverMonth(100, -50)).toBeNull();
    expect(monthOverMonth(Number.NaN, 100)).toBeNull();
    expect(monthOverMonth(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
