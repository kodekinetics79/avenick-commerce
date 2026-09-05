import { db } from "../index";
import { read, write } from "../resilient-ops";
import { PRODUCT_LIST_INCLUDE, attachProductRatings, type ProductListRow, type ProductListRowBase } from "./products";
import { orderRowsByIds, publicProductWhere, sectionSize } from "./storefront-sections";

/**
 * The view signal, and the one rail that is allowed to read it.
 *
 * Before this module nothing in this codebase recorded that a product had been
 * LOOKED AT — only that one had been bought or reviewed. A "Trending" rail built
 * on top of that absence could only have been ranking on something else and
 * calling it attention, which is why this file exists at all: it is the
 * measurement, not the presentation of one.
 *
 * The rules it will not break, inherited from storefront-sections.ts:
 *
 *  · A RANK IS A COUNT OF SOMETHING THAT HAPPENED. `getTrendingProducts` ranks
 *    on rows written by real requests to the ingest endpoint, decayed by age.
 *    There is no seeded baseline, no popularity prior and no fallback ordering.
 *  · NOT ENOUGH SIGNAL IS AN EMPTY RAIL. Below the thresholds below the function
 *    returns [], and the UI hides the section. A rail padded with "some
 *    products" labelled Trending is a lie that costs nothing to tell and is
 *    therefore the one this module refuses hardest.
 *  · IT SHOWS ONLY WHAT THE CATALOG WOULD SHOW. Visibility is `publicProductWhere`
 *    imported from storefront-sections, applied at RANK time — so a product that
 *    was viewed a thousand times last week and has since been withdrawn, or
 *    whose seller has been suspended, cannot appear.
 *
 * WHAT THE SIGNAL IS AND IS NOT. It is a measure of attention, de-duplicated at
 * the ingest edge (see `recordProductView`) so that one person refreshing a page
 * forty times contributes one unit and not forty. It is NOT audited, nothing
 * financial reads it, and a determined adversary with many addresses can move
 * it — as with every view-based signal that does not require a login. That is
 * stated here rather than defended against, because the defence (accounts,
 * device attestation) would cost more than the rail is worth.
 */

// ─── WINDOW, DECAY AND THRESHOLDS ─────────────────────────────────────────────

/**
 * How many days of signal "trending" means, the current day included.
 *
 * Seven, because a week is the shortest window that contains a whole shopping
 * cycle. Under a week the rail is decided by whichever weekday it is read on —
 * a Friday-heavy B2C catalogue and a Monday-heavy B2B one would each rank
 * themselves out of the other's week. Much over a week and the word stops being
 * true: a month of accumulated views is popularity, and this codebase already
 * has a rail for that (Best Sellers) built on a stronger signal than views.
 */
export const TRENDING_WINDOW_DAYS = 7;

/**
 * Ceiling on a caller-supplied window. The read below scans one row per
 * candidate product per day in the window; a caller must not be able to turn a
 * public storefront rail into a full-table scan by asking for ten years.
 */
export const MAX_TRENDING_WINDOW_DAYS = 30;

/**
 * Age at which a view counts half of what today's view counts.
 *
 * Three days over a seven-day window means today's view is worth exactly 4x a
 * view from the far end of the window (2^(6/3)). That ratio is the whole design:
 * big enough that a product which stopped being viewed slides out of the rail
 * within a few days instead of sitting there on last week's spike, small enough
 * that one busy afternoon cannot outrank a week of steady interest. Without
 * decay this rail would be "most viewed in the last 7 days", which changes only
 * when the window's leading edge drops a spike — i.e. it would look frozen for
 * days at a time and then lurch.
 */
export const TRENDING_HALF_LIFE_DAYS = 3;

/**
 * Views a product needs inside the window before it may be ranked at all.
 *
 * Five, and the number is chosen rather than borrowed. Because ingest is
 * de-duplicated per discriminator per day, five window views means roughly five
 * separate sessions took an interest. Below that the ranking is reading noise:
 * at one or two views a single curious person — or one crawler the fence
 * happened to miss — decides the order of the rail, which is the view-signal
 * version of the "one 5-star review is a 5.0" problem MIN_REVIEWS_FOR_TOP_RATED
 * exists to solve. It is not set higher because a 385-product catalogue with
 * modest traffic would then never fill the rail while genuine interest existed,
 * and a section that never renders is not "safe", it is broken.
 */
