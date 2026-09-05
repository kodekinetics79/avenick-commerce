import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  MOQ_BULK_FLOOR,
  MOQ_CEILINGS,
  RATING_CHOICES,
  appliedCatalogFilters,
  catalogApiQuery,
  catalogHref,
  formatRatingFloor,
  parseCatalogFilters,
  sortNarrowsToReviewed,
  type CatalogSearchParams,
} from "../../components/products/catalog-filters";

/**
 * The catalogue filter contract.
 *
 * Nothing here opens a connection or renders a component. What is under test is
 * the set of decisions that fail QUIETLY — the failures that a screenshot, a
 * type check and an integration test all pass straight over:
 *
 *  · a filter parsed from the URL and drawn as an active chip, but never put
 *    into the API query — the buyer selects "4.0 and up" and gets the whole
 *    catalogue back under a heading that says they filtered it;
 *  · a filter applied to the query but never reported as active — a legitimately
 *    narrow result that reads as a broken or empty marketplace;
 *  · a "remove this one filter" link that removes another one too, or silently
 *    drops the search term, the sort or the B2B pricing context on the way;
 *  · a malformed parameter treated as a filter, so a hand-edited or truncated
 *    link shows a claim the query never made.
 */

const EMPTY: CatalogSearchParams = {};

describe("parseCatalogFilters", () => {
  it("reads every filter the catalogue supports", () => {
    const filters = parseCatalogFilters({
      category: "power-tools",
      brand: "bosch",
      inStock: "1",
      minRating: "4",
      moqMax: "10",
      sort: "rating",
    });
    expect(filters).toMatchObject({
      category: "power-tools",
      brand: "bosch",
      inStock: true,
      minRating: 4,
      moqMax: 10,
      sort: "rating",
    });
  });

  it("defaults to an unfiltered catalogue in the default order", () => {
    expect(parseCatalogFilters(EMPTY)).toEqual({
      category: undefined,
      brand: undefined,
      inStock: false,
      minRating: undefined,
      moqMin: undefined,
      moqMax: undefined,
      sort: DEFAULT_SORT,
    });
  });

  // Junk must not become a filter. The page renders no chip for a dropped
  // parameter, so the buyer sees the unfiltered catalogue with nothing claiming
  // otherwise — as opposed to a chip that says "Rated NaN+".
  it.each([
    ["a word", { minRating: "banana" }],
    ["above the scale", { minRating: "9" }],
    ["below the scale", { minRating: "0.5" }],
    ["empty", { minRating: "" }],
  ])("drops a rating that is %s", (_case, params) => {
    expect(parseCatalogFilters(params).minRating).toBeUndefined();
  });

  it.each([
    ["fractional", { moqMax: "2.5" }],
    ["zero", { moqMax: "0" }],
    ["negative", { moqMin: "-5" }],
    ["not a number", { moqMax: "ten" }],
  ])("drops a MOQ bound that is %s", (_case, params) => {
    const filters = parseCatalogFilters(params);
    expect(filters.moqMin).toBeUndefined();
    expect(filters.moqMax).toBeUndefined();
  });

  // An inverted window matches nothing while looking perfectly reasonable in the
  // panel — the worst shape a filter bug can take, because the catalogue takes
  // the blame for it.
  it("drops an inverted MOQ window rather than returning nothing", () => {
    const filters = parseCatalogFilters({ moqMin: "100", moqMax: "10" });
    expect(filters.moqMin).toBeUndefined();
    expect(filters.moqMax).toBeUndefined();
  });

  it("honours a MOQ bound that is not one of the sidebar's buckets", () => {
    // `?moqMax=40` is a legitimate shareable link. It highlights no bucket, but
    // it is applied and the chip states the real number.
    expect(parseCatalogFilters({ moqMax: "40" }).moqMax).toBe(40);
  });

  it("falls back to the default order for a sort the query cannot perform", () => {
    // Price above all: there is no single price on a product row to order by.
    expect(parseCatalogFilters({ sort: "price_asc" }).sort).toBe(DEFAULT_SORT);
    expect(parseCatalogFilters({ sort: "" }).sort).toBe(DEFAULT_SORT);
  });

  it("accepts every sort and rating the sidebar can produce", () => {
    for (const rating of RATING_CHOICES) {
      expect(parseCatalogFilters({ minRating: String(rating) }).minRating).toBe(rating);
    }
    for (const ceiling of MOQ_CEILINGS) {
      expect(parseCatalogFilters({ moqMax: String(ceiling) }).moqMax).toBe(ceiling);
    }
    expect(parseCatalogFilters({ moqMin: String(MOQ_BULK_FLOOR) }).moqMin).toBe(MOQ_BULK_FLOOR);
  });
});

describe("catalogHref", () => {
  const current: CatalogSearchParams = {
    search: "bearing",
    category: "power-tools",
    brand: "bosch",
    inStock: "1",
    minRating: "4",
    moqMax: "10",
    sort: "rating",
    b2b: "true",
    currency: "SAR",
    page: "7",
  };

  it("returns to page one on every filter change", () => {
    // Page 7 of the old result set is not a position in the new one.
    expect(catalogHref(current, { brand: undefined })).not.toContain("page=");
  });

  it("keeps the search term, the sort and the governed storefront context", () => {
    const href = catalogHref(current, { category: undefined });
    expect(href).toContain("search=bearing");
    expect(href).toContain("sort=rating");
    expect(href).toContain("b2b=true");
    expect(href).toContain("currency=SAR");
  });

  it("removes exactly one filter and leaves the rest in force", () => {
    const filters = parseCatalogFilters(paramsOf(catalogHref(current, { minRating: undefined })));
    expect(filters.minRating).toBeUndefined();
    expect(filters).toMatchObject({ category: "power-tools", brand: "bosch", inStock: true, moqMax: 10 });
  });

  it("is deterministic, so the same selection is always the same link", () => {
    expect(catalogHref(current, { brand: "makita" })).toBe(catalogHref({ ...current }, { brand: "makita" }));
  });

  it("is the bare catalogue path when nothing is set", () => {
    expect(catalogHref(EMPTY)).toBe("/products");
  });
});

