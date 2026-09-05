import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  MIN_REVIEWS_FOR_TOP_RATED,
  SALE_COUNTING_ORDER_STATUS,
  SALE_COUNTING_ORDER_STATUSES,
  DEFAULT_SECTION_SIZE,
  MAX_SECTION_SIZE,
  orderRowsByIds,
  rankBestSellers,
  rankTopRated,
  sectionSize,
} from "../services/storefront-sections";
import { shapeProductRating } from "../services/products";

/**
 * Pure unit tests: nothing here opens a connection. What is tested is every
 * decision that would produce a QUIET wrong answer on the home page — a rail
 * ranked by something that never happened, a "Top Rated" product one friend
 * voted for, a rank computed and then thrown away by the fetch that follows it,
 * or an unreviewed product printed as zero stars.
 */

describe("which order states count as a sale", () => {
  it("counts no state that has not been paid for", () => {
    // The cheapest way to fake a best seller is to fill a cart: anyone can
    // create a PENDING_PAYMENT order, without money changing hands.
    expect(SALE_COUNTING_ORDER_STATUS.PENDING_PAYMENT).toBe(false);
  });

  it("counts no state where the sale was undone", () => {
    // Cancelled, refunded and returned are all reversals. Selling and then
    // giving the money back is not selling.
    expect(SALE_COUNTING_ORDER_STATUS.CANCELLED).toBe(false);
    expect(SALE_COUNTING_ORDER_STATUS.REFUNDED).toBe(false);
    expect(SALE_COUNTING_ORDER_STATUS.RETURNED).toBe(false);
  });

  it("counts every state between payment and delivery", () => {
    // A sale does not become less real because the parcel is still in a van.
    expect(SALE_COUNTING_ORDER_STATUS.PAYMENT_CONFIRMED).toBe(true);
    expect(SALE_COUNTING_ORDER_STATUS.CONFIRMED).toBe(true);
    expect(SALE_COUNTING_ORDER_STATUS.PROCESSING).toBe(true);
    expect(SALE_COUNTING_ORDER_STATUS.SHIPPED).toBe(true);
    expect(SALE_COUNTING_ORDER_STATUS.OUT_FOR_DELIVERY).toBe(true);
    expect(SALE_COUNTING_ORDER_STATUS.DELIVERED).toBe(true);
  });

  it("counts a requested return, because a request is not an outcome", () => {
    // The goods were paid for and delivered. If the return actually happens the
    // order moves to RETURNED or REFUNDED and leaves this set on its own.
    expect(SALE_COUNTING_ORDER_STATUS.RETURN_REQUESTED).toBe(true);
  });

  it("has an entry for every OrderStatus the schema defines", () => {
    // The map is total so that adding an enum member is a compile error rather
    // than a new state silently counted as revenue. This asserts the runtime
    // half of that guarantee: no state may be merely absent.
    for (const status of Object.values(OrderStatus)) {
      expect(SALE_COUNTING_ORDER_STATUS).toHaveProperty(status);
      expect(typeof SALE_COUNTING_ORDER_STATUS[status]).toBe("boolean");
    }
  });

  it("derives the query predicate from the same map", () => {
    const expected = Object.values(OrderStatus).filter((status) => SALE_COUNTING_ORDER_STATUS[status]);
    expect([...SALE_COUNTING_ORDER_STATUSES].sort()).toEqual([...expected].sort());
    expect(SALE_COUNTING_ORDER_STATUSES).not.toContain(OrderStatus.CANCELLED);
    expect(SALE_COUNTING_ORDER_STATUSES).not.toContain(OrderStatus.PENDING_PAYMENT);
  });
});