export const MIN_VIEWS_FOR_TRENDING = 5;

/**
 * How many products must clear that bar before the rail may render AT ALL.
 *
 * Three. A "Trending" rail with one tile is not a ranking, it is an anecdote
 * wearing a comparative label — the header claims a selection was made out of a
 * catalogue when in truth one product happened to be looked at. Two is barely
 * better: the ordering of two items carries almost no information and the rail
 * reads as a bug. At three the section is a genuine selection and its order
 * means something.
 *
 * This quorum is measured on the number of QUALIFYING products, before the
 * result is cut to `limit`. A caller asking for two tiles still gets two, as
 * long as three products earned the ranking they were chosen from.
 */
export const MIN_TRENDING_PRODUCTS = 3;

/**
 * How many products the SQL pre-selection considers per rail slot.
 *
 * Candidate selection ranks by undecayed sum (which Postgres can order and
 * truncate), and the decay is then applied to the candidates' daily buckets in
 * this process. That two-step is an approximation, and here is its exact bound:
 * within the default window the largest possible weight ratio is 4, so a product
 * outside the candidate set can only have been misplaced against a candidate
 * whose window sum is less than four times its own. With four candidates per
 * slot (a floor of TRENDING_MIN_CANDIDATES) the products in that band are
 * already in the set.
 *
 * The alternative — pull every bucket in the window and rank it all here — is
 * exact, and it is what this would do for a 385-product catalogue. It is not
 * what it does, because the cost of that query grows with the catalogue and this
 * runs on the busiest route on the site.
 */
export const TRENDING_CANDIDATE_FACTOR = 4;

/** Floor on the candidate set, so a two-tile rail still ranks a real field. */
export const TRENDING_MIN_CANDIDATES = 24;

// ─── PURE TIME AND DECAY ──────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/**
 * The UTC calendar day a moment belongs to, as a Date at UTC midnight.
 *
 * UTC and not local time, in every runtime, deliberately. The storefront serves
 * six GCC time zones from servers in a seventh; if the bucket boundary followed
 * the machine's locale then two application instances would write two different
 * buckets for the same minute, and the unique constraint that makes the counter
 * atomic would be silently keyed on "wherever this process thinks it is". The
 * cost of UTC is that a bucket boundary falls at 3am or 4am Gulf time rather
 * than midnight, which no reader of a trending rail can perceive.
 */
export function utcDayStart(when: Date): Date {
  return new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()));
}

/**
 * The oldest bucket a window of `windowDays` includes, counting today as day 1.
 * `windowDays: 1` therefore means "today only", never "yesterday onward".
 */
export function trendingWindowStart(now: Date, windowDays: number): Date {
  const days = Math.max(1, Math.floor(windowDays));
  return new Date(utcDayStart(now).getTime() - (days - 1) * MS_PER_DAY);
}

/** Whole UTC days between a bucket's day and the reference day. Negative = future. */
export function bucketAgeInDays(bucketDate: Date, now: Date): number {
  const diff = utcDayStart(now).getTime() - utcDayStart(bucketDate).getTime();
  return Math.round(diff / MS_PER_DAY);
}

/**
 * Exponential decay by age: 1 today, 1/2 at one half-life, 1/4 at two.
 *
 * Every input this function cannot interpret returns 0 — "does not count" —
 * rather than a guess. A NaN age from a corrupt row, or a misconfigured
 * half-life of zero, must empty the rail rather than quietly rank it on
 * something other than recency. A negative age is a bucket dated in the future,
 * which is a clock fault and not attention, so it also scores nothing.
 */
export function decayWeight(ageDays: number, halfLifeDays: number): number {
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;
  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 0;
  return Math.pow(2, -ageDays / halfLifeDays);
}

// ─── PURE RANKING ─────────────────────────────────────────────────────────────

