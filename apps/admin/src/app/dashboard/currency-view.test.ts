import { describe, expect, it } from "vitest";
import { channelPercent, formatMoneySeries, trendState } from "./currency-view";

describe("dashboard currency presentation", () => {
  it("formats each currency separately instead of presenting a mixed sum", () => {
    expect(formatMoneySeries([
      { currency: "SAR", amount: 250 },
      { currency: "AED", amount: 100 },
    ], "en")).toBe("AED 100.00 · SAR 250.00");
  });

  it("suppresses a single trend badge when multiple currencies are active", () => {
    expect(trendState([
      { currency: "AED", amount: 100, trend: 10 },
      { currency: "SAR", amount: 250, trend: -5 },
    ])).toEqual({ kind: "multiple-currencies" });
  });

  it("keeps a single-currency trend available", () => {
    expect(trendState([{ currency: "AED", amount: 100, trend: 25 }]))
      .toEqual({ kind: "measured", trend: 25 });
  });

  it("calculates channel share only inside one currency group", () => {
    const aed = { currency: "AED" as const, b2b: 75, b2c: 25, total: 100 };
    const sar = { currency: "SAR" as const, b2b: 10, b2c: 90, total: 100 };
    expect(channelPercent(aed, "b2b")).toBe(75);
    expect(channelPercent(sar, "b2b")).toBe(10);
  });
});
