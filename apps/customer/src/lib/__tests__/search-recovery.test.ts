import { describe, expect, it } from "vitest";
import type { CatalogSearchOutcome } from "@avenick/database";
import type { PublicCategory } from "../catalog-categories";
import {
  assembleRecoveryLadder,
  brandBrowseHref,
  brandLabel,
  categoryBrowseHref,
  matchBrands,
  matchCategories,
  normalizeSearchText,
  planSearchRecovery,
  relaxedSearchCandidate,
  rfqHref,
  searchHref,
  verifiedBrandMatches,
  type RecoveryBrand,
} from "../search-recovery";

/**
 * The zero-result ladder and the result-page pivot chips.
 *
 * What is under test is the set of ways a "did you mean" goes wrong quietly:
 * a category offered from a typed list rather than the live tree; a brand
 * whose link lands on an empty grid; a part-number rung shown for a phrase the
 * identifier tiers never ran on; a shorter search offered because it looked
 * plausible rather than because it returned rows. Every assertion here is
 * about what may be CLAIMED, given what was verified.
 */

const cat = (slug: string, nameEn: string, nameAr = "", children: PublicCategory[] = []): PublicCategory => ({
  id: slug,
  slug,
  nameEn,
  nameAr,
  iconName: null,
  children,
});

const TREE: PublicCategory[] = [
  cat("industrial", "Industrial Supplies", "مستلزمات صناعية", [
    cat("fasteners", "Fasteners", "مثبتات", [cat("bolts", "Hex Bolts", "براغي سداسية"), cat("anchors", "Anchors", "مراسي")]),
    cat("power-tools", "Power Tools", "عدد كهربائية", [cat("drills", "Drills", "مثاقب")]),
  ]),
  cat("safety", "Safety & PPE", "السلامة ومعدات الوقاية"),
];

const BRANDS: RecoveryBrand[] = [
  { slug: "bosch", nameEn: "Bosch", nameAr: "بوش", productCount: 12 },
  { slug: "three-m", nameEn: "3M", nameAr: null, productCount: 3 },
  { slug: "makita", nameEn: "Makita", nameAr: null, productCount: 0 },
  { slug: "hilti", nameEn: "Hilti" },
];

/** The catalogue's rule, as the page passes it in: three characters, or identifier-shaped. */
const runnable = (term: string) => term.length >= 3 || /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(term);

const ran = (term: string, strategy: "identifier" | "identifier+text" | "text"): CatalogSearchOutcome => ({ status: "ran", term, strategy });

describe("normalizeSearchText", () => {
  it("folds case, separators and surrounding space", () => {
    expect(normalizeSearchText("  Power-Tools ")).toBe("power tools");
    expect(normalizeSearchText("hex_bolts/m6")).toBe("hex bolts m6");
  });

  it("folds the Arabic spellings a buyer varies between", () => {
    // Diacritics and tatweel are decoration, not identity.
    expect(normalizeSearchText("مِثَبِّتـات")).toBe("مثبتات");
    // Alef variants, ta-marbuta/ha and alef-maqsura/ya compare equal.
    expect(normalizeSearchText("أدوات كهربائية")).toBe(normalizeSearchText("ادوات كهربائيه"));
    expect(normalizeSearchText("مصفى")).toBe(normalizeSearchText("مصفي"));
  });
});

describe("matchCategories", () => {
  it("finds a third-level category by name and reports its trail", () => {
    const [match] = matchCategories(TREE, "hex bolts");
    expect(match?.slug).toBe("bolts");
    expect(match?.trail.map((c) => c.slug)).toEqual(["industrial", "fasteners"]);
  });

  it("matches a name that contains the query, and a query that contains a name", () => {
    expect(matchCategories(TREE, "bolt").map((c) => c.slug)).toEqual(["bolts"]);
    expect(matchCategories(TREE, "bosch power tools 18v").map((c) => c.slug)).toContain("power-tools");
  });

  it("matches word by word, tolerating a plural", () => {
    // "drill" is not a substring of anything, but it is the word "Drills".
    expect(matchCategories(TREE, "bosch drill bits").map((c) => c.slug)).toEqual(["drills"]);
    expect(matchCategories(TREE, "fastener kits").map((c) => c.slug)).toEqual(["fasteners"]);
  });

  it("matches Arabic names, with diacritics and the definite article ignored", () => {
    expect(matchCategories(TREE, "مثاقب")[0]?.slug).toBe("drills");
    expect(matchCategories(TREE, "عُدد كهربائيّة")[0]?.slug).toBe("power-tools");
    expect(matchCategories(TREE, "المثاقب").map((c) => c.slug)).toEqual(["drills"]);
  });

  it("orders by strength of match, then by the tree's own order", () => {
    // "fasteners" is a whole name inside the query; "bolts" is only a shared word.
    expect(matchCategories(TREE, "fasteners bolts").map((c) => c.slug)).toEqual(["fasteners", "bolts"]);
  });

  it("claims nothing for an unrelated query, a blank one, or words too short to mean anything", () => {
    expect(matchCategories(TREE, "gasket")).toEqual([]);
    expect(matchCategories(TREE, "   ")).toEqual([]);
    // "of" is a word in no category and must not become one by prefix.
    expect(matchCategories(TREE, "of")).toEqual([]);
  });

  it("honours the limit", () => {
    expect(matchCategories(TREE, "industrial fasteners bolts anchors", 2)).toHaveLength(2);
  });
});

