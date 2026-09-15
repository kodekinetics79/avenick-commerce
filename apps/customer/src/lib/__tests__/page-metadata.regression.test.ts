import { beforeEach, describe, expect, it, vi } from "vitest";

const origin = vi.hoisted(() => ({ value: "https://storefront.test" as string | null }));
vi.mock("@avenick/utils/portal-config", () => ({ selfOrigin: () => origin.value }));

import { canonicalFor, listingCanonicalFor, NOINDEX_FOLLOW } from "../page-metadata";

/**
 * Every storefront page had a null canonical, while the same content is reached
 * by /categories/<slug> and /products?category=<slug>, by ?sort and ?page, and by
 * share links with tracking parameters. These pin the three properties that make
 * a canonical worth having: absolute, stripped of the query that creates the
 * duplicates, and absent rather than wrong when the deployment's address is
 * unknown (Next 14.2 would otherwise resolve a relative one against localhost).
 */
describe("canonicalFor", () => {
  beforeEach(() => {
    origin.value = "https://storefront.test";
  });

  it("names the page by its absolute path", () => {
    expect(canonicalFor("/categories/cable-glands")).toEqual({
      alternates: { canonical: "https://storefront.test/categories/cable-glands" },
    });
  });

  it("drops the query string and fragment that create duplicate URLs, and keeps the path", () => {
    expect(canonicalFor("/products?sort=newest&page=3#grid").alternates?.canonical).toBe("https://storefront.test/products");
  });

  it("gives the home page the origin's root", () => {
    expect(canonicalFor("/").alternates?.canonical).toBe("https://storefront.test/");
  });

  it("declares no canonical at all when the deployment's address is not configured", () => {
    origin.value = null;
    expect(canonicalFor("/products")).toEqual({});
  });

  it("keeps search results out of the index while their links stay followable", () => {
    expect(NOINDEX_FOLLOW).toEqual({ index: false, follow: true });
  });
});

/**
 * The first cut named /products as the canonical of /products?page=2, 3, 4… Page
 * three lists different products from page one, so that canonical told a crawler
 * every product past the first page was a duplicate of page one's — the pattern
 * search engines' pagination guidance names as the one not to use.
 */
describe("listingCanonicalFor", () => {
  beforeEach(() => {
    origin.value = "https://storefront.test";
  });

  it.each([undefined, "", "1", "0", "-2", "not-a-number"])("names the listing's path on its first page (page=%s)", (page) => {
    expect(listingCanonicalFor("/products", page).alternates?.canonical).toBe("https://storefront.test/products");
  });

  it.each(["2", "17"])("names no canonical past the first page (page=%s)", (page) => {
    expect(listingCanonicalFor("/products", page)).toEqual({});
    expect(listingCanonicalFor("/categories/cable-glands", page)).toEqual({});
  });
});