describe("appliedCatalogFilters", () => {
  it("reports nothing on an unfiltered catalogue", () => {
    expect(appliedCatalogFilters(parseCatalogFilters(EMPTY))).toEqual([]);
  });

  it("names every filter that is narrowing the result", () => {
    const params: CatalogSearchParams = {
      category: "power-tools",
      brand: "bosch",
      inStock: "1",
      minRating: "4.5",
      moqMax: "10",
    };
    expect(appliedCatalogFilters(parseCatalogFilters(params)).map((chip) => chip.id)).toEqual([
      "category",
      "brand",
      "inStock",
      "minRating",
      "moqMax",
    ]);
  });

  // The sort is not a filter: it changes the order of an answer, not which
  // question was asked, and it has its own visible control.
  it("does not report the sort or the search term as a filter", () => {
    expect(appliedCatalogFilters(parseCatalogFilters({ sort: "rating", search: "bearing" }))).toEqual([]);
  });

  it("gives each filter an undo that costs no other filter", () => {
    const params: CatalogSearchParams = {
      category: "power-tools",
      brand: "bosch",
      inStock: "1",
      minRating: "4",
      moqMax: "10",
      search: "bearing",
      b2b: "true",
    };
    const applied = appliedCatalogFilters(parseCatalogFilters(params));
    for (const chip of applied) {
      const after = parseCatalogFilters(paramsOf(catalogHref(params, chip.clear)));
      const stillApplied = appliedCatalogFilters(after).map((other) => other.id);
      expect(stillApplied).toEqual(applied.filter((other) => other.id !== chip.id).map((other) => other.id));
    }
  });
});

describe("catalogApiQuery", () => {
  const context = { page: 2, limit: 24, b2b: false } as const;

  it("sends every active filter to the catalog query", () => {
    const filters = parseCatalogFilters({
      category: "power-tools",
      brand: "bosch",
      inStock: "1",
      minRating: "4.5",
      moqMin: "1",
      moqMax: "100",
      sort: "moq_asc",
    });
    const query = catalogApiQuery(filters, { ...context, search: "bearing" });
    expect(Object.fromEntries(query)).toEqual({
      page: "2",
      limit: "24",
      b2c: "true",
      search: "bearing",
      categorySlug: "power-tools",
      brand: "bosch",
      inStock: "true",
      minRating: "4.5",
      moqMin: "1",
      moqMax: "100",
      sort: "moq_asc",
    });
  });

  // Every chip the panel draws must correspond to a parameter the query carries.
  // A chip with no parameter behind it is the exact shape of "the catalogue
  // ignored me".
  it("carries a parameter for every filter it reports as applied", () => {
    const filters = parseCatalogFilters({
      category: "c", brand: "b", inStock: "1", minRating: "3", moqMax: "50",
    });
    const query = catalogApiQuery(filters, context);
    const parameterFor = { category: "categorySlug", brand: "brand", inStock: "inStock", minRating: "minRating", moqMax: "moqMax", moqMin: "moqMin" } as const;
    for (const chip of appliedCatalogFilters(filters)) {
      expect(query.has(parameterFor[chip.id]), `${chip.id} is shown as applied but never queried`).toBe(true);
    }
  });

  it("omits the default sort and switches channel for a company buyer", () => {
    expect(catalogApiQuery(parseCatalogFilters(EMPTY), context).has("sort")).toBe(false);
    const b2b = catalogApiQuery(parseCatalogFilters(EMPTY), { ...context, b2b: true, currency: "SAR" });
    expect(b2b.get("b2b")).toBe("true");
    expect(b2b.has("b2c")).toBe(false);
    expect(b2b.get("currency")).toBe("SAR");
  });
});

describe("disclosure of narrowing the buyer did not ask for", () => {
  it("flags the rating sort, which silently drops every unreviewed product", () => {
    expect(sortNarrowsToReviewed(parseCatalogFilters({ sort: "rating" }))).toBe(true);
  });

  it("does not flag it when the buyer asked for a rating floor themselves", () => {
    expect(sortNarrowsToReviewed(parseCatalogFilters({ sort: "rating", minRating: "4" }))).toBe(false);
  });

  it("does not flag a sort that keeps the whole catalogue", () => {
    expect(sortNarrowsToReviewed(parseCatalogFilters({ sort: "moq_asc" }))).toBe(false);
    expect(sortNarrowsToReviewed(parseCatalogFilters(EMPTY))).toBe(false);
  });
});

describe("formatRatingFloor", () => {
  it("prints one scale, so 4 and 4.5 read as the same kind of number", () => {
    expect(formatRatingFloor(4)).toBe("4.0");
    expect(formatRatingFloor(4.5)).toBe("4.5");
  });
});

/** The query half of a /products href, back as the object the page receives. */
function paramsOf(href: string): CatalogSearchParams {
  const query = new URLSearchParams(href.split("?")[1] ?? "");
  return Object.fromEntries(query) as CatalogSearchParams;
}
