import { describe, expect, it } from "vitest";
import { billableWeightKg, selectRateBand, type RateBand } from "../services/shipping-zones";

/**
 * The two pure rules delivery pricing turns on. Both are tested without a
 * database because both are where a quiet wrong answer would come from: a
 * weight that understates the parcel, or a band chosen by the wrong comparison.
 */
describe("billable weight", () => {
  it("sums unit weight times quantity", () => {
    expect(billableWeightKg([{ quantity: 3, weightKg: 0.5 }, { quantity: 2, weightKg: 1.25 }])).toBe(4);
  });

  it("returns null when ANY line has no weight", () => {
    // A partial sum understates the parcel, and understating it means charging
    // less than the carrier will. One unweighed item makes the basket unmeasured.
    expect(billableWeightKg([{ quantity: 1, weightKg: 2 }, { quantity: 1, weightKg: null }])).toBeNull();
  });

  it("treats an empty basket as weightless rather than unmeasured", () => {
    expect(billableWeightKg([])).toBe(0);
  });

  it("rounds to the gram", () => {
    expect(billableWeightKg([{ quantity: 3, weightKg: 0.3333 }])).toBe(1);
  });

  it("refuses a non-finite weight rather than propagating NaN into a price", () => {
    expect(billableWeightKg([{ quantity: 1, weightKg: Number.NaN }])).toBeNull();
  });
});

describe("rate band selection", () => {
  const bands: RateBand[] = [
    { minWeightKg: 0, maxWeightKg: 1, price: 15 },
    { minWeightKg: 1, maxWeightKg: 5, price: 25 },
    { minWeightKg: 5, maxWeightKg: null, price: 40 },
  ];

  it("takes the band containing the weight", () => {
    expect(selectRateBand(bands, 0.4)?.price).toBe(15);
    expect(selectRateBand(bands, 3)?.price).toBe(25);
    expect(selectRateBand(bands, 500)?.price).toBe(40);
  });

  it("treats the lower bound as inclusive and the upper as exclusive", () => {
    // Exactly 1kg belongs to the 1–5 band, not the 0–1 band. Getting this
    // backwards double-prices every order that lands on a boundary.
    expect(selectRateBand(bands, 1)?.price).toBe(25);
    expect(selectRateBand(bands, 5)?.price).toBe(40);
  });

  it("is independent of the order the bands arrive in", () => {
    const shuffled = [bands[2]!, bands[0]!, bands[1]!];
    expect(selectRateBand(shuffled, 3)?.price).toBe(25);
  });

  it("returns null when no band covers the weight, rather than the nearest one", () => {
    const gapped: RateBand[] = [{ minWeightKg: 0, maxWeightKg: 1, price: 15 }];
    expect(selectRateBand(gapped, 9)).toBeNull();
  });

  it("returns null for an empty tariff", () => {
    expect(selectRateBand([], 1)).toBeNull();
  });
});

/**
 * The administration guards, exercised through the same half-open arithmetic
 * the service uses. A tariff must be a partition: two bands covering one weight
 * means the price depends on query order, and a gap means checkout refuses an
 * order it should have priced. Both surface far from the mistake that caused
 * them, which is why they are refused at entry.
 */
describe("band overlap arithmetic", () => {
  const overlaps = (a: [number, number | null], b: [number, number | null]) => {
    const [aMin, aMaxRaw] = a; const [bMin, bMaxRaw] = b;
    const aMax = aMaxRaw ?? Number.POSITIVE_INFINITY;
    const bMax = bMaxRaw ?? Number.POSITIVE_INFINITY;
    return aMin < bMax && bMin < aMax;
  };

  it("treats touching bands as adjacent, not overlapping", () => {
    // 0–1 and 1–5 share the boundary and must both be allowed; refusing them
    // would make a complete tariff impossible to enter.
    expect(overlaps([0, 1], [1, 5])).toBe(false);
  });

  it("catches a band contained inside another", () => {
    expect(overlaps([2, 3], [0, 10])).toBe(true);
  });

  it("catches a partial overlap from either direction", () => {
    expect(overlaps([0, 5], [3, 8])).toBe(true);
    expect(overlaps([3, 8], [0, 5])).toBe(true);
  });

  it("catches anything above an open-ended band", () => {
    expect(overlaps([50, null], [80, 90])).toBe(true);
    expect(overlaps([80, 90], [50, null])).toBe(true);
  });

  it("allows a band entirely below an open-ended one", () => {
    expect(overlaps([0, 50], [50, null])).toBe(false);
  });
});
