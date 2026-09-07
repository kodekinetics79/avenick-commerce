import { db } from "../index";
import type { OrderStatus, ProductStatus } from "@prisma/client";

/**
 * What a seller's listings did with the attention they got.
 *
 * The platform already records per-product, per-day view buckets
 * (ProductViewSignal, written by the storefront beacon), but until this existed
 * the ONLY reader was the customer-side trending ranker. The seller — the one
 * person whose decisions depend on it — could not see the traffic their own
 * listings received. Their analytics showed revenue, orders and average order
 * value: four ways of describing what was bought, and nothing about what was
 * looked at and not bought.
 *
 * That missing ratio is the single most actionable number a marketplace can
 * give a seller. Amazon's entire Business Reports spine is built on it, under
 * the name "Unit Session Percentage": units ordered divided by sessions. A
 * listing with heavy traffic and no conversion has a price, image or copy
 * problem; a listing with conversion and no traffic has a discoverability
 * problem. The two look identical on a revenue chart and call for opposite work.
 */

/** The window these figures describe. Matches the performance score's month scale. */
export const LISTING_TRAFFIC_WINDOW_DAYS = 30;

export interface ListingTrafficRow {
  productId: string;
  sku: string;
  nameEn: string;
  status: ProductStatus;
  /** De-duplicated views in the window. See the caveat on `SellerListingTraffic`. */
  views: number;
  /** Units ordered in the window, in EVERY currency — see the note in the loader. */
  unitsOrdered: number;
  /** Sales in the reporting currency only. Null when this listing sold in none of it. */
  orderedProductSales: number | null;
  /**
   * Units ordered per view, 0..1 — or null when there were no views.
   *
   * Null, never zero. "0% conversion" is a claim that people looked and did not
   * buy; a listing nobody has seen has not converted badly, it has not been
   * measured. The two demand different work, so they must not print the same.
   */
  conversion: number | null;
}

export interface SellerListingTraffic {
  windowDays: number;
  rows: ListingTrafficRow[];
  totals: {
    views: number;
    unitsOrdered: number;
    orderedProductSales: number | null;
    conversion: number | null;
  };
  /** The currency the money column is in — the seller's most-used. Null when nothing sold. */
  currency: string | null;
  /** Order lines left out of the money column because they were placed in another currency. */
  excludedLineCount: number;
  excludedCurrencies: string[];
}

/** Orders that never became sales cannot count against a listing's conversion. */
const UNCOUNTED_ORDER_STATUSES: OrderStatus[] = ["CANCELLED", "PENDING_PAYMENT"];

/**
 * Rank listings by the work they need: the ones with the most attention going
 * nowhere first. A listing with no views at all is not "worst" — it is
 * unmeasured — so it sorts below every measured one rather than at the top.
 */
export function rankByUnconvertedAttention(rows: readonly ListingTrafficRow[]): ListingTrafficRow[] {
  return [...rows].sort((a, b) => {
    if (a.conversion === null && b.conversion === null) return b.views - a.views || a.sku.localeCompare(b.sku);
    if (a.conversion === null) return 1;
    if (b.conversion === null) return -1;
    // Most views, worst conversion, first.
    const wasted = (row: ListingTrafficRow) => row.views * (1 - (row.conversion ?? 0));
    return wasted(b) - wasted(a) || b.views - a.views || a.sku.localeCompare(b.sku);
  });
}

/**
 * Views and conversion for every listing this seller had in the window.
 *
 * Two deliberate asymmetries between the count columns and the money column.
 *
 * Conversion is counted across EVERY currency. A view has no currency, so
 * restricting the numerator to one would divide this-currency units by
 * all-currency views and understate conversion for any seller trading in more
 * than one — silently, and worst for the sellers doing best. Money cannot be
 * added across currencies at all (this platform converts nothing), so the sales
 * column reports the seller's most-used currency and says how many lines that
 * left out, the same way the analytics page does.
 *
 * A listing with views and no orders is INCLUDED and is the point of the
 * report; a listing with neither is omitted, because a row of dashes is not a
 * finding.
 */
