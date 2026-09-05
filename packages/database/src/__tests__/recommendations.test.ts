import { describe, expect, it } from "vitest";
import {
  AFFINITY_SAME_BRAND,
  AFFINITY_SAME_CATEGORY_FAMILY,
  AFFINITY_SAME_LEAF_CATEGORY,
  AFFINITY_SHARED_TAG,
  MAX_BASKET_ANCHORS,
  MAX_SCORED_SHARED_TAGS,
  MIN_BOUGHT_TOGETHER_PRODUCTS,
  MIN_CO_PURCHASE_SUPPORT,
  affinityScore,
  affinityTierWheres,
  coPurchaseLineWhere,
  coPurchaseSupport,
  normaliseBasket,
  normaliseTags,
  rankCartCompletions,
  rankCoPurchases,
  rankRelated,
  type AffinityAnchor,
  type AffinityCandidate,
  type CoPurchaseLine,
} from "../services/recommendations";
import { SALE_COUNTING_ORDER_STATUSES, publicProductWhere } from "../services/storefront-sections";

/**
 * Pure unit tests: nothing here opens a connection. What is tested is every
 * decision that would let a sales surface say something untrue — a "related"
 * rail padded with strangers, a same-brand product outranking a same-category
 * one, a "bought together" rail built from one buyer's one basket, a rank that
 * reshuffles between two requests over the same data, or a candidate predicate
 * that quietly filters on a channel flag nothing in the catalogue sets.
 */

const T0 = new Date("2026-09-01T00:00:00.000Z");
const DAY = 86_400_000;

function anchor(overrides: Partial<AffinityAnchor> = {}): AffinityAnchor {
  return {
    id: "anchor",
    categoryId: "cat-leaf",
    categoryParentId: "cat-parent",
    brandId: "brand-a",
    tags: ["steel", "m10", "zinc"],
    ...overrides,
  };
}

/** A candidate that shares NOTHING with `anchor()` unless a test says so. */
function candidate(id: string, overrides: Partial<AffinityCandidate> = {}): AffinityCandidate {
  return {
    id,
    categoryId: "cat-unrelated",
    categoryParentId: "cat-unrelated-parent",
    brandId: null,
    tags: [],
    createdAt: T0,
    rating: null,
    ...overrides,
  };
}

const sameLeaf = { categoryId: "cat-leaf", categoryParentId: "cat-parent" } as const;
const sibling = { categoryId: "cat-sibling", categoryParentId: "cat-parent" } as const;
const sameBrand = { brandId: "brand-a" } as const;

function line(productId: string, buyerId: string): CoPurchaseLine {
  return { productId, buyerId };
}

describe("affinity weights", () => {
  it("lets every signal outweigh all weaker signals combined", () => {
    // The whole design: a product in the same leaf category cannot be outvoted
    // by a coalition of brand and tags, and so on down. Stated as a test so a
    // retuned weight cannot silently break the precedence.
    const maxTags = MAX_SCORED_SHARED_TAGS * AFFINITY_SHARED_TAG;
    expect(AFFINITY_SAME_LEAF_CATEGORY).toBeGreaterThan(AFFINITY_SAME_CATEGORY_FAMILY + AFFINITY_SAME_BRAND + maxTags);
    expect(AFFINITY_SAME_CATEGORY_FAMILY).toBeGreaterThan(AFFINITY_SAME_BRAND + maxTags);
    expect(AFFINITY_SAME_BRAND).toBeGreaterThan(maxTags);
  });
});

describe("normaliseTags", () => {
  it("folds case and whitespace and drops empties", () => {
    expect(Array.from(normaliseTags(["Steel", " steel", "STEEL ", "", "  ", "M10"]))).toEqual(["steel", "m10"]);
  });

  it("tolerates a missing list", () => {
    expect(normaliseTags(undefined).size).toBe(0);
    expect(normaliseTags(null).size).toBe(0);
  });
});

