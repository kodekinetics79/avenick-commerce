import { describe, expect, it } from "vitest";
import {
  MIN_TRENDING_PRODUCTS,
  MIN_VIEWS_FOR_TRENDING,
  TRENDING_HALF_LIFE_DAYS,
  TRENDING_WINDOW_DAYS,
  bucketAgeInDays,
  decayWeight,
  rankTrending,
  trendingWindowStart,
  utcDayStart,
  type ViewBucket,
} from "../services/product-signals";

/**
 * Pure unit tests: nothing here opens a connection. What is tested is every
 * decision that would let the storefront print a "Trending" rail that is not
 * true — a ranking one person's refreshes could set, a rail of one product
 * presented as a selection, a stale spike frozen at the top for a week, or an
 * order that reshuffles between two requests over the same data.
 */

const NOW = new Date("2026-09-05T11:30:00.000Z");

/** A bucket `age` whole UTC days before NOW. */
function daysAgo(age: number): Date {
  return new Date(utcDayStart(NOW).getTime() - age * 86_400_000);
}

function bucket(productId: string, age: number, views: number): ViewBucket {
  return { productId, bucketDate: daysAgo(age), views };
}

/** Defaults, so each test states only the knob it is actually about. */
function rankOpts(overrides: Partial<Parameters<typeof rankTrending>[1]> = {}) {
  return {
    now: NOW,
    windowDays: TRENDING_WINDOW_DAYS,
    halfLifeDays: TRENDING_HALF_LIFE_DAYS,
    minViews: MIN_VIEWS_FOR_TRENDING,
    minProducts: MIN_TRENDING_PRODUCTS,
    limit: 8,
    ...overrides,
  };
}

/** A field of `count` products, each with `views` today, to satisfy the quorum. */
function filler(count: number, views = MIN_VIEWS_FOR_TRENDING): ViewBucket[] {
  return Array.from({ length: count }, (_, i) => bucket(`filler-${i}`, 0, views));
}

