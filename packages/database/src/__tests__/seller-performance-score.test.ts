import { describe, expect, it } from "vitest";
import {
  MIN_ORDER_ITEMS_FOR_SCORE,
  MIN_RFQS_FOR_SCORE,
  PERFORMANCE_COMPONENT_WEIGHTS,
  PERFORMANCE_WINDOW_DAYS,
  scoreFromSignals,
  type SellerPerformanceSignals,
} from "../services/seller-settings";

// Pure unit test: every signal below is fabricated by hand and nothing here
// touches the database. The queries in loadSellerPerformanceSignals are not
// under test — only the arithmetic that turns their counts into a score.

function signals(overrides: Partial<SellerPerformanceSignals> = {}): SellerPerformanceSignals {
  return {
    orderItemsInWindow: MIN_ORDER_ITEMS_FOR_SCORE,
    rfqsInWindow: MIN_RFQS_FOR_SCORE,
    fulfilment: { good: 0, total: 0 },
    listing: { good: 0, total: 0 },
    compliance: { good: 0, total: 0 },
    ...overrides,
  };
}

const perfect = { good: 10, total: 10 };
const awful = { good: 0, total: 10 };

const { fulfilment: W_FULFILMENT, listing: W_LISTING, compliance: W_COMPLIANCE } = PERFORMANCE_COMPONENT_WEIGHTS;

describe("scoreFromSignals — insufficient data", () => {
  it("returns null when both activity thresholds are unmet, even with perfect ratios", () => {
    const result = scoreFromSignals(
      signals({
        orderItemsInWindow: MIN_ORDER_ITEMS_FOR_SCORE - 1,
        rfqsInWindow: MIN_RFQS_FOR_SCORE - 1,
        fulfilment: perfect,
        listing: perfect,
        compliance: perfect,
      }),
    );
    expect(result).toBeNull();
  });

  it("scores when only the order threshold is met", () => {
    const result = scoreFromSignals(signals({ orderItemsInWindow: MIN_ORDER_ITEMS_FOR_SCORE, rfqsInWindow: 0, fulfilment: perfect }));
    expect(result?.score).toBe(100);
  });

  it("scores when only the RFQ threshold is met", () => {
    // RFQ activity unlocks the score but is not itself a component (see the
    // service: an assigned RFQ is always a quoted RFQ, so a ratio would be 100%
    // by construction). With nothing else on the account there is no score.
    expect(scoreFromSignals(signals({ orderItemsInWindow: 0, rfqsInWindow: MIN_RFQS_FOR_SCORE }))).toBeNull();
    const result = scoreFromSignals(signals({ orderItemsInWindow: 0, rfqsInWindow: MIN_RFQS_FOR_SCORE, listing: perfect }));
    expect(result?.score).toBe(100);
  });

  it("returns null when thresholds are met but no component has a denominator", () => {
    // Possible in principle: enough paid lines in the window is the fulfilment
    // denominator, so this needs the RFQ threshold with nothing else on file.
    expect(scoreFromSignals(signals({ orderItemsInWindow: 0 }))).toBeNull();
  });
});

describe("scoreFromSignals — components", () => {
  it("has no RFQ responsiveness component", () => {
    const result = scoreFromSignals(signals({ fulfilment: perfect }));
    expect(result?.components.map((component) => component.key)).toEqual(["fulfilment", "listing", "compliance"]);
    expect(Object.keys(PERFORMANCE_COMPONENT_WEIGHTS)).not.toContain("rfq");
  });

  it("weights only the components that have data", () => {
    // Fulfilment perfect, compliance awful, listing absent:
    // 50 / (50 + 25) → 67, not (50 + 0 + 0) / 100 → 50.
    const result = scoreFromSignals(signals({ fulfilment: perfect, compliance: awful }));
    expect(result?.score).toBe(Math.round((W_FULFILMENT / (W_FULFILMENT + W_COMPLIANCE)) * 100));
    expect(result?.score).toBe(67);
  });

  it("marks absent components with a null share and keeps their counts", () => {
    const result = scoreFromSignals(signals({ fulfilment: perfect }));
    const byKey = Object.fromEntries((result?.components ?? []).map((component) => [component.key, component]));
    expect(byKey.fulfilment?.share).toBe(1);
    expect(byKey.listing?.share).toBeNull();
    expect(byKey.compliance?.share).toBeNull();
    expect(byKey.listing).toMatchObject({ good: 0, total: 0 });
  });

  it("applies the documented weights when every component has data", () => {
    // 50·1 + 25·0.2 + 25·0 = 55 out of 100.
    const result = scoreFromSignals(signals({ fulfilment: perfect, listing: { good: 2, total: 10 }, compliance: awful }));
    expect(result?.score).toBe(W_FULFILMENT + Math.round(W_LISTING * 0.2));
    expect(result?.score).toBe(55);
    expect(result?.components.map((component) => component.weight)).toEqual([W_FULFILMENT, W_LISTING, W_COMPLIANCE]);
    expect(result?.windowDays).toBe(PERFORMANCE_WINDOW_DAYS);
  });

  it("documented weights sum to 100 so the tooltip reads as percentages", () => {
    expect(W_FULFILMENT + W_LISTING + W_COMPLIANCE).toBe(100);
  });
});

describe("scoreFromSignals — bounds", () => {
  it("never exceeds 100 when good exceeds total", () => {
    const result = scoreFromSignals(signals({ fulfilment: { good: 50, total: 10 }, listing: { good: 7, total: 3 } }));
    expect(result?.score).toBe(100);
  });

  it("never drops below 0 when good is negative or non-finite", () => {
    const result = scoreFromSignals(signals({ fulfilment: { good: -5, total: 10 }, listing: { good: Number.NaN, total: 4 } }));
    expect(result?.score).toBe(0);
  });

  it("treats a non-finite or non-positive total as no data rather than dividing by it", () => {
    const result = scoreFromSignals(
      signals({ fulfilment: { good: 3, total: Number.POSITIVE_INFINITY }, listing: { good: 3, total: -1 }, compliance: perfect }),
    );
    const byKey = Object.fromEntries((result?.components ?? []).map((component) => [component.key, component]));
    expect(byKey.fulfilment?.share).toBeNull();
    expect(byKey.listing?.share).toBeNull();
    expect(result?.score).toBe(100);
  });

  it("returns an integer", () => {
    const result = scoreFromSignals(signals({ fulfilment: { good: 1, total: 3 }, listing: { good: 2, total: 3 } }));
    expect(Number.isInteger(result?.score)).toBe(true);
    expect(result?.score).toBeGreaterThanOrEqual(0);
    expect(result?.score).toBeLessThanOrEqual(100);
  });
});
