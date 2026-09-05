import { describe, expect, it } from "vitest";
import {
  buildDiscoveryPlan,
  emptyHistory,
  hasSomethingToSay,
  HALF_LIFE_MS,
  localeName,
  MIN_HITS_TO_CLAIM,
  pruneHistory,
  rankBrands,
  rankCategories,
  recencyWeight,
  recordCategoryVisit,
  recordSearch,
  recordView,
  SEARCH_LIMIT,
  SIGNAL_TTL_MS,
  TRENDING_SHOWN,
  VIEW_LIMIT,
  VISIT_DEBOUNCE_MS,
  type DiscoveryHistory,
  type NamePair,
  type TrendingProduct,
  type ViewedProduct,
} from "../interest-signals";

/**
 * The recommender's whole contract, tested where it lives: in a pure function
 * with an injected clock.
 *
 * The cases that matter here are not the happy ones. They are the ones where a
 * recommender is tempted to make something up — no history, one data point, a
 * dead heat, a signal that has gone stale, a category it holds a slug for but
 * cannot name. Every one of those must produce SILENCE or a plainly stated
 * shortfall, never a block.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

const name = (en: string, ar: string | null = null): NamePair => ({ en, ar });

function view(overrides: Partial<ViewedProduct> & { id: string }): ViewedProduct {
  return {
    slug: `${overrides.id}-slug`,
    name: name(`Product ${overrides.id}`),
    imageUrl: null,
    sku: null,
    brand: null,
    category: null,
    at: NOW,
    ...overrides,
  };
}

function history(parts: Partial<DiscoveryHistory>): DiscoveryHistory {
  return { ...emptyHistory(), ...parts };
}

const trendingRow = (id: string): TrendingProduct => ({
  id,
  slug: `${id}-slug`,
  nameEn: `Trending ${id}`,
  nameAr: null,
});

const plan = (input: Parameters<typeof buildDiscoveryPlan>[0]) => buildDiscoveryPlan(input);

describe("recencyWeight", () => {
  it("halves every half-life and never exceeds 1", () => {
    expect(recencyWeight(NOW, NOW)).toBe(1);
    expect(recencyWeight(NOW - HALF_LIFE_MS, NOW)).toBeCloseTo(0.5, 10);
    expect(recencyWeight(NOW - 2 * HALF_LIFE_MS, NOW)).toBeCloseTo(0.25, 10);
    // A clock that has moved backwards must not mint extra confidence.
    expect(recencyWeight(NOW + DAY, NOW)).toBe(1);
  });
});

describe("recording", () => {
  it("keeps one entry per product and moves a re-opened product to the front", () => {
    let trail = emptyHistory();
    trail = recordView(trail, view({ id: "a" }), NOW);
    trail = recordView(trail, view({ id: "b" }), NOW + 1000);
    trail = recordView(trail, view({ id: "a" }), NOW + 2000);
    expect(trail.views.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(trail.views[0]!.at).toBe(NOW + 2000);
  });

  it("caps the trail so it stays a trail and not a dossier", () => {
    let trail = emptyHistory();
    for (let index = 0; index < VIEW_LIMIT + 8; index += 1) {
      trail = recordView(trail, view({ id: `p${index}` }), NOW + index);
    }
    expect(trail.views).toHaveLength(VIEW_LIMIT);
    expect(trail.views[0]!.id).toBe(`p${VIEW_LIMIT + 7}`);
  });

  it("treats a repeat category hit inside the debounce window as the same visit", () => {
    let trail = recordCategoryVisit(emptyHistory(), "wiring-devices", NOW);
    // Paging, filtering and the back button all re-enter the same URL.
    trail = recordCategoryVisit(trail, "wiring-devices", NOW + VISIT_DEBOUNCE_MS - 1);
    expect(trail.categoryVisits).toHaveLength(1);
    trail = recordCategoryVisit(trail, "wiring-devices", NOW + VISIT_DEBOUNCE_MS + 1);
    expect(trail.categoryVisits).toHaveLength(2);
  });

  it("ignores blank category and search values", () => {
    expect(recordCategoryVisit(emptyHistory(), "   ", NOW).categoryVisits).toHaveLength(0);
    expect(recordSearch(emptyHistory(), "  ", NOW).searches).toHaveLength(0);
  });

  it("keeps one entry per search term, newest first, capped", () => {
    let trail = recordSearch(emptyHistory(), "busbar", NOW);
    trail = recordSearch(trail, "BUSBAR", NOW + 1000);
    expect(trail.searches).toHaveLength(1);
    expect(trail.searches[0]!.term).toBe("BUSBAR");
    for (let index = 0; index < SEARCH_LIMIT + 3; index += 1) {
      trail = recordSearch(trail, `term-${index}`, NOW + 2000 + index);
    }
    expect(trail.searches).toHaveLength(SEARCH_LIMIT);
  });
});

describe("staleness", () => {
  it("drops signals past the retention window on prune, ranking and planning", () => {
    const stale = NOW - SIGNAL_TTL_MS - 1;
    const trail = history({
      views: [view({ id: "old", at: stale, brand: name("Schneider") })],
      categoryVisits: [
        { slug: "wiring-devices", at: stale },
        { slug: "wiring-devices", at: stale - 1000 },
      ],
      searches: [{ term: "busbar", at: stale }],
    });

    expect(pruneHistory(trail, NOW)).toEqual(emptyHistory());
    expect(rankCategories(trail, NOW)).toEqual([]);
    expect(rankBrands(trail, NOW)).toEqual([]);

    const result = plan({
      history: trail,
      trending: [],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices") },
    });
    expect(result.blocks).toEqual([]);
    // Nothing survived, so there is no shortfall to report — there is nothing.
    expect(result.needsMoreSignal).toBe(false);
    expect(hasSomethingToSay(result)).toBe(false);
  });
});

describe("ranking", () => {
  it("lets today's interest outrank a bigger pile from last week", () => {
    const trail = history({
      categoryVisits: [
        { slug: "fresh", at: NOW - 60 * 1000 },
        { slug: "fresh", at: NOW - 2 * 60 * 60 * 1000 },
        { slug: "stale-but-many", at: NOW - 10 * DAY },
        { slug: "stale-but-many", at: NOW - 10 * DAY - 1000 },
        { slug: "stale-but-many", at: NOW - 11 * DAY },
        { slug: "stale-but-many", at: NOW - 12 * DAY },
      ],
    });
    const ranked = rankCategories(trail, NOW);
    expect(ranked[0]!.slug).toBe("fresh");
    expect(ranked[0]!.browseCount).toBe(2);
    // The larger pile is still counted — it is simply worth less.
    expect(ranked[1]!.slug).toBe("stale-but-many");
    expect(ranked[1]!.browseCount).toBe(4);
  });

  it("breaks a dead heat deterministically rather than by map order", () => {
    const trail = history({
      categoryVisits: [
        { slug: "zeta", at: NOW },
        { slug: "alpha", at: NOW },
      ],
    });
    const first = rankCategories(trail, NOW).map((entry) => entry.slug);
    const reversed = rankCategories(
      history({ categoryVisits: [...trail.categoryVisits].reverse() }),
      NOW,
    ).map((entry) => entry.slug);
    expect(first).toEqual(["alpha", "zeta"]);
    // Same signals in a different order must not reorder the panel.
    expect(reversed).toEqual(first);
  });

  it("scores an overwhelming single category far above an incidental one", () => {
    const trail = history({
      categoryVisits: [
        ...Array.from({ length: 6 }, (_, index) => ({ slug: "wiring-devices", at: NOW - index * 60 * 1000 })),
        { slug: "hand-tools", at: NOW - 30 * 1000 },
      ],
    });
    const [top, second] = rankCategories(trail, NOW);
    expect(top!.slug).toBe("wiring-devices");
    expect(top!.browseCount).toBe(6);
    expect(top!.score).toBeGreaterThan(second!.score * 4);
  });

  it("counts brands only from products actually opened, keeping the newest spelling", () => {
    const trail = history({
      views: [
        view({ id: "b", at: NOW, brand: name("Schneider", "شنايدر") }),
        view({ id: "a", at: NOW - DAY, brand: name("schneider") }),
        view({ id: "c", at: NOW - DAY, brand: null }),
      ],
    });
    const ranked = rankBrands(trail, NOW);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.viewCount).toBe(2);
    expect(ranked[0]!.name).toEqual(name("Schneider", "شنايدر"));
    expect(localeName(ranked[0]!.name, "ar")).toBe("شنايدر");
  });
});

describe("the plan refuses to invent", () => {
  it("says nothing at all with no history and no trending rows", () => {
    const result = plan({ history: emptyHistory(), trending: [], now: NOW });
    expect(result.blocks).toEqual([]);
    expect(result.needsMoreSignal).toBe(false);
    expect(result.basis).toEqual({ views: 0, categoryVisits: 0, searches: 0 });
    expect(hasSomethingToSay(result)).toBe(false);
  });

  it("shows trending alone when the visitor is new but the catalogue has signal", () => {
    const result = plan({ history: emptyHistory(), trending: [trendingRow("t1")], now: NOW });
    expect(result.blocks.map((block) => block.kind)).toEqual(["trending"]);
    expect(result.blocks[0]).toMatchObject({ reason: { kind: "catalogueActivity" } });
    // No trail means no shortfall to confess: there is simply nothing personal.
    expect(result.needsMoreSignal).toBe(false);
  });

  it("shows the trail but claims no interest from a single view", () => {
    const trail = recordView(emptyHistory(), view({ id: "a", brand: name("Schneider") }), NOW);
    const result = plan({
      history: trail,
      trending: [],
      now: NOW,
      brandSlugs: { schneider: "schneider" },
      categoryNames: {},
    });
    expect(result.blocks.map((block) => block.kind)).toEqual(["recentlyViewed"]);
    // One product is not a pattern, and the panel says so instead of guessing.
    expect(result.needsMoreSignal).toBe(true);
    expect(MIN_HITS_TO_CLAIM).toBeGreaterThan(1);
  });

  it("will not name a category it has no display name for", () => {
    const trail = history({
      categoryVisits: [
        { slug: "wiring-devices", at: NOW },
        { slug: "wiring-devices", at: NOW - VISIT_DEBOUNCE_MS - 1 },
      ],
    });
    const unnamed = plan({ history: trail, trending: [], now: NOW });
    expect(unnamed.blocks).toEqual([]);
    expect(unnamed.needsMoreSignal).toBe(true);

    const named = plan({
      history: trail,
      trending: [],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices", "أجهزة التوصيل") },
    });
    expect(named.blocks.map((block) => block.kind)).toEqual(["categoryJump"]);
    expect(named.needsMoreSignal).toBe(false);
  });

  it("will not offer a brand link it cannot resolve to a catalogue filter", () => {
    const trail = history({
      views: [
        view({ id: "a", at: NOW, brand: name("Schneider") }),
        view({ id: "b", at: NOW - 1000, brand: name("Schneider") }),
      ],
    });
    const unresolved = plan({ history: trail, trending: [], now: NOW });
    expect(unresolved.blocks.map((block) => block.kind)).toEqual(["recentlyViewed"]);

    const resolved = plan({ history: trail, trending: [], now: NOW, brandSlugs: { schneider: "schneider-electric" } });
    const brandBlock = resolved.blocks.find((block) => block.kind === "brandJump");
    expect(brandBlock).toMatchObject({
      kind: "brandJump",
      href: "/products?brand=schneider-electric",
      reason: { kind: "brandViewed", count: 2 },
    });
  });
});

describe("the plan states its basis", () => {
  it("reports a browse-only category with browse wording", () => {
    const trail = history({
      categoryVisits: [
        { slug: "wiring-devices", at: NOW },
        { slug: "wiring-devices", at: NOW - VISIT_DEBOUNCE_MS - 1 },
        { slug: "wiring-devices", at: NOW - 2 * VISIT_DEBOUNCE_MS },
      ],
    });
    const result = plan({
      history: trail,
      trending: [],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices") },
    });
    const block = result.blocks.find((entry) => entry.kind === "categoryJump");
    expect(block).toMatchObject({
      href: "/products?category=wiring-devices",
      inStockHref: "/products?category=wiring-devices&inStock=1",
      reason: { kind: "categoryBrowsed", count: 3, category: name("Wiring Devices") },
    });
  });

  it("reports a view-only category with view wording", () => {
    const category = { slug: "wiring-devices", name: name("Wiring Devices") };
    const trail = history({
      views: [view({ id: "a", at: NOW, category }), view({ id: "b", at: NOW - 1000, category })],
    });
    const result = plan({
      history: trail,
      trending: [],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices") },
    });
    expect(result.blocks.find((entry) => entry.kind === "categoryJump")).toMatchObject({
      reason: { kind: "categoryViewed", count: 2 },
    });
  });

  it("reports a mixed basis as a mixed basis", () => {
    const category = { slug: "wiring-devices", name: name("Wiring Devices") };
    const trail = history({
      views: [view({ id: "a", at: NOW, category })],
      categoryVisits: [{ slug: "wiring-devices", at: NOW - 1000 }],
    });
    const result = plan({
      history: trail,
      trending: [],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices") },
    });
    expect(result.blocks.find((entry) => entry.kind === "categoryJump")).toMatchObject({
      reason: { kind: "categoryBoth", browseCount: 1, viewCount: 1 },
    });
  });

  it("hands a search back to the visitor as their own words, url-encoded", () => {
    const trail = recordSearch(emptyHistory(), "busbar 400 A & lugs", NOW);
    const result = plan({ history: trail, trending: [], now: NOW });
    expect(result.blocks.find((entry) => entry.kind === "resumeSearch")).toMatchObject({
      term: "busbar 400 A & lugs",
      href: "/search?q=busbar%20400%20A%20%26%20lugs",
      reason: { kind: "lastSearch", term: "busbar 400 A & lugs" },
    });
  });

  it("escapes a category slug into its links", () => {
    const trail = history({
      categoryVisits: [
        { slug: "a b&c", at: NOW },
        { slug: "a b&c", at: NOW - VISIT_DEBOUNCE_MS - 1 },
      ],
    });
    const result = plan({ history: trail, trending: [], now: NOW, categoryNames: { "a b&c": name("A B&C") } });
    expect(result.blocks.find((entry) => entry.kind === "categoryJump")).toMatchObject({
      href: "/products?category=a%20b%26c",
      inStockHref: "/products?category=a%20b%26c&inStock=1",
    });
  });
});

describe("block composition", () => {
  it("orders the blocks trail-first and caps each list", () => {
    let trail = emptyHistory();
    for (let index = 0; index < 8; index += 1) {
      trail = recordView(
        trail,
        view({ id: `p${index}`, at: NOW - index * 1000, brand: name("Schneider") }),
        NOW - index * 1000,
      );
    }
    // Chronological, as the recorder writes them: the debounce compares against
    // the most recent visit already stored.
    trail = recordCategoryVisit(trail, "wiring-devices", NOW - VISIT_DEBOUNCE_MS - 1);
    trail = recordCategoryVisit(trail, "wiring-devices", NOW);
    trail = recordSearch(trail, "busbar", NOW);

    const result = plan({
      history: trail,
      trending: [trendingRow("t1"), trendingRow("t2"), trendingRow("t3"), trendingRow("t4")],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices") },
      brandSlugs: { schneider: "schneider" },
    });

    expect(result.blocks.map((block) => block.kind)).toEqual([
      "recentlyViewed",
      "categoryJump",
      "brandJump",
      "resumeSearch",
      "trending",
    ]);
    const recent = result.blocks[0];
    expect(recent.kind === "recentlyViewed" && recent.products.length).toBe(4);
    const trending = result.blocks[4];
    expect(trending.kind === "trending" && trending.products.length).toBe(TRENDING_SHOWN);
    expect(result.needsMoreSignal).toBe(false);
    expect(result.basis.views).toBe(8);
  });

  it("gives every block a reason", () => {
    let trail = emptyHistory();
    trail = recordView(trail, view({ id: "a", brand: name("Schneider") }), NOW);
    trail = recordView(trail, view({ id: "b", brand: name("Schneider") }), NOW - 1000);
    trail = recordCategoryVisit(trail, "wiring-devices", NOW - VISIT_DEBOUNCE_MS - 1);
    trail = recordCategoryVisit(trail, "wiring-devices", NOW);
    trail = recordSearch(trail, "busbar", NOW);
    const result = plan({
      history: trail,
      trending: [trendingRow("t1")],
      now: NOW,
      categoryNames: { "wiring-devices": name("Wiring Devices") },
      brandSlugs: { schneider: "schneider" },
    });
    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      expect(block.reason, `${block.kind} has no stated reason`).toBeTruthy();
      expect(typeof block.reason.kind).toBe("string");
    }
  });
});

describe("localeName", () => {
  it("falls back to English when the Arabic name is missing or blank", () => {
    expect(localeName(name("Wiring Devices", "أجهزة"), "ar")).toBe("أجهزة");
    expect(localeName(name("Wiring Devices", "  "), "ar")).toBe("Wiring Devices");
    expect(localeName(name("Wiring Devices", "أجهزة"), "en")).toBe("Wiring Devices");
  });
});