/** One day's bucket for one product, exactly as the table stores it. */
export interface ViewBucket {
  productId: string;
  bucketDate: Date;
  views: number;
}

export interface TrendingRankOptions {
  /** The moment "trending" is being asked about. Buckets are aged against it. */
  now: Date;
  windowDays: number;
  halfLifeDays: number;
  /** Minimum RAW views in the window before a product may be ranked. */
  minViews: number;
  /** Minimum number of qualifying products before the rail may render at all. */
  minProducts: number;
  limit: number;
}

/**
 * Rank products by decayed recent views, or refuse to rank them.
 *
 * The return is a list of ids, most trending first, and the empty array is a
 * first-class answer: it is what "there is not enough signal to say" looks like,
 * and it is returned whenever fewer than `minProducts` products clear
 * `minViews`. It never falls back to raw counts, to newest, or to anything else.
 *
 * The threshold is applied to RAW window views, not to the decayed score. Decay
 * decides the ORDER among products that earned a place; it must not be able to
 * grant one, or a product with three views today would out-qualify a product
 * with twenty spread over the week.
 *
 * Ties break on raw views and then on id. Both are for stability, not taste: two
 * equal scores have no defined order, so without a total ordering the rail
 * reshuffles every time the 60-second cache refills and the page looks broken.
 */
export function rankTrending(buckets: ViewBucket[], opts: TrendingRankOptions): string[] {
  const windowDays = Math.max(1, Math.floor(opts.windowDays));
  const totals = new Map<string, { score: number; raw: number }>();

  for (const bucket of buckets) {
    if (!bucket.productId) continue;
    if (!Number.isFinite(bucket.views) || bucket.views <= 0) continue;
    const age = bucketAgeInDays(bucket.bucketDate, opts.now);
    // Outside the window is not "old", it is not asked about. A future-dated
    // bucket lands here too, and is dropped rather than clamped to today: a
    // clock fault must never be able to mint the freshest signal on the page.
    if (!Number.isFinite(age) || age < 0 || age >= windowDays) continue;
    const weight = decayWeight(age, opts.halfLifeDays);
    if (weight <= 0) continue;
    const entry = totals.get(bucket.productId) ?? { score: 0, raw: 0 };
    entry.score += bucket.views * weight;
    entry.raw += bucket.views;
    totals.set(bucket.productId, entry);
  }

  const qualifying = Array.from(totals.entries())
    .filter(([, entry]) => entry.raw >= opts.minViews && Number.isFinite(entry.score) && entry.score > 0)
    .map(([productId, entry]) => ({ productId, ...entry }));

  // The quorum is on the evidence, not on the display: it is checked before the
  // slice, so asking for two tiles does not lower the bar to two products.
  if (qualifying.length < Math.max(1, Math.floor(opts.minProducts))) return [];

  return qualifying
    .sort((a, b) => b.score - a.score || b.raw - a.raw || a.productId.localeCompare(b.productId))
    .slice(0, Math.max(0, Math.floor(opts.limit)))
    .map((entry) => entry.productId);
}

// ─── WRITE PATH ───────────────────────────────────────────────────────────────

/**
 * What happened to a view we were asked to record. Three outcomes, because
 * "we chose not to count this" and "we could not count this" are different
 * facts and a caller that logs them as one loses the ability to notice an
 * outage.
 */
export type RecordProductViewOutcome =
  /** The bucket was incremented. */
  | "counted"
  /** The product id was unusable or names no product. Nothing was wrong. */
  | "ignored"
  /** The database refused or did not answer in time. The view is lost. */
  | "unavailable";

export interface RecordProductViewOptions {
  /** The moment of the view. Defaults to now; injected by tests. */
  now?: Date;
}

/** cuid/uuid shaped. Anything else never reaches a query. */
const PRODUCT_ID_SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

function prismaErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/**
 * Record one view of one product, on the day it happened.
 *
 * THIS FUNCTION DOES NOT THROW. It is called from a fire-and-forget ingest
 * route that sits behind a page render; a signal for a rail that may not even
 * be on screen must never be able to fail a request, and a lost view is a
 * rounding error while a 500 is an incident. Every failure is converted into an
 * outcome the caller may log.
 *
 * IT IS ALSO NOT A READ-THEN-WRITE. The increment is a single upsert against
 * the unique (productId, bucketDate) constraint, which Prisma compiles to an
 * INSERT ... ON CONFLICT DO UPDATE for a shape this simple, so two concurrent
 * views of the same product on the same day both land. `SELECT` then `UPDATE`
 * would drop one of them under exactly the traffic that makes a product
 * trending in the first place. The P2002 branch below covers the case where the
 * two INSERTs race outside that optimisation: the loser retries as the
 * increment it always was, which is safe precisely because it is an increment.
 *
 * DE-DUPLICATION IS NOT DONE HERE. This function counts what it is given; the
 * ingest route decides what is worth giving it (one view per discriminator per
 * product per UTC day). That split is deliberate: the fence needs request
 * context this layer does not have, and the database layer must stay free of it
 * so that no discriminator is ever written to a table.
 *
 * The write is fail-fast (no retry, no cache) and its per-attempt budget is the
 * shared write timeout. It never enters a transaction, holds no lock beyond the
 * row, and touches no table the checkout path reads.
 */
export async function recordProductView(
  productId: string,
  opts: RecordProductViewOptions = {},
): Promise<RecordProductViewOutcome> {
  const id = productId?.trim();
  if (!id || !PRODUCT_ID_SHAPE.test(id)) return "ignored";
  const bucketDate = utcDayStart(opts.now ?? new Date());

  const increment = () =>
    db.productViewSignal.upsert({
      where: { productId_bucketDate: { productId: id, bucketDate } },
      create: { productId: id, bucketDate, views: 1 },
      update: { views: { increment: 1 } },
      select: { id: true },
    });

  try {
    await write(increment, { name: "signals.productView" });
    return "counted";
  } catch (error) {
    const code = prismaErrorCode(error);
    // No such product. The id came off a public request body, so this is an
    // ordinary bad input, not a fault: refuse it quietly.
    if (code === "P2003") return "ignored";
    if (code !== "P2002") return "unavailable";
    // Lost an insert race with a concurrent first view of the same product
    // today. The row now exists; the operation was always "add one".
    try {
      await write(
        () =>
          db.productViewSignal.update({
            where: { productId_bucketDate: { productId: id, bucketDate } },
            data: { views: { increment: 1 } },
            select: { id: true },
          }),
        { name: "signals.productView.retry" },
      );
      return "counted";
    } catch {
      return "unavailable";
    }
  }
}

// ─── READ PATH ────────────────────────────────────────────────────────────────

export interface TrendingProductsOptions {
  /** Rows in the rail. Clamped by sectionSize, exactly like the other rails. */
  limit?: number;
  /**
   * Consumer storefront (isB2CEnabled). THREE-STATE, and undefined means BOTH
   * channels — not B2C. See publicProductWhere in storefront-sections.ts: no
   * product in this catalogue has isB2CEnabled set, so defaulting this to true
   * would silently return zero rows and present an empty rail as "nothing is
   * trending". Callers pass a channel only when they genuinely mean to filter.
   */
  b2c?: boolean;
  /** Days of signal to consider, today included. Clamped to 1..30. */
  windowDays?: number;
  /** Decay half-life in days. Clamped to at least half a day. */
  halfLifeDays?: number;
  /** Raise the per-product bar. Never silently lowered below 1. */
  minViews?: number;
  /** Raise the quorum. Never silently lowered below 1. */
  minProducts?: number;
  /** The moment being asked about. Defaults to now; injected by tests. */
  now?: Date;
}

function clampWindowDays(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return TRENDING_WINDOW_DAYS;
  return Math.min(MAX_TRENDING_WINDOW_DAYS, Math.max(1, Math.floor(value)));
}

function clampHalfLifeDays(value: number | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return TRENDING_HALF_LIFE_DAYS;
  return Math.max(0.5, value);
}