describe("rankBestSellers", () => {
  it("orders by units sold, most first", () => {
    const ranked = rankBestSellers(
      [
        { productId: "a", units: 3 },
        { productId: "b", units: 40 },
        { productId: "c", units: 12 },
      ],
      10,
    );
    expect(ranked).toEqual(["b", "c", "a"]);
  });

  it("breaks ties on id so the rail does not reshuffle between requests", () => {
    // Equal sums have no defined order in SQL. Without a deterministic tiebreak
    // the 60-second cache serves a different "ranking" every time it refills.
    const groups = [
      { productId: "z", units: 5 },
      { productId: "a", units: 5 },
      { productId: "m", units: 5 },
    ];
    expect(rankBestSellers(groups, 10)).toEqual(["a", "m", "z"]);
    expect(rankBestSellers([...groups].reverse(), 10)).toEqual(["a", "m", "z"]);
  });

  it("drops products that sold nothing rather than ranking them last", () => {
    // "Sold none" is not a position in a best-seller list. A null sum means the
    // aggregate matched no counted line at all.
    expect(rankBestSellers([{ productId: "a", units: 0 }, { productId: "b", units: null }], 10)).toEqual([]);
  });

  it("refuses a non-finite sum rather than sorting NaN into the middle", () => {
    const ranked = rankBestSellers(
      [{ productId: "bad", units: Number.NaN }, { productId: "good", units: 2 }],
      10,
    );
    expect(ranked).toEqual(["good"]);
  });

  it("returns at most the requested number of rows", () => {
    const groups = Array.from({ length: 20 }, (_, i) => ({ productId: `p${i}`, units: 100 - i }));
    expect(rankBestSellers(groups, 5)).toHaveLength(5);
    expect(rankBestSellers(groups, 0)).toEqual([]);
  });

  it("does not mutate the caller's array", () => {
    const groups = [{ productId: "a", units: 1 }, { productId: "b", units: 9 }];
    rankBestSellers(groups, 10);
    expect(groups[0]!.productId).toBe("a");
  });
});

describe("rankTopRated", () => {
  it("keeps a single perfect review from outranking a well-reviewed product", () => {
    // The whole reason the threshold exists. One 5-star review is a 5.0 average
    // and would otherwise sit above a product two hundred buyers rated 4.8.
    const ranked = rankTopRated(
      [
        { productId: "one-friend", average: 5, count: 1 },
        { productId: "well-reviewed", average: 4.8, count: 200 },
      ],
      MIN_REVIEWS_FOR_TOP_RATED,
      10,
    );
    expect(ranked).toEqual(["well-reviewed"]);
  });

  it("admits a product exactly at the threshold and rejects one below it", () => {
    const groups = [
      { productId: "at", average: 4.5, count: MIN_REVIEWS_FOR_TOP_RATED },
      { productId: "below", average: 5, count: MIN_REVIEWS_FOR_TOP_RATED - 1 },
    ];
    expect(rankTopRated(groups, MIN_REVIEWS_FOR_TOP_RATED, 10)).toEqual(["at"]);
  });

  it("orders by average, highest first", () => {
    const ranked = rankTopRated(
      [
        { productId: "mid", average: 4.2, count: 10 },
        { productId: "top", average: 4.9, count: 10 },
        { productId: "low", average: 3.1, count: 10 },
      ],
      3,
      10,
    );
    expect(ranked).toEqual(["top", "mid", "low"]);
  });

  it("breaks an equal average on review count, then on id", () => {
    // Between two products averaging 4.8, the one fifty buyers agree on is the
    // stronger claim; the id keeps the order stable when even that is equal.
    expect(
      rankTopRated(
        [
          { productId: "few", average: 4.8, count: 4 },
          { productId: "many", average: 4.8, count: 50 },
        ],
        3,
        10,
      ),
    ).toEqual(["many", "few"]);
    expect(
      rankTopRated(
        [
          { productId: "z", average: 4.8, count: 4 },
          { productId: "a", average: 4.8, count: 4 },
        ],
        3,
        10,
      ),
    ).toEqual(["a", "z"]);
  });

  it("drops a group with no average rather than treating it as zero stars", () => {
    expect(rankTopRated([{ productId: "a", average: null, count: 9 }], 3, 10)).toEqual([]);
    expect(rankTopRated([{ productId: "a", average: Number.NaN, count: 9 }], 3, 10)).toEqual([]);
  });

  it("honours a caller who raises the bar", () => {
    const groups = [{ productId: "a", average: 5, count: 4 }];
    expect(rankTopRated(groups, MIN_REVIEWS_FOR_TOP_RATED, 10)).toEqual(["a"]);
    expect(rankTopRated(groups, 25, 10)).toEqual([]);
  });

  it("returns at most the requested number of rows", () => {
    const groups = Array.from({ length: 20 }, (_, i) => ({ productId: `p${i}`, average: 5 - i / 100, count: 10 }));
    expect(rankTopRated(groups, 3, 4)).toHaveLength(4);
  });
});