describe("matchBrands", () => {
  it("matches on English name, Arabic name and slug", () => {
    expect(matchBrands(BRANDS, "bosch drill").map((b) => b.slug)).toEqual(["bosch"]);
    expect(matchBrands(BRANDS, "بوش").map((b) => b.slug)).toEqual(["bosch"]);
    expect(matchBrands(BRANDS, "three m").map((b) => b.slug)).toEqual(["three-m"]);
  });

  it("matches a two-character brand only as a whole word", () => {
    expect(matchBrands(BRANDS, "3m").map((b) => b.slug)).toEqual(["three-m"]);
    expect(matchBrands([{ slug: "x", nameEn: "Some 3mm thing" }], "3m")).toEqual([]);
  });

  it("drops a brand the directory counts at zero, and keeps one it did not count", () => {
    expect(matchBrands(BRANDS, "makita")).toEqual([]);
    expect(matchBrands(BRANDS, "hilti").map((b) => b.slug)).toEqual(["hilti"]);
  });

  it("honours the limit", () => {
    const many: RecoveryBrand[] = ["a", "b", "c", "d"].map((s) => ({ slug: `${s}-tools`, nameEn: `${s.toUpperCase()} Tools` }));
    expect(matchBrands(many, "tools", 3)).toHaveLength(3);
  });
});

describe("verifiedBrandMatches", () => {
  it("keeps only candidates the catalogue counted above zero, carrying the count", () => {
    const candidates = matchBrands(BRANDS, "bosch hilti 3m");
    const verified = verifiedBrandMatches(candidates, new Map([["bosch", 7], ["hilti", 0]]));
    expect(verified.map((b) => [b.slug, b.total])).toEqual([["bosch", 7]]);
  });
});

describe("relaxedSearchCandidate", () => {
  it("drops the last word of a multi-word query", () => {
    expect(relaxedSearchCandidate("bosch drill bits", runnable)).toBe("bosch drill");
    expect(relaxedSearchCandidate("  bosch   drill ", runnable)).toBe("bosch");
  });

  it("offers nothing for a single word", () => {
    expect(relaxedSearchCandidate("bosch", runnable)).toBeNull();
  });

  it("offers nothing the catalogue would refuse to run", () => {
    // "ab c" → "ab" is identifier-shaped and runs under the real rule; under a
    // rule that refuses everything, nothing is offered.
    expect(relaxedSearchCandidate("ab c", runnable)).toBe("ab");
    expect(relaxedSearchCandidate("ab c", () => false)).toBeNull();
  });
});

