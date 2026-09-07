import { describe, expect, it } from "vitest";
import {
  SUGGEST_LIMIT_MAX,
  assembleSuggestions,
  brandSuggestion,
  categorySuggestion,
  identifierCandidates,
  parseSuggestLimit,
  productSuggestion,
  rankProductSuggestions,
  suggestOutcome,
  suggestProductWhere,
  type BrandSuggestRow,
  type CategorySuggestRow,
  type ProductSuggestRow,
} from "../search-suggest";

const product = (id: string, sku: string, nameEn = `Product ${id}`): ProductSuggestRow => ({ id, slug: id, nameEn, nameAr: `منتج ${id}`, sku });
const category = (slug: string): CategorySuggestRow => ({ slug, nameEn: slug.toUpperCase(), nameAr: slug, parent: null });
const brand = (slug: string): BrandSuggestRow => ({ slug, nameEn: slug.toUpperCase(), nameAr: null });

describe("parseSuggestLimit", () => {
  it("defaults, bounds and rejects junk", () => {
    expect(parseSuggestLimit(null)).toBe(8);
    expect(parseSuggestLimit("3")).toBe(3);
    expect(parseSuggestLimit("50")).toBe(SUGGEST_LIMIT_MAX);
    expect(parseSuggestLimit("0")).toBe(8);
    expect(parseSuggestLimit("2.5")).toBe(8);
    expect(parseSuggestLimit("abc")).toBe(8);
  });
});

describe("suggestOutcome", () => {
  it("passes the catalogue's refusal through with its own floor", () => {
    expect(suggestOutcome({ status: "none" })).toEqual({ status: "none" });
    expect(suggestOutcome({ status: "too_short", term: "a b", minLength: 3 })).toEqual({ status: "too_short", term: "a b", minLength: 3 });
  });

  it("declines a one-character identifier the catalogue would run as an exact SKU", () => {
    expect(suggestOutcome({ status: "ran", term: "M", strategy: "identifier" })).toEqual({ status: "too_short", term: "M", minLength: 2 });
    expect(suggestOutcome({ status: "ran", term: "M6", strategy: "identifier" })).toEqual({ status: "ran", term: "M6", strategy: "identifier" });
  });
});

describe("suggestProductWhere", () => {
  it("asks only for an anchored SKU prefix below the trigram floor", () => {
    const where = suggestProductWhere("m6", "identifier");
    expect(where.OR).toEqual([{ sku: { startsWith: "m6" } }, { sku: { startsWith: "M6" } }]);
    expect(JSON.stringify(where)).not.toContain("contains");
  });

  it("searches the trigram-indexed name and SKU columns for a phrase, never a prefix", () => {
    const where = suggestProductWhere("power tools", "text");
    expect(where.OR).toEqual([
      { nameEn: { contains: "power tools", mode: "insensitive" } },
      { nameAr: { contains: "power tools", mode: "insensitive" } },
      { sku: { contains: "power tools", mode: "insensitive" } },
    ]);
    expect(JSON.stringify(where)).not.toContain("startsWith");
  });

  it("does both for a term that is long enough and identifier-shaped", () => {
    const where = suggestProductWhere("1145a", "identifier+text");
    expect(identifierCandidates("1145a")).toEqual(["1145a", "1145A"]);
    expect(JSON.stringify(where)).toContain("startsWith");
    expect(JSON.stringify(where)).toContain("contains");
  });
});

describe("rankProductSuggestions", () => {
  it("puts an exact SKU first, then SKU prefixes, then name matches, and collapses duplicates", () => {
    const rows = [
      product("c", "ZZ-9", "abc-1 compatible thing"),
      product("b", "ABC-10"),
      product("a", "abc-1"),
      product("a", "abc-1"),
    ];
    expect(rankProductSuggestions(rows, "ABC-1").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("is stable between keystrokes: ties keep name order, then id", () => {
    const rows = [product("2", "K-2", "Beta"), product("1", "K-1", "Alpha"), product("3", "K-3", "Alpha")];
    expect(rankProductSuggestions(rows, "zzz").map((r) => r.id)).toEqual(["1", "3", "2"]);
  });
});

describe("suggestion shapes", () => {
  it("carry a name and a destination and nothing commercial", () => {
    const row = { ...product("p1", "SKU-1", "Socket"), price: 999, inventory: [{ qty: 4 }], commercialMetadata: { purchasePrice: 1 } };
    const suggestion = productSuggestion(row);
    expect(suggestion).toEqual({ kind: "product", label: "Socket", labelAr: "منتج p1", href: "/products/p1", sku: "SKU-1" });
    expect(Object.keys(suggestion).sort()).toEqual(["href", "kind", "label", "labelAr", "sku"]);
    expect(categorySuggestion({ slug: "bolts", nameEn: "Bolts", nameAr: "براغي", parent: { nameEn: "Fasteners", nameAr: "" } })).toEqual({
      kind: "category", label: "Bolts", labelAr: "براغي", href: "/products?category=bolts", parent: { label: "Fasteners", labelAr: null },
    });
    expect(brandSuggestion({ slug: "three-m", nameEn: "3M", nameAr: " " })).toEqual({ kind: "brand", label: "3M", labelAr: null, href: "/products?brand=three-m" });
  });
});

describe("assembleSuggestions", () => {
  const products = Array.from({ length: 10 }, (_, i) => product(`p${i}`, `SKU-${i}`));

  it("reserves two categories and two brands at the head and fills the rest with products", () => {
    const out = assembleSuggestions({ products, categories: [category("a"), category("b"), category("c")], brands: [brand("x"), brand("y"), brand("z")] }, 8);
    expect(out.map((s) => s.kind)).toEqual(["category", "category", "brand", "brand", "product", "product", "product", "product"]);
  });

  it("gives unused structured slots to products, and unused product slots back to categories then brands", () => {
    expect(assembleSuggestions({ products, categories: [], brands: [brand("x")] }, 8).map((s) => s.kind)).toEqual(["brand", ...Array(7).fill("product")]);
    const out = assembleSuggestions({ products: [products[0]!], categories: ["a", "b", "c", "d", "e"].map(category), brands: [] }, 8);
    expect(out.map((s) => s.kind)).toEqual(["category", "category", "category", "category", "category", "product"]);
  });

  it("never exceeds the limit or the hard cap, and pads nothing", () => {
    expect(assembleSuggestions({ products, categories: ["a", "b", "c"].map(category), brands: ["x", "y", "z"].map(brand) }, 3).map((s) => s.kind)).toEqual(["category", "category", "brand"]);
    expect(assembleSuggestions({ products, categories: ["a", "b", "c"].map(category), brands: ["x", "y", "z"].map(brand) }, 20)).toHaveLength(SUGGEST_LIMIT_MAX);
    expect(assembleSuggestions({ products: [], categories: [], brands: [] }, 8)).toEqual([]);
    expect(assembleSuggestions({ products: [products[0]!], categories: [], brands: [] }, 8)).toHaveLength(1);
  });
});