describe("affinityScore", () => {
  it("scores nothing for the product itself", () => {
    expect(affinityScore(anchor(), anchor())).toBe(0);
  });

  it("scores nothing when nothing scored is shared", () => {
    expect(affinityScore(anchor(), candidate("x"))).toBe(0);
  });

  it("does not let tags alone relate two products", () => {
    // In this catalogue tags are provenance markers most products share; a
    // tag-only match would make everything related to everything and the rail
    // could never be honestly empty. Tags count only on top of a category or
    // brand match — the same product with a shared brand scores brand + tags.
    const allTags = ["steel", "m10", "zinc"];
    expect(affinityScore(anchor(), candidate("x", { tags: allTags }))).toBe(0);
    expect(affinityScore(anchor(), candidate("x", { ...sameBrand, tags: allTags }))).toBe(
      AFFINITY_SAME_BRAND + MAX_SCORED_SHARED_TAGS * AFFINITY_SHARED_TAG,
    );
  });

  it("ranks the same leaf category above family, brand and tags together", () => {
    const leafOnly = affinityScore(anchor(), candidate("x", { ...sameLeaf }));
    const everythingElse = affinityScore(anchor(), candidate("y", { ...sibling, ...sameBrand, tags: ["steel", "m10", "zinc"] }));
    expect(leafOnly).toBe(AFFINITY_SAME_LEAF_CATEGORY);
    expect(leafOnly).toBeGreaterThan(everythingElse);
  });

  it("never scores leaf and family for the same product", () => {
    // A leaf match is not also a family match; the two are exclusive tiers.
    expect(affinityScore(anchor(), candidate("x", { ...sameLeaf }))).toBe(AFFINITY_SAME_LEAF_CATEGORY);
  });

  it("recognises all three one-level relations as family", () => {
    const parent = anchor().categoryParentId as string;
    // Sibling: same parent.
    expect(affinityScore(anchor(), candidate("s", { ...sibling }))).toBe(AFFINITY_SAME_CATEGORY_FAMILY);
    // The anchor's parent category itself.
    expect(affinityScore(anchor(), candidate("p", { categoryId: parent, categoryParentId: "grandparent" }))).toBe(
      AFFINITY_SAME_CATEGORY_FAMILY,
    );
    // A child of the anchor's category.
    expect(affinityScore(anchor(), candidate("c", { categoryId: "cat-leaf-child", categoryParentId: "cat-leaf" }))).toBe(
      AFFINITY_SAME_CATEGORY_FAMILY,
    );
  });

  it("does not treat two root categories as siblings", () => {
    // Both parentIds null is not "the same parent": it is no parent at all.
    const root = anchor({ categoryId: "root-a", categoryParentId: null, brandId: null, tags: [] });
    expect(affinityScore(root, candidate("x", { categoryId: "root-b", categoryParentId: null }))).toBe(0);
  });

  it("never matches a missing brand against a missing brand", () => {
    const unbranded = anchor({ brandId: null, categoryId: "a", categoryParentId: null, tags: [] });
    expect(affinityScore(unbranded, candidate("x", { brandId: null, categoryId: "b", categoryParentId: null }))).toBe(0);
  });

  it("caps shared tags and counts each tag once", () => {
    const withBrand = candidate("x", { ...sameBrand, tags: ["Steel", "STEEL", "steel ", "m10", "zinc", "zinc"] });
    expect(affinityScore(anchor(), withBrand)).toBe(AFFINITY_SAME_BRAND + MAX_SCORED_SHARED_TAGS * AFFINITY_SHARED_TAG);
    const manyTags = anchor({ tags: ["a", "b", "c", "d", "e", "f"] });
    const stuffed = candidate("y", { ...sameBrand, tags: ["a", "b", "c", "d", "e", "f"] });
    expect(affinityScore(manyTags, stuffed)).toBe(AFFINITY_SAME_BRAND + MAX_SCORED_SHARED_TAGS * AFFINITY_SHARED_TAG);
  });
});