/**
 * The Trending rail: products ranked by recent, decayed, de-duplicated views,
 * in the SAME row shape `listProducts` returns so the existing catalog tile
 * renders them with no new component and no second include to drift.
 *
 * Returns [] — and means it — whenever the signal cannot support a ranking:
 * before any view has been recorded, on a quiet week, or when fewer than
 * MIN_TRENDING_PRODUCTS products clear MIN_VIEWS_FOR_TRENDING. The UI hides an
 * empty rail. There is no fallback ordering anywhere in this function.
 *
 * Cost: at most three round trips plus the shared rating aggregate, all bounded
 * by the rail size rather than by the catalogue —
 *   1. one grouped SUM over the window, filtered by public visibility and cut to
 *      the candidate set in SQL (the threshold is a HAVING, so products that
 *      cannot qualify are never returned);
 *   2. the candidates' daily buckets — at most candidates x windowDays rows,
 *      ~224 at the defaults — which is what decay needs and a SUM cannot give;
 *   3. one keyed fetch of the winning rows.
 * Wrapped in the resilient read with the same 60s TTL the other rails use, so a
 * degraded database costs the page a stale rail rather than a 500.
 */
export async function getTrendingProducts(opts: TrendingProductsOptions = {}): Promise<ProductListRow[]> {
  const limit = sectionSize(opts.limit);
  const windowDays = clampWindowDays(opts.windowDays);
  const halfLifeDays = clampHalfLifeDays(opts.halfLifeDays);
  const minViews = Math.max(1, Math.floor(opts.minViews ?? MIN_VIEWS_FOR_TRENDING));
  const minProducts = Math.max(1, Math.floor(opts.minProducts ?? MIN_TRENDING_PRODUCTS));
  const now = opts.now ?? new Date();
  const from = trendingWindowStart(now, windowDays);
  const visible = publicProductWhere(opts.b2c);

  // Keyed on the DAY, not the instant: `now` moves every millisecond and would
  // give every request its own cache entry, i.e. no cache at all.
  const cacheKey = `storefront:trending:${JSON.stringify({
    limit,
    b2c: opts.b2c ?? null,
    windowDays,
    halfLifeDays,
    minViews,
    minProducts,
    day: utcDayStart(now).toISOString(),
  })}`;

  const { data } = await read(
    async () => {
      const candidates = await db.productViewSignal.groupBy({
        by: ["productId"],
        where: {
          bucketDate: { gte: from },
          // Visibility is applied HERE, not after ranking: filtering afterwards
          // would return a short rail whenever a heavily viewed product is
          // hidden, because the truncation would already have happened.
          product: visible,
        },
        _sum: { views: true },
        having: { views: { _sum: { gte: minViews } } },
        orderBy: { _sum: { views: "desc" } },
        take: Math.max(TRENDING_MIN_CANDIDATES, limit * TRENDING_CANDIDATE_FACTOR),
      });

      // Not enough products can possibly qualify, whatever the decay does to
      // their order. Say so without spending two more queries on it.
      if (candidates.length < minProducts) return [] as ProductListRow[];

      const candidateIds = candidates.map((group) => group.productId);
      const buckets = await db.productViewSignal.findMany({
        where: { productId: { in: candidateIds }, bucketDate: { gte: from } },
        select: { productId: true, bucketDate: true, views: true },
      });

      const rankedIds = rankTrending(buckets, {
        now,
        windowDays,
        halfLifeDays,
        minViews,
        minProducts,
        limit,
      });
      if (rankedIds.length === 0) return [] as ProductListRow[];

      // Re-checked at fetch time as well as at aggregate time. The two queries
      // are seconds apart and a seller can be suspended in between; the tile
      // that renders must satisfy the predicate, not merely have satisfied it.
      const rows: ProductListRowBase[] = await db.product.findMany({
        where: { ...visible, id: { in: rankedIds } },
        take: rankedIds.length,
        include: PRODUCT_LIST_INCLUDE,
      });

      // findMany returns database order, which has nothing to do with the rank
      // just computed. orderRowsByIds drops ids whose row vanished and never
      // appends a row that was not ranked.
      return attachProductRatings(orderRowsByIds(rows, rankedIds));
    },
    { name: "storefront.trending", cache: { key: cacheKey, ttlMs: 60_000 } },
  );

  return data;
}
