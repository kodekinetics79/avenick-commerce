import { describe, expect, it } from "vitest";
import { rankByUnconvertedAttention, type ListingTrafficRow } from "../services/seller-traffic";

function row(overrides: Partial<ListingTrafficRow> & { sku: string }): ListingTrafficRow {
  return {
    productId: `p-${overrides.sku}`,
    nameEn: overrides.sku,
    status: "ACTIVE",
    views: 0,
    unitsOrdered: 0,
    orderedProductSales: null,
    conversion: null,
    ...overrides,
  };
}

describe("ranking listings by unconverted attention", () => {
  it("puts the most wasted attention first", () => {
    const ranked = rankByUnconvertedAttention([
      // 200 views, converts well: 20 views wasted.
      row({ sku: "converts", views: 200, unitsOrdered: 180, conversion: 0.9 }),
      // 100 views, converts badly: 95 views wasted. Less traffic, more waste.
      row({ sku: "leaks", views: 100, unitsOrdered: 5, conversion: 0.05 }),
      row({ sku: "small", views: 10, unitsOrdered: 1, conversion: 0.1 }),
    ]);
    expect(ranked.map((r) => r.sku)).toEqual(["leaks", "converts", "small"]);
  });

  it("sorts unmeasured listings last, not worst", () => {
    // A listing nobody has seen has not converted badly — it has not been
    // measured. Ranking it as the worst offender would send the seller to
    // rewrite a listing whose only problem is that it is invisible.
    const ranked = rankByUnconvertedAttention([
      row({ sku: "unseen", views: 0, unitsOrdered: 0, conversion: null }),
      row({ sku: "leaks", views: 100, unitsOrdered: 1, conversion: 0.01 }),
      row({ sku: "sold-unseen", views: 0, unitsOrdered: 4, conversion: null }),
    ]);
    expect(ranked[0]!.sku).toBe("leaks");
    expect(ranked.slice(1).map((r) => r.sku).sort()).toEqual(["sold-unseen", "unseen"]);
  });

  it("is a stable total order, so the page does not reshuffle between loads", () => {
    const rows = [
      row({ sku: "b", views: 50, unitsOrdered: 5, conversion: 0.1 }),
      row({ sku: "a", views: 50, unitsOrdered: 5, conversion: 0.1 }),
    ];
    expect(rankByUnconvertedAttention(rows).map((r) => r.sku)).toEqual(["a", "b"]);
    expect(rankByUnconvertedAttention([...rows].reverse()).map((r) => r.sku)).toEqual(["a", "b"]);
  });

  it("does not mutate the caller's array", () => {
    const rows = [row({ sku: "a", views: 1, conversion: 0 }), row({ sku: "b", views: 9, conversion: 0 })];
    rankByUnconvertedAttention(rows);
    expect(rows.map((r) => r.sku)).toEqual(["a", "b"]);
  });
});