export async function loadSellerListingTraffic(
  sellerId: string,
  options: { windowDays?: number; now?: Date } = {},
): Promise<SellerListingTraffic> {
  const windowDays = options.windowDays ?? LISTING_TRAFFIC_WINDOW_DAYS;
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - windowDays * 86_400_000);

  const products = await db.product.findMany({
    where: { sellerId, deletedAt: null },
    select: { id: true, sku: true, nameEn: true, status: true },
  });
  if (products.length === 0) {
    return emptyTraffic(windowDays);
  }
  const productIds = products.map((product) => product.id);

  const [viewBuckets, lines] = await Promise.all([
    db.productViewSignal.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, bucketDate: { gte: since } },
      _sum: { views: true },
    }),
    // Read as lines rather than grouped: the money column needs each line's
    // currency, which lives on the parent order and cannot be grouped by.
    db.orderItem.findMany({
      where: {
        sellerId,
        productId: { in: productIds },
        createdAt: { gte: since },
        status: { not: "CANCELLED" },
        order: { status: { notIn: UNCOUNTED_ORDER_STATUSES } },
      },
      select: { productId: true, quantity: true, total: true, order: { select: { currency: true } } },
    }),
  ]);

  const viewsByProduct = new Map(viewBuckets.map((bucket) => [bucket.productId, bucket._sum.views ?? 0]));

  // The reporting currency is the one this seller used on the most lines, with
  // the code itself breaking a tie so the choice is stable between page loads.
  const currencyCounts = new Map<string, number>();
  for (const line of lines) {
    currencyCounts.set(line.order.currency, (currencyCounts.get(line.order.currency) ?? 0) + 1);
  }
  const currency =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

  const unitsByProduct = new Map<string, number>();
  const salesByProduct = new Map<string, number>();
  let excludedLineCount = 0;
  for (const line of lines) {
    unitsByProduct.set(line.productId, (unitsByProduct.get(line.productId) ?? 0) + line.quantity);
    if (currency && line.order.currency === currency) {
      salesByProduct.set(line.productId, (salesByProduct.get(line.productId) ?? 0) + Number(line.total));
    } else {
      excludedLineCount += 1;
    }
  }

  const rows: ListingTrafficRow[] = [];
  for (const product of products) {
    const views = viewsByProduct.get(product.id) ?? 0;
    const unitsOrdered = unitsByProduct.get(product.id) ?? 0;
    // Neither looked at nor bought in the window: nothing to report, and a page
    // of empty rows would bury the listings that do have a finding.
    if (views === 0 && unitsOrdered === 0) continue;
    rows.push({
      productId: product.id,
      sku: product.sku,
      nameEn: product.nameEn,
      status: product.status,
      views,
      unitsOrdered,
      orderedProductSales: salesByProduct.has(product.id) ? salesByProduct.get(product.id)! : null,
      // Capped at 1: one session can order several units, and a ratio above
      // 100% reads as a broken number rather than as a very good listing.
      conversion: views > 0 ? Math.min(1, unitsOrdered / views) : null,
    });
  }

  const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.unitsOrdered, 0);
  const totalSales = rows.reduce((sum, row) => sum + (row.orderedProductSales ?? 0), 0);

  return {
    windowDays,
    rows: rankByUnconvertedAttention(rows),
    totals: {
      views: totalViews,
      unitsOrdered: totalUnits,
      orderedProductSales: currency ? totalSales : null,
      conversion: totalViews > 0 ? Math.min(1, totalUnits / totalViews) : null,
    },
    currency,
    excludedLineCount,
    excludedCurrencies: [...currencyCounts.keys()].filter((code) => code !== currency).sort(),
  };
}

function emptyTraffic(windowDays: number): SellerListingTraffic {
  return {
    windowDays,
    rows: [],
    totals: { views: 0, unitsOrdered: 0, orderedProductSales: null, conversion: null },
    currency: null,
    excludedLineCount: 0,
    excludedCurrencies: [],
  };
}