describe("rankRelated", () => {
  it("puts the same category ahead of the same brand", () => {
    const ranked = rankRelated(
      anchor(),
      [candidate("brand-mate", { ...sameBrand }), candidate("category-mate", { ...sameLeaf })],
      8,
    );
    expect(ranked).toEqual(["category-mate", "brand-mate"]);
  });

  it("puts a family match ahead of a brand match", () => {
    expect(rankRelated(anchor(), [candidate("b", { ...sameBrand }), candidate("f", { ...sibling })], 8)).toEqual(["f", "b"]);
  });

  it("excludes the product itself even when it is a perfect match", () => {
    const self = candidate("anchor", { ...sameLeaf, ...sameBrand, tags: anchor().tags });
    expect(rankRelated(anchor(), [self, candidate("other", { ...sameLeaf })], 8)).toEqual(["other"]);
  });

  it("returns nothing when nothing is related, never padding with strangers", () => {
    const strangers = [candidate("x"), candidate("y", { tags: ["steel"] }), candidate("z", { brandId: "brand-z" })];
    // "y" shares a tag and nothing structural: still a stranger, still dropped.
    expect(rankRelated(anchor(), strangers, 8)).toEqual([]);
    expect(rankRelated(anchor(), [], 8)).toEqual([]);
  });

  it("breaks ties by rating, then review count, then recency, then id", () => {
    const equals = [
      candidate("unrated-old", { ...sameLeaf, createdAt: new Date(T0.getTime() - DAY) }),
      candidate("unrated-new", { ...sameLeaf, createdAt: new Date(T0.getTime() + DAY) }),
      candidate("rated-4.5", { ...sameLeaf, rating: { average: 4.5, count: 3 } }),
      candidate("rated-4.8-few", { ...sameLeaf, rating: { average: 4.8, count: 2 } }),
      candidate("rated-4.8-many", { ...sameLeaf, rating: { average: 4.8, count: 40 } }),
      candidate("unrated-b", { ...sameLeaf }),
      candidate("unrated-a", { ...sameLeaf }),
    ];
    expect(rankRelated(anchor(), equals, 10)).toEqual([
      "rated-4.8-many",
      "rated-4.8-few",
      "rated-4.5",
      "unrated-new",
      "unrated-a",
      "unrated-b",
      "unrated-old",
    ]);
  });

  it("is deterministic regardless of input order", () => {
    const rows = [
      candidate("a", { ...sameLeaf }),
      candidate("b", { ...sameLeaf, ...sameBrand }),
      candidate("c", { ...sibling }),
      candidate("d", { ...sameBrand }),
      candidate("e", { ...sameLeaf, rating: { average: 4, count: 1 } }),
    ];
    const forward = rankRelated(anchor(), rows, 8);
    const backward = rankRelated(anchor(), [...rows].reverse(), 8);
    expect(backward).toEqual(forward);
    expect(forward).toEqual(["b", "e", "a", "c", "d"]);
  });

  it("collapses duplicate candidates and honours the limit", () => {
    const rows = [candidate("a", { ...sameLeaf }), candidate("a", { ...sameLeaf }), candidate("b", { ...sameLeaf })];
    expect(rankRelated(anchor(), rows, 8)).toEqual(["a", "b"]);
    expect(rankRelated(anchor(), rows, 1)).toEqual(["a"]);
    expect(rankRelated(anchor(), rows, 0)).toEqual([]);
  });
});

describe("coPurchaseSupport", () => {
  it("counts distinct buyers, not lines or orders", () => {
    // One buyer reordering the same pair every month is one buyer's habit; two
    // variants of one product on one order are one purchase.
    const lines = [line("p", "buyer-1"), line("p", "buyer-1"), line("p", "buyer-1"), line("p", "buyer-2")];
    expect(coPurchaseSupport(lines, ["anchor"]).get("p")).toBe(2);
  });

  it("never counts an anchor as its own evidence", () => {
    const lines = [line("anchor", "buyer-1"), line("anchor", "buyer-2"), line("p", "buyer-1")];
    const support = coPurchaseSupport(lines, ["anchor"]);
    expect(support.has("anchor")).toBe(false);
    expect(support.get("p")).toBe(1);
  });

  it("ignores lines it cannot attribute to a buyer", () => {
    expect(coPurchaseSupport([line("p", "")], ["anchor"]).has("p")).toBe(false);
  });
});