describe("utcDayStart", () => {
  it("truncates to UTC midnight regardless of the time of day", () => {
    expect(utcDayStart(new Date("2026-09-05T23:59:59.999Z")).toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-09-05T00:00:00.000Z")).toISOString()).toBe("2026-09-05T00:00:00.000Z");
  });

  it("is UTC, not the machine's locale", () => {
    // The bucket boundary must not follow the server's time zone: two instances
    // in two regions would otherwise write two different buckets for the same
    // minute, and the unique constraint that makes the counter atomic would be
    // keyed on "wherever this process thinks it is".
    const day = utcDayStart(new Date("2026-09-05T11:30:00.000Z"));
    expect(day.getUTCHours()).toBe(0);
    expect(day.getUTCMinutes()).toBe(0);
    expect(day.getUTCSeconds()).toBe(0);
    expect(day.getUTCMilliseconds()).toBe(0);
  });

  it("is idempotent, so a day may be re-truncated safely", () => {
    const once = utcDayStart(NOW);
    expect(utcDayStart(once).getTime()).toBe(once.getTime());
  });
});

describe("trendingWindowStart", () => {
  it("counts today as the first day of the window", () => {
    // A 1-day window means TODAY, never "yesterday onward". An off-by-one here
    // silently doubles or halves the period the word "trending" refers to.
    expect(trendingWindowStart(NOW, 1).getTime()).toBe(utcDayStart(NOW).getTime());
  });

  it("spans exactly windowDays buckets", () => {
    const start = trendingWindowStart(NOW, TRENDING_WINDOW_DAYS);
    expect(bucketAgeInDays(start, NOW)).toBe(TRENDING_WINDOW_DAYS - 1);
  });

  it("never returns a window shorter than a day for nonsense input", () => {
    expect(trendingWindowStart(NOW, 0).getTime()).toBe(utcDayStart(NOW).getTime());
    expect(trendingWindowStart(NOW, -5).getTime()).toBe(utcDayStart(NOW).getTime());
  });
});

describe("decayWeight", () => {
  it("counts a view today at full weight", () => {
    expect(decayWeight(0, TRENDING_HALF_LIFE_DAYS)).toBe(1);
  });

  it("halves at one half-life and quarters at two", () => {
    expect(decayWeight(TRENDING_HALF_LIFE_DAYS, TRENDING_HALF_LIFE_DAYS)).toBeCloseTo(0.5, 10);
    expect(decayWeight(TRENDING_HALF_LIFE_DAYS * 2, TRENDING_HALF_LIFE_DAYS)).toBeCloseTo(0.25, 10);
  });

  it("is strictly decreasing in age", () => {
    // Monotonicity is the property the rail depends on: an older view can never
    // be worth more than a newer one, whatever the half-life is tuned to.
    for (let age = 0; age < 10; age += 1) {
      expect(decayWeight(age + 1, TRENDING_HALF_LIFE_DAYS)).toBeLessThan(decayWeight(age, TRENDING_HALF_LIFE_DAYS));
    }
  });

  it("bounds how much recency can be worth across the default window", () => {
    // 4x, stated as a test rather than only as a comment, because this ratio is
    // the entire tuning decision: below it the rail freezes on last week's
    // spike, above it one busy afternoon outranks a week of steady interest.
    const newest = decayWeight(0, TRENDING_HALF_LIFE_DAYS);
    const oldest = decayWeight(TRENDING_WINDOW_DAYS - 1, TRENDING_HALF_LIFE_DAYS);
    expect(newest / oldest).toBeCloseTo(4, 10);
  });

  it("scores nothing for input it cannot interpret", () => {
    // A corrupt row or a misconfigured half-life must empty the rail, not
    // quietly rank it on something other than recency. A negative age is a
    // bucket dated in the future: a clock fault, not attention.
    expect(decayWeight(Number.NaN, TRENDING_HALF_LIFE_DAYS)).toBe(0);
    expect(decayWeight(-1, TRENDING_HALF_LIFE_DAYS)).toBe(0);
    expect(decayWeight(1, 0)).toBe(0);
    expect(decayWeight(1, -3)).toBe(0);
    expect(decayWeight(1, Number.NaN)).toBe(0);
  });
});

describe("rankTrending — honest degradation", () => {
  it("returns nothing at all when there is no signal", () => {
    expect(rankTrending([], rankOpts())).toEqual([]);
  });

  it("returns nothing when one product is popular and nothing else is", () => {
    // The headline refusal. A single product with a thousand views is not a
    // trend, it is an anecdote wearing a comparative label — the rail's header
    // claims a selection out of a catalogue that was never made. The UI hides
    // an empty rail; there is no fallback ordering to reach for.
    expect(rankTrending([bucket("a", 0, 1000)], rankOpts())).toEqual([]);
  });

  it("returns nothing when the field is one short of the quorum", () => {
    const nearly = filler(MIN_TRENDING_PRODUCTS - 1, 50);
    expect(rankTrending(nearly, rankOpts())).toEqual([]);
    // ...and everything the moment it is met, so the quorum is the only thing
    // standing between this data and a rendered rail.
    expect(rankTrending(filler(MIN_TRENDING_PRODUCTS, 50), rankOpts())).toHaveLength(MIN_TRENDING_PRODUCTS);
  });

  it("measures the quorum on qualifying products, not on the rail size", () => {
    // A caller asking for two tiles gets two, provided three products earned
    // the ranking they were chosen from. The quorum is about the evidence.
    const ranked = rankTrending(filler(5, 50), rankOpts({ limit: 2 }));
    expect(ranked).toHaveLength(2);
  });
});

describe("rankTrending — what counts", () => {
  it("drops a product below the view threshold instead of ranking it last", () => {
    // Under the threshold the order is being set by one curious person, or by
    // one crawler the ingest fence missed. "Barely looked at" is not a position
    // in a trending list.
    const buckets = [...filler(3, 50), bucket("quiet", 0, MIN_VIEWS_FOR_TRENDING - 1)];
    expect(rankTrending(buckets, rankOpts())).not.toContain("quiet");
  });

  it("qualifies on raw views summed across the window, not on the decayed score", () => {
    // Decay decides the ORDER among products that earned a place; it must not
    // be able to grant one. Views spread thinly over the week still add up to a
    // real audience even though every one of them is discounted.
    const spread = Array.from({ length: MIN_VIEWS_FOR_TRENDING }, (_, i) => bucket("spread", i, 1));
    const ranked = rankTrending([...spread, ...filler(3, 50)], rankOpts());
    expect(ranked).toContain("spread");
  });

  it("ignores buckets older than the window", () => {
    const stale = bucket("stale", TRENDING_WINDOW_DAYS, 500);
    expect(rankTrending([stale, ...filler(3, 50)], rankOpts())).not.toContain("stale");
    // The boundary is inclusive on the near side: the oldest day IN the window
    // still counts, or the window would silently be a day short.
    const edge = bucket("edge", TRENDING_WINDOW_DAYS - 1, 500);
    expect(rankTrending([edge, ...filler(3, 50)], rankOpts())).toContain("edge");
  });

  it("ignores a bucket dated in the future rather than crowning it", () => {
    // A future bucket comes from clock skew, not from attention. Clamping it to
    // "today" would give a broken clock the freshest signal on the page.
    const future = { productId: "future", bucketDate: daysAgo(-2), views: 10_000 };
    expect(rankTrending([future, ...filler(3, 50)], rankOpts())).not.toContain("future");
  });

  it("ignores impossible view counts rather than sorting NaN into the middle", () => {
    const junk: ViewBucket[] = [
      { productId: "nan", bucketDate: daysAgo(0), views: Number.NaN },
      { productId: "negative", bucketDate: daysAgo(0), views: -500 },
    ];
    const ranked = rankTrending([...junk, ...filler(3, 50)], rankOpts());
    expect(ranked).not.toContain("nan");
    expect(ranked).not.toContain("negative");
  });
});

describe("rankTrending — the order", () => {
  it("prefers recent attention to older attention of the same size", () => {
    // This is the difference between "trending" and "most viewed this week".
    // Equal totals, different days: the one being looked at now wins.
    const buckets = [bucket("fresh", 0, 20), bucket("stale", 6, 20), ...filler(3, 50)];
    const ranked = rankTrending(buckets, rankOpts({ limit: 10 }));
    expect(ranked.indexOf("fresh")).toBeLessThan(ranked.indexOf("stale"));
  });

  it("does not let recency alone beat an order-of-magnitude difference", () => {
    // The decay is bounded at 4x across the window, so a product with 10x the
    // views cannot be displaced by being a few days older. A rail that ranked
    // purely on recency would be "recently viewed", which is a different claim.
    const buckets = [bucket("big", 6, 200), bucket("small", 0, 20), ...filler(3, 50)];
    const ranked = rankTrending(buckets, rankOpts({ limit: 10 }));
    expect(ranked.indexOf("big")).toBeLessThan(ranked.indexOf("small"));
  });

  it("sums a product's buckets across the window", () => {
    const steady = [bucket("steady", 0, 10), bucket("steady", 1, 10), bucket("steady", 2, 10)];
    const oneDay = [bucket("oneday", 0, 12)];
    const ranked = rankTrending([...steady, ...oneDay, ...filler(3, 8)], rankOpts({ limit: 10 }));
    expect(ranked.indexOf("steady")).toBeLessThan(ranked.indexOf("oneday"));
  });

  it("breaks ties deterministically so the rail does not reshuffle between requests", () => {
    // Equal scores have no defined order. Without a total ordering the 60-second
    // cache serves a different "ranking" every time it refills, which reads to a
    // visitor as a page that cannot make up its mind.
    const buckets = [bucket("z", 0, 10), bucket("a", 0, 10), bucket("m", 0, 10)];
    expect(rankTrending(buckets, rankOpts())).toEqual(["a", "m", "z"]);
    expect(rankTrending([...buckets].reverse(), rankOpts())).toEqual(["a", "m", "z"]);
  });

  it("breaks a score tie on raw views before falling back to the id", () => {
    // Two products can reach the same decayed score from different shapes: a
    // week of quiet interest and one recent burst. The larger real audience is
    // the better claim, so it is preferred before the arbitrary id tiebreak.
    const halfLife = 1;
    // "burst" scores 8 today; "wide" scores 8 from 16 views one day old.
    const buckets = [bucket("burst", 0, 8), bucket("wide", 1, 16), ...filler(3, 4)];
    const ranked = rankTrending(buckets, rankOpts({ halfLifeDays: halfLife, minViews: 4, limit: 10 }));
    expect(ranked.indexOf("wide")).toBeLessThan(ranked.indexOf("burst"));
  });

  it("returns at most the requested number of rows", () => {
    const buckets = Array.from({ length: 20 }, (_, i) => bucket(`p${i}`, 0, 100 - i));
    expect(rankTrending(buckets, rankOpts({ limit: 5 }))).toHaveLength(5);
    expect(rankTrending(buckets, rankOpts({ limit: 0 }))).toEqual([]);
  });

  it("does not mutate the caller's array", () => {
    const buckets = [bucket("a", 0, 10), bucket("b", 0, 90), bucket("c", 1, 40)];
    const snapshot = buckets.map((b) => ({ ...b }));
    rankTrending(buckets, rankOpts());
    expect(buckets).toEqual(snapshot);
  });
});

describe("the thresholds themselves", () => {
  it("requires more than one product before calling anything a trend", () => {
    // Guards the constant, not the code: lowering this to 1 would turn the rail
    // back into "the single product somebody happened to open".
    expect(MIN_TRENDING_PRODUCTS).toBeGreaterThanOrEqual(2);
  });

  it("requires more than a couple of views before ranking a product", () => {
    expect(MIN_VIEWS_FOR_TRENDING).toBeGreaterThanOrEqual(3);
  });

  it("decays inside the window rather than across it", () => {
    // A half-life at or beyond the window length is decay that never bites: the
    // oldest view in the rail would still be worth more than half a fresh one.
    expect(TRENDING_HALF_LIFE_DAYS).toBeLessThan(TRENDING_WINDOW_DAYS);
    expect(TRENDING_HALF_LIFE_DAYS).toBeGreaterThan(0);
  });
});
