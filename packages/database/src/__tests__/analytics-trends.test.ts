import { describe, expect, it } from "vitest";
import { currencyMetrics, monthOverMonth, selectHighValueBuyers } from "../services/analytics";

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

describe("currencyMetrics", () => {
  it("calculates trends within each currency and never across their sum", () => {
    expect(
      currencyMetrics(
        [
          { currency: "AED", amount: 1_000 },
          { currency: "SAR", amount: 2_000 },
        ],
        [
          { currency: "AED", amount: 150 },
          { currency: "SAR", amount: 100 },
        ],
        [
          { currency: "AED", amount: 100 },
          { currency: "SAR", amount: 200 },
        ],
      ),
    ).toEqual([
      { currency: "AED", amount: 1_000, trend: 50 },
      { currency: "SAR", amount: 2_000, trend: -50 },
    ]);
  });

  it("retains a previous-only currency as a measured 100% decline", () => {
    expect(currencyMetrics([], [], [{ currency: "QAR", amount: 500 }])).toEqual([
      { currency: "QAR", amount: 0, trend: -100 },
    ]);
  });

  it("keeps an unmeasured currency trend null when no prior amount exists", () => {
    expect(
      currencyMetrics([{ currency: "KWD", amount: 10 }], [{ currency: "KWD", amount: 10 }], []),
    ).toEqual([{ currency: "KWD", amount: 10, trend: null }]);
  });
});

describe("selectHighValueBuyers", () => {
  it("selects the top fifth independently within each currency", () => {
    const buyers = selectHighValueBuyers([
      { id: "a", name: "A", email: "a@test", currency: "AED", spent: 100, orders: 1 },
      { id: "b", name: "B", email: "b@test", currency: "AED", spent: 90, orders: 1 },
      { id: "c", name: "C", email: "c@test", currency: "AED", spent: 80, orders: 1 },
      { id: "d", name: "D", email: "d@test", currency: "AED", spent: 70, orders: 1 },
      { id: "e", name: "E", email: "e@test", currency: "AED", spent: 60, orders: 1 },
      { id: "b", name: "B", email: "b@test", currency: "SAR", spent: 200, orders: 2 },
      { id: "a", name: "A", email: "a@test", currency: "SAR", spent: 190, orders: 2 },
      { id: "c", name: "C", email: "c@test", currency: "SAR", spent: 180, orders: 2 },
      { id: "d", name: "D", email: "d@test", currency: "SAR", spent: 170, orders: 2 },
      { id: "e", name: "E", email: "e@test", currency: "SAR", spent: 160, orders: 2 },
    ]);

    expect(buyers.map((buyer) => buyer.id)).toEqual(["a", "b"]);
  });

  it("shows every currency for a qualifying buyer without adding the amounts", () => {
    const [buyer] = selectHighValueBuyers([
      { id: "a", name: "A", email: "a@test", currency: "AED", spent: 100, orders: 1 },
      { id: "a", name: "A", email: "a@test", currency: "SAR", spent: 50, orders: 2 },
      { id: "b", name: "B", email: "b@test", currency: "SAR", spent: 100, orders: 1 },
    ]);

    expect(buyer).toEqual({
      id: "a",
      name: "A",
      email: "a@test",
      spent: [
        { currency: "AED", amount: 100 },
        { currency: "SAR", amount: 50 },
      ],
      orders: 3,
    });
  });
});