describe("rankCoPurchases — honest degradation", () => {
  const opts = { anchorIds: ["anchor"], minSupport: MIN_CO_PURCHASE_SUPPORT, minProducts: MIN_BOUGHT_TOGETHER_PRODUCTS, limit: 8 };

  it("returns nothing at all when nobody bought anything with it", () => {
    expect(rankCoPurchases([], opts)).toEqual([]);
  });

  it("returns nothing for one buyer's one basket", () => {
    // The headline refusal. A single basket is an anecdote; repeating it to
    // the next visitor as "others also bought" is the lie this rail must not
    // tell. There is no fallback to related products in this function.
    expect(rankCoPurchases([line("p", "buyer-1"), line("q", "buyer-1")], opts)).toEqual([]);
  });

  it("requires the support threshold to be at least two buyers", () => {
    expect(MIN_CO_PURCHASE_SUPPORT).toBeGreaterThanOrEqual(2);
  });

  it("returns nothing when only one product clears the bar", () => {
    const lines = [line("p", "buyer-1"), line("p", "buyer-2"), line("q", "buyer-1")];
    expect(rankCoPurchases(lines, opts)).toEqual([]);
    // ...and everything the moment the quorum is met.
    expect(rankCoPurchases([...lines, line("q", "buyer-3")], opts)).toEqual(["p", "q"]);
  });

  it("measures the quorum on the evidence, not on the display", () => {
    const lines = [line("p", "b1"), line("p", "b2"), line("q", "b1"), line("q", "b2")];
    // Asking for one tile does not lower the bar to one product.
    expect(rankCoPurchases(lines, { ...opts, limit: 1 })).toEqual(["p"]);
    expect(rankCoPurchases(lines.slice(0, 2), { ...opts, limit: 1 })).toEqual([]);
  });

  it("orders by support and then by id, deterministically", () => {
    const lines = [
      line("weak", "b1"), line("weak", "b2"),
      line("strong", "b1"), line("strong", "b2"), line("strong", "b3"),
      line("also-weak", "b1"), line("also-weak", "b2"),
    ];
    expect(rankCoPurchases(lines, opts)).toEqual(["strong", "also-weak", "weak"]);
    expect(rankCoPurchases([...lines].reverse(), opts)).toEqual(["strong", "also-weak", "weak"]);
  });

  it("never lowers a caller-supplied threshold below one", () => {
    const lines = [line("p", "b1"), line("q", "b1")];
    expect(rankCoPurchases(lines, { ...opts, minSupport: 0, minProducts: -3 })).toEqual(["p", "q"]);
  });
});