describe("planSearchRecovery", () => {
  const base = { query: "bosch drill bits", categories: TREE, brands: BRANDS, isRunnable: runnable };

  it("offers the part-number route only when the identifier tiers ran and matched nothing", () => {
    expect(planSearchRecovery({ ...base, query: "X-1145A", search: ran("X-1145A", "identifier+text"), total: 0 }).identifier).toBe("X-1145A");
    expect(planSearchRecovery({ ...base, query: "M6", search: ran("M6", "identifier"), total: 0 }).identifier).toBe("M6");
    // A phrase never touched the identifier tiers, so nothing may be said about part numbers.
    expect(planSearchRecovery({ ...base, search: ran("bosch drill bits", "text"), total: 0 }).identifier).toBeNull();
    // Something matched: no rescue needed.
    expect(planSearchRecovery({ ...base, query: "X-1145A", search: ran("X-1145A", "identifier+text"), total: 4 }).identifier).toBeNull();
    // Refused: no tier ran at all.
    expect(planSearchRecovery({ ...base, query: "مس", search: { status: "too_short", term: "مس", minLength: 3 }, total: 0 }).identifier).toBeNull();
  });

  it("plans a relaxed search only when nothing was found", () => {
    expect(planSearchRecovery({ ...base, search: ran("bosch drill bits", "text"), total: 0 }).relaxedCandidate).toBe("bosch drill");
    expect(planSearchRecovery({ ...base, search: ran("bosch drill bits", "text"), total: 9 }).relaxedCandidate).toBeNull();
    // A refused term is a single short token (two words are already three
    // characters and run), so there is no last word to drop.
    expect(planSearchRecovery({ ...base, query: "مس", search: { status: "too_short", term: "مس", minLength: 3 }, total: 0 }).relaxedCandidate).toBeNull();
  });

  it("finds categories and brand candidates whether or not the search matched, for the pivot chips", () => {
    const plan = planSearchRecovery({ ...base, search: ran("bosch drill bits", "text"), total: 12 });
    expect(plan.categories.map((c) => c.slug)).toEqual(["drills"]);
    expect(plan.brandCandidates.map((b) => b.slug)).toEqual(["bosch"]);
  });
});

describe("assembleRecoveryLadder", () => {
  const plan = planSearchRecovery({
    query: "bosch drill bits",
    search: ran("bosch drill bits", "text"),
    total: 0,
    categories: TREE,
    brands: BRANDS,
    isRunnable: runnable,
  });

  it("renders the rungs in order — categories, brands, part number, shorter search — each backed by verified data", () => {
    const rungs = assembleRecoveryLadder(
      { ...plan, identifier: "X-1", brandCandidates: matchBrands(BRANDS, "bosch hilti") },
      { brandTotals: new Map([["bosch", 7], ["hilti", 0]]), relaxed: { status: "ran", total: 3 } },
    );
    expect(rungs.map((r) => r.kind)).toEqual(["categories", "brands", "identifier", "relaxed"]);
    expect(rungs[1]).toMatchObject({ kind: "brands", items: [{ slug: "bosch", total: 7 }] });
    expect(rungs[2]).toEqual({ kind: "identifier", term: "X-1", href: "/b2b/rfq/new?query=X-1" });
    expect(rungs[3]).toEqual({ kind: "relaxed", term: "bosch drill", total: 3, href: "/search?q=bosch%20drill" });
  });

  it("omits the shorter search unless it was run and returned rows", () => {
    const none = { brandTotals: new Map<string, number>() };
    expect(assembleRecoveryLadder(plan, { ...none, relaxed: null }).map((r) => r.kind)).not.toContain("relaxed");
    expect(assembleRecoveryLadder(plan, { ...none, relaxed: { status: "ran", total: 0 } }).map((r) => r.kind)).not.toContain("relaxed");
    expect(assembleRecoveryLadder(plan, { ...none, relaxed: { status: "too_short", total: 0 } }).map((r) => r.kind)).not.toContain("relaxed");
  });

  it("omits brands that were not verified, and renders no ladder at all when nothing is real", () => {
    const rungs = assembleRecoveryLadder(plan, { brandTotals: new Map(), relaxed: null });
    expect(rungs.map((r) => r.kind)).toEqual(["categories"]);
    expect(assembleRecoveryLadder(
      { categories: [], brandCandidates: [], identifier: null, relaxedCandidate: null },
      { brandTotals: new Map(), relaxed: null },
    )).toEqual([]);
  });
});

describe("hrefs and labels", () => {
  it("encodes every destination", () => {
    expect(categoryBrowseHref("power tools/x")).toBe("/products?category=power%20tools%2Fx");
    expect(brandBrowseHref("3m&co")).toBe("/products?brand=3m%26co");
    expect(searchHref("bosch drill")).toBe("/search?q=bosch%20drill");
    expect(rfqHref("X-1145A/B")).toBe("/b2b/rfq/new?query=X-1145A%2FB");
  });

  it("labels a brand in the visitor's language and falls back to English", () => {
    expect(brandLabel({ nameEn: "Bosch", nameAr: "بوش" }, "ar")).toBe("بوش");
    expect(brandLabel({ nameEn: "Bosch", nameAr: null }, "ar")).toBe("Bosch");
    expect(brandLabel({ nameEn: "Bosch", nameAr: "بوش" }, "en")).toBe("Bosch");
  });
});