describe("orderRowsByIds", () => {
  const rows = [{ id: "b" }, { id: "a" }, { id: "c" }];

  it("restores the ranked order the database fetch discarded", () => {
    // findMany({ id: { in: ids } }) returns rows in the database's order, which
    // has nothing to do with units sold. Losing the rank here is how a
    // "Best Sellers" rail ends up in arbitrary order while claiming otherwise.
    expect(orderRowsByIds(rows, ["c", "a", "b"]).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("drops an id with no row instead of leaving a hole", () => {
    // A product can lose visibility between the aggregate and the fetch.
    expect(orderRowsByIds(rows, ["a", "gone", "c"]).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("never appends a row that was not ranked", () => {
    // The output is a subsequence of the ranked ids. An extra row here would be
    // a tile in a ranked rail that the ranking never chose.
    expect(orderRowsByIds(rows, ["a"]).map((r) => r.id)).toEqual(["a"]);
    expect(orderRowsByIds(rows, [])).toEqual([]);
  });
});

describe("sectionSize", () => {
  it("defaults when the caller does not choose", () => {
    expect(sectionSize(undefined)).toBe(DEFAULT_SECTION_SIZE);
  });

  it("caps a caller asking for more than a home rail should ever scan", () => {
    // These queries aggregate OrderItem and ProductReview on a public,
    // unauthenticated route; rail size is a layout choice, not a licence.
    expect(sectionSize(10_000)).toBe(MAX_SECTION_SIZE);
  });

  it("never returns a size below one", () => {
    expect(sectionSize(0)).toBe(1);
    expect(sectionSize(-5)).toBe(1);
  });

  it("takes a whole number of rows", () => {
    expect(sectionSize(7.9)).toBe(7);
  });

  it("falls back to the default rather than propagating a non-finite take", () => {
    expect(sectionSize(Number.NaN)).toBe(DEFAULT_SECTION_SIZE);
    expect(sectionSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SECTION_SIZE);
  });
});

describe("shapeProductRating", () => {
  it("returns null, not zero, when nothing has been reviewed", () => {
    // "0 stars" says buyers rated this and hated it. "No rating" says nobody has
    // rated it yet. A tile that draws an empty star row for an unreviewed
    // product states the first while meaning the second.
    expect(shapeProductRating(null, 0)).toBeNull();
    expect(shapeProductRating(0, 0)).toBeNull();
  });

  it("reports a genuinely terrible rating rather than hiding it", () => {
    // The counterpart of the rule above: a real average of 1 is a measurement
    // and must survive, so `null` keeps meaning "unrated" and only that.
    expect(shapeProductRating(1, 4)).toEqual({ average: 1, count: 4 });
  });

  it("carries the count alongside the average", () => {
    expect(shapeProductRating(4.5, 12)).toEqual({ average: 4.5, count: 12 });
  });

  it("rounds the average to two decimals for display", () => {
    expect(shapeProductRating(14 / 3, 3)).toEqual({ average: 4.67, count: 3 });
  });

  it("refuses an average it cannot print rather than rendering NaN stars", () => {
    expect(shapeProductRating(Number.NaN, 5)).toBeNull();
    expect(shapeProductRating(Number.POSITIVE_INFINITY, 5)).toBeNull();
    expect(shapeProductRating(undefined, 5)).toBeNull();
  });

  it("refuses a negative or non-finite count", () => {
    expect(shapeProductRating(4, -1)).toBeNull();
    expect(shapeProductRating(4, Number.NaN)).toBeNull();
  });
});