describe("rankCartCompletions", () => {
  const basket = [
    anchor({ id: "item-1", categoryId: "bolts", categoryParentId: "fasteners", brandId: "brand-a", tags: [] }),
    anchor({ id: "item-2", categoryId: "nuts", categoryParentId: "fasteners", brandId: "brand-a", tags: [] }),
    anchor({ id: "item-3", categoryId: "gloves", categoryParentId: "ppe", brandId: "brand-g", tags: [] }),
  ];
  const noSupport = new Map<string, number>();
  const opts = { minSupport: MIN_CO_PURCHASE_SUPPORT, limit: 8 };

  it("never suggests something already in the basket", () => {
    const rows = [candidate("item-1", { categoryId: "bolts", categoryParentId: "fasteners" }), candidate("washers", { categoryId: "washers", categoryParentId: "fasteners" })];
    expect(rankCartCompletions(basket, rows, noSupport, opts)).toEqual(["washers"]);
  });

  it("ranks a product related to many basket items above one related to one", () => {
    // Three items from three unrelated families, two of them one brand. The
    // brand-mate relates (weakly) to two of the things being bought; a second
    // bolt is the strongest single relation there is, but to one item only.
    // Breadth wins: it goes with more of the basket.
    const spread = [
      anchor({ id: "bolt", categoryId: "bolts", categoryParentId: "fasteners", brandId: "brand-a", tags: [] }),
      anchor({ id: "glove", categoryId: "gloves", categoryParentId: "ppe", brandId: "brand-a", tags: [] }),
      anchor({ id: "drill", categoryId: "drills", categoryParentId: "power-tools", brandId: "brand-g", tags: [] }),
    ];
    const rows = [
      candidate("another-bolt", { categoryId: "bolts", categoryParentId: "fasteners" }),
      candidate("brand-mate", { categoryId: "tape", categoryParentId: "consumables", brandId: "brand-a" }),
    ];
    expect(rankCartCompletions(spread, rows, noSupport, opts)).toEqual(["brand-mate", "another-bolt"]);
  });

  it("counts breadth over distinct basket items, so a duplicated line is one item", () => {
    const duplicated = [basket[0], basket[0], basket[0]];
    const rows = [
      candidate("another-bolt", { categoryId: "bolts", categoryParentId: "fasteners" }),
      candidate("brand-mate", { categoryId: "drills", categoryParentId: "power-tools", brandId: "brand-a" }),
    ];
    // Both relate to one distinct item; the stronger relation wins the tie.
    expect(rankCartCompletions(duplicated, rows, noSupport, opts)).toEqual(["another-bolt", "brand-mate"]);
  });

  it("puts co-purchase evidence above any catalogue affinity", () => {
    const rows = [
      candidate("washers", { categoryId: "washers", categoryParentId: "fasteners" }),
      candidate("thread-locker", { categoryId: "adhesives", categoryParentId: "chemicals" }),
    ];
    const support = new Map([["thread-locker", MIN_CO_PURCHASE_SUPPORT]]);
    // Thread-locker shares nothing with the basket by taxonomy, but other
    // buyers put it in the same basket: what buyers did beats what is implied.
    expect(rankCartCompletions(basket, rows, support, opts)).toEqual(["thread-locker", "washers"]);
  });

  it("treats support below the threshold as no evidence at all", () => {
    const rows = [
      candidate("washers", { categoryId: "washers", categoryParentId: "fasteners" }),
      candidate("thread-locker", { categoryId: "adhesives", categoryParentId: "chemicals" }),
    ];
    const support = new Map([["thread-locker", MIN_CO_PURCHASE_SUPPORT - 1]]);
    // One buyer's basket neither ranks the product nor keeps it in the rail.
    expect(rankCartCompletions(basket, rows, support, opts)).toEqual(["washers"]);
  });

  it("ignores support for a product with no candidate row", () => {
    // The row is how a product proves it is still visible; support without one
    // is a purchase pattern for something the caller may not show.
    const support = new Map([["ghost", 10]]);
    expect(rankCartCompletions(basket, [], support, opts)).toEqual([]);
  });

  it("returns nothing for a basket that relates to nothing", () => {
    expect(rankCartCompletions(basket, [candidate("stranger")], noSupport, opts)).toEqual([]);
    expect(rankCartCompletions([], [candidate("stranger")], noSupport, opts)).toEqual([]);
  });

  it("orders equal breadth by total affinity, then standing, deterministically", () => {
    const rows = [
      candidate("sibling-of-bolts", { categoryId: "screws", categoryParentId: "fasteners" }), // family to bolts + nuts: 16
      candidate("same-brand-both", { categoryId: "drills", categoryParentId: "power-tools", brandId: "brand-a" }), // brand to item-1 + item-2: 8
      candidate("rated-sibling", { categoryId: "rivets", categoryParentId: "fasteners", rating: { average: 5, count: 1 } }), // 16, rated
    ];
    const forward = rankCartCompletions(basket, rows, noSupport, opts);
    const backward = rankCartCompletions(basket, [...rows].reverse(), noSupport, opts);
    expect(forward).toEqual(["rated-sibling", "sibling-of-bolts", "same-brand-both"]);
    expect(backward).toEqual(forward);
  });

  it("honours the limit after ranking", () => {
    // "a" is leaf to the bolts and sibling to the nuts (breadth 2, affinity
    // 24); "b" is sibling to both (breadth 2, affinity 16). The cut to one
    // tile keeps the ranked first, not the first supplied.
    const rows = [
      candidate("b", { categoryId: "washers", categoryParentId: "fasteners" }),
      candidate("a", { categoryId: "bolts", categoryParentId: "fasteners" }),
    ];
    expect(rankCartCompletions(basket, rows, noSupport, opts)).toEqual(["a", "b"]);
    expect(rankCartCompletions(basket, rows, noSupport, { ...opts, limit: 1 })).toEqual(["a"]);
  });
});

describe("normaliseBasket", () => {
  it("trims, validates, de-duplicates and keeps the caller's order", () => {
    expect(normaliseBasket([" b ", "a", "b", "", "not valid!", "a"])).toEqual(["b", "a"]);
  });

  it("caps the basket at MAX_BASKET_ANCHORS distinct products", () => {
    const many = Array.from({ length: MAX_BASKET_ANCHORS + 10 }, (_, i) => `p${i}`);
    expect(normaliseBasket(many)).toHaveLength(MAX_BASKET_ANCHORS);
    expect(normaliseBasket(many)[0]).toBe("p0");
  });

  it("tolerates a missing list", () => {
    expect(normaliseBasket(undefined)).toEqual([]);
    expect(normaliseBasket(null)).toEqual([]);
  });
});

