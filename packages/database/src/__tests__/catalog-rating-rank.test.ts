import { describe, expect, it } from "vitest";
import { MAX_RATING_RANKED_PRODUCTS, pageRankedIds } from "../services/products";

/**
 * Paging a catalogue by average rating.
 *
 * Nothing here opens a connection. What is under test is the half of that sort
 * the database cannot do for us: Prisma can order a `findMany` by a relation's
 * `_count` and by nothing else, so an ordering by an AVERAGE over ProductReview
 * has to be produced by a grouped aggregate and then applied here.
 *
 * That makes this the one place in the catalog listing where a page boundary is
 * computed in application code — and a page boundary computed wrongly repeats a
 * product on page 2 and drops another one entirely, which no integration test
 * would notice and no screenshot would show.
 */
describe("pageRankedIds", () => {
  const ranked = ["a", "b", "c", "d", "e"];

  it("orders by the ranking, not by the order rows came back in", () => {
    // The membership set is deliberately shuffled: it answers "does this row
    // survive the filters", never "where does it belong".
    const { ids } = pageRankedIds(ranked, ["d", "a", "c"], 0, 10);
    expect(ids).toEqual(["a", "c", "d"]);
  });

  it("counts the FILTERED set, not the ranking", () => {
    // The total paginates the grid and is printed under the heading. Reporting
    // the ranking's size there would promise pages that do not exist.
    expect(pageRankedIds(ranked, ["b", "e"], 0, 10).total).toBe(2);
  });

  it("walks pages without repeating or dropping a product", () => {
    const matched = ranked;
    const first = pageRankedIds(ranked, matched, 0, 2);
    const second = pageRankedIds(ranked, matched, 2, 2);
    const third = pageRankedIds(ranked, matched, 4, 2);
    expect(first.ids).toEqual(["a", "b"]);
    expect(second.ids).toEqual(["c", "d"]);
    expect(third.ids).toEqual(["e"]);
    expect([...first.ids, ...second.ids, ...third.ids]).toEqual(ranked);
  });

  it("returns an empty page past the end rather than wrapping", () => {
    expect(pageRankedIds(ranked, ranked, 99, 24)).toEqual({ total: 5, ids: [] });
  });

  it("ignores a ranked product the filters excluded", () => {
    // A product may be rated 5.0 and still be out of stock, in another category,
    // or behind a withdrawn seller. The ranking never overrides the filters.
    expect(pageRankedIds(ranked, ["c"], 0, 24)).toEqual({ total: 1, ids: ["c"] });
  });

  it("survives a negative or zero window instead of slicing from the end", () => {
    // Array.slice treats a negative index as an offset from the end, which would
    // silently serve the LAST page to a caller asking for a nonsensical one.
    expect(pageRankedIds(ranked, ranked, -5, 2).ids).toEqual(["a", "b"]);
    expect(pageRankedIds(ranked, ranked, 0, -1).ids).toEqual([]);
  });

  it("accepts a prepared Set without rebuilding it", () => {
    expect(pageRankedIds(ranked, new Set(["a", "e"]), 0, 24).ids).toEqual(["a", "e"]);
  });
});

describe("MAX_RATING_RANKED_PRODUCTS", () => {
  it("is a stated ceiling, not an accident", () => {
    // The ranking is spliced into the listing as `id: { in: [...] }`, so its
    // length is both a query cost and a SQL statement size on a public route.
    // If this ever needs raising, the honest fix is a denormalised average on
    // Product — past the cap, `minRating` quietly becomes "the best N rated".
    expect(MAX_RATING_RANKED_PRODUCTS).toBeGreaterThan(0);
    expect(MAX_RATING_RANKED_PRODUCTS).toBeLessThanOrEqual(5_000);
  });
});