describe("affinityTierWheres — the candidate predicates", () => {
  const visible = publicProductWhere(undefined);

  it("composes every tier with the catalogue's own visibility predicate, unrestated", () => {
    const tiers = affinityTierWheres([anchor()], visible);
    for (const tier of [tiers.leaf, tiers.family, tiers.brand]) {
      expect(tier).not.toBeNull();
      expect((tier as { AND: unknown[] }).AND[0]).toBe(visible);
    }
  });

  it("never filters on the B2C flag unless a channel was stated", () => {
    // The bug that shipped twice: nothing in this catalogue sets isB2CEnabled,
    // so defaulting the channel to B2C returns zero rows and the empty rail
    // reads as "nothing is related".
    const both = affinityTierWheres([anchor()], publicProductWhere(undefined));
    expect(JSON.stringify(both)).not.toContain("isB2CEnabled");
    const b2c = affinityTierWheres([anchor()], publicProductWhere(true));
    expect(JSON.stringify(b2c)).toContain('"isB2CEnabled":true');
    const b2b = affinityTierWheres([anchor()], publicProductWhere(false));
    expect(JSON.stringify(b2b)).toContain('"isB2CEnabled":false');
  });

  it("excludes the anchors from every tier", () => {
    const tiers = affinityTierWheres([anchor({ id: "a1" }), anchor({ id: "a2" })], visible);
    for (const tier of [tiers.leaf, tiers.family, tiers.brand]) {
      const own = (tier as { AND: Array<Record<string, unknown>> }).AND[1];
      expect(own.id).toEqual({ notIn: ["a1", "a2"] });
    }
  });

  it("keeps the leaf categories out of the family and brand tiers", () => {
    const tiers = affinityTierWheres([anchor()], visible);
    const family = (tiers.family as { AND: Array<Record<string, unknown>> }).AND[1];
    const brand = (tiers.brand as { AND: Array<Record<string, unknown>> }).AND[1];
    expect(family.categoryId).toEqual({ notIn: ["cat-leaf"] });
    expect(brand.categoryId).toEqual({ notIn: ["cat-leaf"] });
    expect(family.OR).toEqual([{ category: { parentId: { in: ["cat-leaf", "cat-parent"] } } }, { categoryId: { in: ["cat-parent"] } }]);
  });

  it("has no brand tier when no anchor carries a brand, and no parent clause at the root", () => {
    const tiers = affinityTierWheres([anchor({ brandId: null, categoryParentId: null })], visible);
    expect(tiers.brand).toBeNull();
    const family = (tiers.family as { AND: Array<Record<string, unknown>> }).AND[1];
    expect(family.OR).toEqual([{ category: { parentId: { in: ["cat-leaf"] } } }]);
  });

  it("has no tag tier at all", () => {
    expect(JSON.stringify(affinityTierWheres([anchor()], visible))).not.toContain("tags");
  });
});

describe("coPurchaseLineWhere — what counts as bought together", () => {
  const visible = publicProductWhere(undefined);
  const where = coPurchaseLineWhere(["anchor"], visible);

  it("requires a sale by the storefront's definition, on the line and on the order", () => {
    expect(where.status).toEqual({ in: SALE_COUNTING_ORDER_STATUSES });
    const order = where.order as Record<string, unknown>;
    expect(order.status).toEqual({ in: SALE_COUNTING_ORDER_STATUSES });
    expect(SALE_COUNTING_ORDER_STATUSES).not.toContain("PENDING_PAYMENT");
  });

  it("voids a refunded or failed payment whatever the order status says", () => {
    const order = where.order as { paymentStatus: { notIn: string[] } };
    expect(order.paymentStatus.notIn).toEqual(expect.arrayContaining(["REFUNDED", "FAILED"]));
    expect(order.paymentStatus.notIn).not.toContain("PAID");
  });

  it("requires the order to contain an anchor, as a sale-counting line", () => {
    const order = where.order as { items: { some: Record<string, unknown> } };
    expect(order.items.some.productId).toEqual({ in: ["anchor"] });
    expect(order.items.some.status).toEqual({ in: SALE_COUNTING_ORDER_STATUSES });
  });

  it("excludes the anchors and requires the co-purchased product to be visible now", () => {
    expect(where.productId).toEqual({ notIn: ["anchor"] });
    expect(where.product).toBe(visible);
    expect(JSON.stringify(where)).not.toContain("isB2CEnabled");
  });
});
