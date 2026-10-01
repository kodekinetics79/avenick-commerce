import { db, Prisma, type Currency } from "../index";
import { PERFORMANCE_WINDOW_DAYS, scoreFromSignals } from "./seller-settings";

// ─── EXECUTIVE DASHBOARD ──────────────────────────────────────────────────────

/**
 * Percentage change of `current` over `previous`, rounded to a whole percent.
 *
 * Returns null — never 0 — when there is nothing to measure against: a prior
 * period of zero (or a non-finite input) is not a flat month, and the view
 * withholds the badge for null rather than paint "0%" as a measured result.
 * A genuine 0 is returned only when both months exist and are equal.
 */
export function monthOverMonth(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  // Math.round(-0.4) is -0, which Object.is and React's serialiser treat as a
  // distinct value from 0; a dip too small to register is a flat month.
  return percent === 0 ? 0 : percent;
}

export interface CurrencyAmount {
  currency: Currency;
  amount: number;
}

export interface CurrencyMetric extends CurrencyAmount {
  /** Month-over-month movement for this currency only. */
  trend: number | null;
}

export interface RevenueSplitByCurrency {
  currency: Currency;
  b2b: number;
  b2c: number;
  total: number;
}

export interface CurrencySpender {
  id: string;
  name: string;
  email: string;
  currency: Currency;
  spent: number;
  orders: number;
}

export interface HighValueBuyer {
  id: string;
  name: string;
  email: string;
  spent: CurrencyAmount[];
  orders: number;
}

/**
 * Attach a like-currency trend to each amount. The union is deliberate: when a
 * currency has no activity this month but did last month, the dashboard must
 * show zero and -100% rather than silently dropping the decline.
 */
export function currencyMetrics(
  amounts: CurrencyAmount[],
  current: CurrencyAmount[],
  previous: CurrencyAmount[],
): CurrencyMetric[] {
  const amountByCurrency = new Map(amounts.map((row) => [row.currency, row.amount]));
  const currentByCurrency = new Map(current.map((row) => [row.currency, row.amount]));
  const previousByCurrency = new Map(previous.map((row) => [row.currency, row.amount]));
  const currencies = new Set<Currency>([
    ...amountByCurrency.keys(),
    ...currentByCurrency.keys(),
    ...previousByCurrency.keys(),
  ]);

  return [...currencies]
    .sort((a, b) => a.localeCompare(b))
    .map((currency) => ({
      currency,
      amount: amountByCurrency.get(currency) ?? 0,
      trend: monthOverMonth(
        currentByCurrency.get(currency) ?? 0,
        previousByCurrency.get(currency) ?? 0,
      ),
    }));
}

/** Select the top fifth independently inside each currency, then deduplicate buyers. */
export function selectHighValueBuyers(rows: CurrencySpender[]): HighValueBuyer[] {
  const byCurrency = new Map<Currency, CurrencySpender[]>();
  for (const row of rows) {
    const currencyRows = byCurrency.get(row.currency) ?? [];
    currencyRows.push(row);
    byCurrency.set(row.currency, currencyRows);
  }

  const selectedIds = new Set<string>();
  for (const currencyRows of byCurrency.values()) {
    currencyRows.sort((a, b) => b.spent - a.spent || a.id.localeCompare(b.id));
    const cutoff = Math.max(1, Math.ceil(currencyRows.length * 0.2));
    for (const row of currencyRows.slice(0, cutoff)) {
      selectedIds.add(row.id);
    }
  }

  // Once a buyer qualifies in one currency, display their complete
  // per-currency history. Selection is per currency; disclosure is complete.
  const selected = new Map<string, HighValueBuyer>();
  for (const row of rows) {
    if (!selectedIds.has(row.id)) continue;
    const buyer = selected.get(row.id) ?? {
      id: row.id,
      name: row.name,
      email: row.email,
      spent: [],
      orders: 0,
    };
    buyer.spent.push({ currency: row.currency, amount: row.spent });
    buyer.orders += row.orders;
    selected.set(row.id, buyer);
  }

  return [...selected.values()]
    .map((buyer) => ({
      ...buyer,
      spent: buyer.spent.sort((a, b) => a.currency.localeCompare(b.currency)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * Monetary KPIs are always partitioned by their stored currency. Avenick does
 * not maintain an FX-rate source, so a cross-currency total or ranking would be
 * fictitious. Each CurrencyMetric carries only its own month-over-month delta.
 */
export interface ExecutiveKpis {
  gmvMonth: CurrencyMetric[];
  gmvTotal: CurrencyAmount[];
  ordersTotal: number;
  aov: CurrencyAmount[];
  b2bRevenue: CurrencyMetric[];
  b2cRevenue: CurrencyMetric[];
  commission: CurrencyMetric[];
  activeCompanies: number;
  companiesTrend: number | null;
  activeCustomers: number;
  customersTrend: number | null;
  activeSuppliers: number;
  suppliersTrend: number | null;
  rfqConversion: number;
  rfqConversionTrend: number | null;
  fulfillmentRate: number;
  fulfillmentTrend: number | null;
  warehouseUtilization: number;
  warehouseTrend: number | null;
  openDisputes: number;
  delayedOrders: number;
}

export async function getExecutiveDashboardData() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    paidAgg,
    monthAgg,
    prevMonthAgg,
    typeSplit,
    statusCounts,
    rfqCounts,
    activeSellers,
    activeCompanies,
    pendingSellers,
    openTickets,
    lowStock,
    unshippedPaid,
    openRFQs,
    categoryGmv,
    sellerGmv,
    topCustomerRows,
    commissionAgg,
    consumerCount,
    stockAgg,
    openDisputes,
    delayedOrders,
    monthTypeSplit,
    prevMonthTypeSplit,
    monthCommissionAgg,
    prevMonthCommissionAgg,
  ] = await Promise.all([
    db.order.groupBy({
      by: ["currency"],
      where: { paymentStatus: "PAID" },
      _sum: { total: true },
      _count: { _all: true },
      _avg: { total: true },
    }),
    db.order.groupBy({
      by: ["currency"],
      where: { paymentStatus: "PAID", createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["currency"],
      where: { paymentStatus: "PAID", createdAt: { gte: prevMonthStart, lt: monthStart } },
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["currency", "type"],
      where: { paymentStatus: "PAID" },
      _sum: { total: true },
    }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.rFQRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.sellerProfile.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.company.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "InventoryStock" WHERE (qty - "reservedQty") <= "reorderPoint"`,
    db.order.count({
      where: { paymentStatus: "PAID", status: { in: ["CONFIRMED", "PROCESSING"] } },
    }),
    db.rFQRequest.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, sellerId: null },
    }),
    db.$queryRaw<
      Array<{ currency: Currency; name: string; gmv: Prisma.Decimal; currencygmv: Prisma.Decimal }>
    >`
      WITH ranked AS (
        SELECT o.currency::text AS currency, c.id, c."nameEn" AS name,
               COALESCE(SUM(oi.total), 0) AS gmv,
               SUM(SUM(oi.total)) OVER (PARTITION BY o.currency) AS currencygmv,
               ROW_NUMBER() OVER (
                 PARTITION BY o.currency
                 ORDER BY SUM(oi.total) DESC, c.id
               ) AS currency_rank
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId" AND o."paymentStatus" = 'PAID'
        JOIN "Product" p ON p.id = oi."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        GROUP BY o.currency, c.id, c."nameEn"
      )
      SELECT currency, name, gmv, currencygmv FROM ranked
      WHERE currency_rank <= 5
      ORDER BY currency, currency_rank`,
    db.$queryRaw<
      Array<{
        id: string;
        currency: Currency;
        name: string;
        tier: string;
        gmv: Prisma.Decimal;
        orders: bigint;
        rating: number | null;
      }>
    >`
      WITH ranked AS (
        SELECT sp.id, o.currency::text AS currency,
               sp."businessNameEn" AS name, sp.tier::text AS tier,
               COALESCE(SUM(oi.total), 0) AS gmv,
               COUNT(DISTINCT oi."orderId") AS orders,
               (SELECT AVG(pr.rating)::float FROM "ProductReview" pr
                  JOIN "Product" pp ON pp.id = pr."productId" WHERE pp."sellerId" = sp.id) AS rating,
               ROW_NUMBER() OVER (
                 PARTITION BY o.currency
                 ORDER BY SUM(oi.total) DESC, sp.id
               ) AS currency_rank
        FROM "SellerProfile" sp
        JOIN "OrderItem" oi ON oi."sellerId" = sp.id
        JOIN "Order" o ON o.id = oi."orderId" AND o."paymentStatus" = 'PAID'
        GROUP BY sp.id, o.currency
      )
      SELECT id, currency, name, tier, gmv, orders, rating FROM ranked
      WHERE currency_rank <= 5
      ORDER BY currency, currency_rank`,
    // Erasure (services/data-rights.ts) anonymises the identity in place and
    // sets deletedAt: the orders are retained because they must be, but the
    // person is gone and must stop being named in reports. Without the guard
    // this report renders "Erased User" and their tombstone address next to a
    // spend figure — the same guard the consumerCount above already applies.
    db.$queryRaw<
      Array<{
        id: string;
        currency: Currency;
        name: string;
        type: string;
        totalorders: bigint;
        totalspent: Prisma.Decimal;
      }>
    >`
      WITH ranked AS (
        SELECT u.id, o.currency::text AS currency,
               u."firstName" || ' ' || u."lastName" AS name,
               CASE WHEN u.role = 'CONSUMER' THEN 'B2C' ELSE 'B2B' END AS type,
               COUNT(o.id) AS totalorders, COALESCE(SUM(o.total), 0) AS totalspent,
               ROW_NUMBER() OVER (
                 PARTITION BY o.currency
                 ORDER BY SUM(o.total) DESC, u.id
               ) AS currency_rank
        FROM "User" u JOIN "Order" o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
        WHERE u."deletedAt" IS NULL
        GROUP BY u.id, o.currency
      )
      SELECT id, currency, name, type, totalorders, totalspent FROM ranked
      WHERE currency_rank <= 5
      ORDER BY currency, currency_rank`,
    db.commission.groupBy({ by: ["currency"], _sum: { amount: true } }),
    db.user.count({ where: { role: "CONSUMER", status: "ACTIVE", deletedAt: null } }),
    db.inventoryStock.aggregate({ _sum: { qty: true, reservedQty: true } }),
    db.returnRequest.count({ where: { status: "REQUESTED" } }),
    db.order.count({
      where: {
        paymentStatus: "PAID",
        status: { in: ["CONFIRMED", "PROCESSING"] },
        createdAt: { lt: new Date(Date.now() - 48 * 3600_000) },
      },
    }),
    // The same two windows and the same PAID filter as monthAgg/prevMonthAgg,
    // split per channel, so the B2B and B2C trends are measured exactly the
    // way the GMV trend is instead of being copies of it.
    db.order.groupBy({
      by: ["currency", "type"],
      where: { paymentStatus: "PAID", createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["currency", "type"],
      where: { paymentStatus: "PAID", createdAt: { gte: prevMonthStart, lt: monthStart } },
      _sum: { total: true },
    }),
    // Commission rows carry their own createdAt, so the same comparison holds.
    db.commission.groupBy({
      by: ["currency"],
      where: { createdAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.commission.groupBy({
      by: ["currency"],
      where: { createdAt: { gte: prevMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
  ]);

  const totalAmounts = paidAgg.map((row) => ({
    currency: row.currency,
    amount: Number(row._sum.total ?? 0),
  }));
  const monthAmounts = monthAgg.map((row) => ({
    currency: row.currency,
    amount: Number(row._sum.total ?? 0),
  }));
  const previousMonthAmounts = prevMonthAgg.map((row) => ({
    currency: row.currency,
    amount: Number(row._sum.total ?? 0),
  }));
  const typeAmounts = (rows: typeof typeSplit, type: "B2B" | "B2C"): CurrencyAmount[] =>
    rows
      .filter((row) => row.type === type)
      .map((row) => ({ currency: row.currency, amount: Number(row._sum.total ?? 0) }));
  const b2bAmounts = typeAmounts(typeSplit, "B2B");
  const b2cAmounts = typeAmounts(typeSplit, "B2C");

  const statusCount = (statuses: string[]) =>
    statusCounts
      .filter((s) => statuses.includes(s.status))
      .reduce((sum, s) => sum + s._count._all, 0);
  const rfqCount = (statuses: string[]) =>
    rfqCounts.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s._count._all, 0);

  const lowStockCount = Number(lowStock[0]?.count ?? 0);
  const gmvMonth = currencyMetrics(monthAmounts, monthAmounts, previousMonthAmounts);
  const b2bRevenue = currencyMetrics(
    b2bAmounts,
    typeAmounts(monthTypeSplit, "B2B"),
    typeAmounts(prevMonthTypeSplit, "B2B"),
  );
  const b2cRevenue = currencyMetrics(
    b2cAmounts,
    typeAmounts(monthTypeSplit, "B2C"),
    typeAmounts(prevMonthTypeSplit, "B2C"),
  );
  const commissionAmounts = commissionAgg.map((row) => ({
    currency: row.currency,
    amount: Number(row._sum.amount ?? 0),
  }));
  const commission = currencyMetrics(
    commissionAmounts,
    monthCommissionAgg.map((row) => ({
      currency: row.currency,
      amount: Number(row._sum.amount ?? 0),
    })),
    prevMonthCommissionAgg.map((row) => ({
      currency: row.currency,
      amount: Number(row._sum.amount ?? 0),
    })),
  );

  const splitByCurrency = new Map<Currency, RevenueSplitByCurrency>();
  for (const row of typeSplit) {
    const split = splitByCurrency.get(row.currency) ?? {
      currency: row.currency,
      b2b: 0,
      b2c: 0,
      total: 0,
    };
    const amount = Number(row._sum.total ?? 0);
    if (row.type === "B2B") split.b2b = amount;
    if (row.type === "B2C") split.b2c = amount;
    split.total = split.b2b + split.b2c;
    splitByCurrency.set(row.currency, split);
  }
  const revenueSplit = [...splitByCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
  const ordersTotal = paidAgg.reduce((sum, row) => sum + row._count._all, 0);

  const totalRfqs = rfqCounts.reduce((s, c) => s + c._count._all, 0);
  const rfqConversion = totalRfqs > 0 ? Math.round((rfqCount(["ACCEPTED"]) / totalRfqs) * 100) : 0;
  const fulfillmentRate =
    ordersTotal > 0 ? Math.round((statusCount(["DELIVERED"]) / ordersTotal) * 100) : 0;
  const totalUnits = stockAgg._sum.qty ?? 0;
  const warehouseUtilization =
    totalUnits > 0 ? Math.round(((stockAgg._sum.reservedQty ?? 0) / totalUnits) * 100) : 0;

  // Rule-based operational recommendations from live signals (no ML claims).
  const recommendations: Array<{
    icon: string;
    iconStyle: string;
    title: string;
    description: string;
    confidence: number;
    tag: string;
    tagStyle: string;
    actionLabel: string;
    actionHref: string;
  }> = [];
  if (pendingSellers > 0) {
    recommendations.push({
      icon: "ShoppingCart",
      iconStyle: "bg-amber-500/15 text-amber-600",
      title: `${pendingSellers} seller application${pendingSellers === 1 ? "" : "s"} awaiting review`,
      description:
        "New suppliers cannot list products until approved. Review the onboarding queue.",
      confidence: 100,
      tag: "Onboarding",
      tagStyle: "bg-amber-500/15 text-amber-600",
      actionLabel: "Review sellers",
      actionHref: "/sellers/pending",
    });
  }
  if (unshippedPaid > 0) {
    recommendations.push({
      icon: "Truck",
      iconStyle: "bg-blue-500/15 text-primary",
      title: `${unshippedPaid} paid order${unshippedPaid === 1 ? "" : "s"} not yet fulfilled`,
      description:
        "Orders are paid and waiting in the pick & pack queue. Aging orders hurt delivery SLAs.",
      confidence: 100,
      tag: "Fulfilment",
      tagStyle: "bg-blue-500/15 text-primary",
      actionLabel: "Open queue",
      actionHref: "/warehouse/pickpack",
    });
  }
  if (lowStockCount > 0) {
    recommendations.push({
      icon: "Boxes",
      iconStyle: "bg-red-500/15 text-red-600",
      title: `${lowStockCount} stock line${lowStockCount === 1 ? "" : "s"} at or below reorder point`,
      description: "Low availability risks oversells and lost sales. Ask sellers to restock.",
      confidence: 100,
      tag: "Inventory",
      tagStyle: "bg-red-500/15 text-red-600",
      actionLabel: "View stock",
      actionHref: "/warehouse/stock?filter=low",
    });
  }
  if (openRFQs > 0) {
    recommendations.push({
      icon: "FileQuestion",
      iconStyle: "bg-purple-500/15 text-purple-600",
      title: `${openRFQs} open RFQ${openRFQs === 1 ? "" : "s"} without an assigned seller`,
      description: "Unassigned RFQs stall B2B pipeline. Route them to matching suppliers.",
      confidence: 100,
      tag: "B2B Pipeline",
      tagStyle: "bg-purple-500/15 text-purple-600",
      actionLabel: "View RFQs",
      actionHref: "/rfqs",
    });
  }

  // Monetary values and their trends are partitioned by currency. The
  // remaining figures are point-in-time counts and ratios with no
  // prior-period query behind them, so their trend is null — not 0, which
  // would read as "measured and flat".
  const kpis: ExecutiveKpis = {
    gmvMonth,
    gmvTotal: totalAmounts,
    ordersTotal,
    aov: paidAgg.map((row) => ({ currency: row.currency, amount: Number(row._avg.total ?? 0) })),
    b2bRevenue,
    b2cRevenue,
    commission,
    activeCompanies,
    companiesTrend: null,
    activeCustomers: consumerCount,
    customersTrend: null,
    activeSuppliers: activeSellers,
    suppliersTrend: null,
    rfqConversion,
    rfqConversionTrend: null,
    fulfillmentRate,
    fulfillmentTrend: null,
    warehouseUtilization,
    warehouseTrend: null,
    openDisputes,
    delayedOrders,
  };

  return {
    exec: {
      kpis,
      revenueSplit,
      rfqFunnel: [
        { stage: "Submitted", count: rfqCount(["SUBMITTED"]), color: "bg-blue-500" },
        { stage: "Under review", count: rfqCount(["UNDER_REVIEW"]), color: "bg-purple-500" },
        { stage: "Quoted", count: rfqCount(["QUOTED", "NEGOTIATING"]), color: "bg-amber-500" },
        { stage: "Accepted", count: rfqCount(["ACCEPTED"]), color: "bg-green-500" },
      ],
      orderLifecycle: [
        {
          stage: "Awaiting payment",
          count: statusCount(["PENDING_PAYMENT"]),
          color: "bg-slate-400",
        },
        { stage: "Confirmed", count: statusCount(["CONFIRMED"]), color: "bg-blue-500" },
        { stage: "Processing", count: statusCount(["PROCESSING"]), color: "bg-amber-500" },
        {
          stage: "Shipped",
          count: statusCount(["SHIPPED", "OUT_FOR_DELIVERY"]),
          color: "bg-purple-500",
        },
        {
          stage: "Delivered",
          count: statusCount(["DELIVERED", "COMPLETED"]),
          color: "bg-green-500",
        },
      ],
      topCategories: categoryGmv.map((c) => ({
        currency: c.currency,
        name: c.name,
        gmv: Number(c.gmv),
        share:
          Number(c.currencygmv) > 0 ? Math.round((Number(c.gmv) / Number(c.currencygmv)) * 100) : 0,
      })),
      topSuppliers: sellerGmv.map((s) => ({
        id: s.id,
        currency: s.currency,
        name: s.name,
        gmv: Number(s.gmv),
        orders: Number(s.orders),
        rating: s.rating ? Math.round(s.rating * 10) / 10 : 0,
        tier: s.tier,
      })),
      aiRecommendations: recommendations,
      operationalHealth: [
        {
          label: "Pending seller reviews",
          value: pendingSellers,
          severity: pendingSellers > 0 ? "warn" : "ok",
          href: "/sellers/pending",
        },
        {
          label: "Open support tickets",
          value: openTickets,
          severity: openTickets > 5 ? "warn" : "ok",
          href: "/support",
        },
        {
          label: "Low stock lines",
          value: lowStockCount,
          severity: lowStockCount > 0 ? "warn" : "ok",
          href: "/warehouse/stock?filter=low",
        },
        {
          label: "Unfulfilled paid orders",
          value: unshippedPaid,
          severity: unshippedPaid > 3 ? "warn" : "ok",
          href: "/warehouse/pickpack",
        },
      ],
    },
    topCustomers: topCustomerRows.map((c) => ({
      id: c.id,
      currency: c.currency,
      name: c.name,
      type: c.type,
      totalOrders: Number(c.totalorders),
      totalSpent: Number(c.totalspent),
    })),
  };
}

// ─── SUPPLIER PERFORMANCE ─────────────────────────────────────────────────────

export async function getSupplierPerformance() {
  const now = new Date();
  const since = new Date(now.getTime() - PERFORMANCE_WINDOW_DAYS * 86_400_000);
  const [rows, supplierGmvRows] = await Promise.all([
    db.$queryRaw<
      Array<{
        id: string;
        name: string;
        tier: string;
        orders: bigint;
        returns: bigint;
        shipments: bigint;
        ontime: bigint;
        health: number | null;
        rating: number | null;
        orderitemsinwindow: bigint;
        shippeditemsinwindow: bigint;
        rfqsinwindow: bigint;
        activeproducts: bigint;
        healthyproducts: bigint;
        currentdocuments: bigint;
        approveddocuments: bigint;
      }>
    >`
    SELECT sp.id, sp."businessNameEn" AS name, sp.tier::text AS tier,
      (SELECT COUNT(DISTINCT oi."orderId") FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."sellerId" = sp.id AND o."paymentStatus" = 'PAID') AS orders,
      (SELECT COUNT(*) FROM "ReturnRequest" rr WHERE rr."sellerId" = sp.id) AS returns,
      (SELECT COUNT(*) FROM "Shipment" s WHERE s."sellerId" = sp.id AND s."deliveredAt" IS NOT NULL) AS shipments,
      (SELECT COUNT(*) FROM "Shipment" s WHERE s."sellerId" = sp.id AND s."deliveredAt" IS NOT NULL
        AND (s."promisedBy" IS NULL OR s."deliveredAt" <= s."promisedBy")) AS ontime,
      (SELECT AVG(lhs.score)::float FROM "ListingHealthSnapshot" lhs
        JOIN "Product" p ON p.id = lhs."productId" WHERE p."sellerId" = sp.id) AS health,
      (SELECT AVG(pr.rating)::float FROM "ProductReview" pr
        JOIN "Product" p ON p.id = pr."productId" WHERE p."sellerId" = sp.id) AS rating
      ,(SELECT COUNT(*) FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."sellerId" = sp.id AND oi."createdAt" >= ${since}
          AND oi.status <> 'CANCELLED' AND o."paymentStatus" = 'PAID' AND o.status <> 'CANCELLED') AS orderitemsinwindow
      ,(SELECT COUNT(*) FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."sellerId" = sp.id AND oi."createdAt" >= ${since}
          AND oi.status <> 'CANCELLED' AND o."paymentStatus" = 'PAID' AND o.status <> 'CANCELLED'
          AND (oi.status IN ('SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED')
            OR o.status IN ('SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED'))) AS shippeditemsinwindow
      ,(SELECT COUNT(*) FROM "RFQRequest" rfq WHERE rfq."sellerId" = sp.id
          AND rfq."createdAt" >= ${since} AND rfq.status NOT IN ('DRAFT', 'CANCELLED')) AS rfqsinwindow
      ,(SELECT COUNT(*) FROM "Product" p WHERE p."sellerId" = sp.id
          AND p.status = 'ACTIVE' AND p."deletedAt" IS NULL) AS activeproducts
      ,(SELECT COUNT(*) FROM "Product" p WHERE p."sellerId" = sp.id
          AND p.status = 'ACTIVE' AND p."deletedAt" IS NULL
          AND NOT EXISTS (SELECT 1 FROM "ProductIssue" pi WHERE pi."productId" = p.id AND pi."resolvedAt" IS NULL)) AS healthyproducts
      ,(SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (sd.type) sd.status, sd."expiryDate"
          FROM "SellerDocument" sd WHERE sd."sellerId" = sp.id
          ORDER BY sd.type, sd."uploadedAt" DESC
        ) current_document) AS currentdocuments
      ,(SELECT COUNT(*) FROM (
          SELECT DISTINCT ON (sd.type) sd.status, sd."expiryDate"
          FROM "SellerDocument" sd WHERE sd."sellerId" = sp.id
          ORDER BY sd.type, sd."uploadedAt" DESC
        ) current_document
        WHERE current_document.status = 'APPROVED'
          AND (current_document."expiryDate" IS NULL OR current_document."expiryDate" > ${now})) AS approveddocuments
    FROM "SellerProfile" sp
    WHERE sp.status = 'ACTIVE' AND sp."deletedAt" IS NULL
    ORDER BY sp."businessNameEn", sp.id`,
    db.$queryRaw<Array<{ sellerid: string; currency: Currency; gmv: Prisma.Decimal }>>`
    SELECT oi."sellerId" AS sellerid, o.currency::text AS currency,
           COALESCE(SUM(oi.total), 0) AS gmv
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId" AND o."paymentStatus" = 'PAID'
    GROUP BY oi."sellerId", o.currency
    ORDER BY oi."sellerId", o.currency`,
  ]);

  const gmvBySeller = new Map<string, CurrencyAmount[]>();
  for (const row of supplierGmvRows) {
    const amounts = gmvBySeller.get(row.sellerid) ?? [];
    amounts.push({ currency: row.currency, amount: Number(row.gmv) });
    gmvBySeller.set(row.sellerid, amounts);
  }

  return rows.map((r) => {
    const orders = Number(r.orders);
    const shipments = Number(r.shipments);
    const onTimePct = shipments > 0 ? Math.round((Number(r.ontime) / shipments) * 100) : null;
    const returnRate = orders > 0 ? Math.round((Number(r.returns) / orders) * 1000) / 10 : 0;
    const health = r.health ? Math.round(r.health) : null;
    // One score definition is used by both seller and admin surfaces. In
    // particular, a new seller no longer receives a fabricated perfect score
    // from the old low-return component's empty denominator.
    const performance = scoreFromSignals({
      orderItemsInWindow: Number(r.orderitemsinwindow),
      rfqsInWindow: Number(r.rfqsinwindow),
      fulfilment: { good: Number(r.shippeditemsinwindow), total: Number(r.orderitemsinwindow) },
      listing: { good: Number(r.healthyproducts), total: Number(r.activeproducts) },
      compliance: { good: Number(r.approveddocuments), total: Number(r.currentdocuments) },
    });

    return {
      id: r.id,
      name: r.name,
      tier: r.tier,
      gmv: gmvBySeller.get(r.id) ?? [],
      orders,
      onTimePct,
      returnRate,
      health,
      rating: r.rating ? Math.round(r.rating * 10) / 10 : null,
      score: performance?.score ?? null,
    };
  });
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

export async function getCrmOverview() {
  const [rawRelationships, activities, topBuyers] = await Promise.all([
    db.sellerCustomer.findMany({
      // Relationship currencies are not comparable without FX. Recency is a
      // truthful deterministic ordering for this non-ranked ledger.
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 50,
      include: {
        seller: { select: { businessNameEn: true } },
      },
    }),
    db.customerActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { buyer: { select: { firstName: true, lastName: true, email: true } } },
    }),
    // Erased subjects are excluded here too — see getExecutiveDashboardData.
    // This one also selects the email, so the tombstone address would be shown.
    db.$queryRaw<
      Array<{
        id: string;
        currency: Currency;
        currencyrank: bigint;
        name: string;
        email: string;
        role: string;
        orders: bigint;
        spent: Prisma.Decimal;
        lastorder: Date | null;
      }>
    >`
      WITH ranked AS (
        SELECT u.id, o.currency::text AS currency,
               u."firstName" || ' ' || u."lastName" AS name,
               u.email, u.role::text AS role,
               COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent,
               MAX(o."createdAt") AS lastorder,
               ROW_NUMBER() OVER (
                 PARTITION BY o.currency
                 ORDER BY SUM(o.total) DESC, u.id
               ) AS currencyrank
        FROM "User" u JOIN "Order" o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
        WHERE u."deletedAt" IS NULL
        GROUP BY u.id, o.currency
      )
      SELECT id, currency, currencyrank, name, email, role, orders, spent, lastorder
      FROM ranked WHERE currencyrank <= 10
      ORDER BY currency, currencyrank`,
  ]);

  // SellerCustomer.buyerId has no Prisma relation — resolve identities in one query.
  // Erased subjects resolve to no identity, so the relationship row survives
  // (the trading history is real) but renders as "Unknown buyer" instead of
  // naming someone who exercised their right to erasure.
  const buyerIds = [...new Set(rawRelationships.map((r) => r.buyerId))];
  const buyers = await db.user.findMany({
    where: { id: { in: buyerIds }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
  const buyerMap = new Map(buyers.map((b) => [b.id, b]));

  return {
    relationships: rawRelationships.map((r) => ({ ...r, buyer: buyerMap.get(r.buyerId) ?? null })),
    activities,
    topBuyers: topBuyers.map((b) => ({
      id: b.id,
      currency: b.currency,
      currencyRank: Number(b.currencyrank),
      name: b.name,
      email: b.email,
      role: b.role,
      orders: Number(b.orders),
      spent: Number(b.spent),
      lastorder: b.lastorder,
    })),
  };
}

// ─── RETENTION ────────────────────────────────────────────────────────────────

export async function getRetentionMetrics() {
  const [buyerOrderCounts, monthly] = await Promise.all([
    db.$queryRaw<Array<{ buyers: bigint; repeat: bigint }>>`
      SELECT COUNT(*) AS buyers, COUNT(*) FILTER (WHERE cnt > 1) AS repeat
      FROM (SELECT "userId", COUNT(*) AS cnt FROM "Order" WHERE "paymentStatus" = 'PAID' GROUP BY "userId") t`,
    db.$queryRaw<Array<{ month: Date; newbuyers: bigint; returning: bigint }>>`
      WITH first_orders AS (
        SELECT "userId", MIN("createdAt") AS first_at FROM "Order" WHERE "paymentStatus" = 'PAID' GROUP BY "userId"
      )
      SELECT date_trunc('month', o."createdAt") AS month,
             COUNT(DISTINCT o."userId") FILTER (WHERE date_trunc('month', fo.first_at) = date_trunc('month', o."createdAt")) AS newbuyers,
             COUNT(DISTINCT o."userId") FILTER (WHERE date_trunc('month', fo.first_at) < date_trunc('month', o."createdAt")) AS returning
      FROM "Order" o JOIN first_orders fo ON fo."userId" = o."userId"
      WHERE o."paymentStatus" = 'PAID'
      GROUP BY 1 ORDER BY 1`,
  ]);

  const buyers = Number(buyerOrderCounts[0]?.buyers ?? 0);
  const repeat = Number(buyerOrderCounts[0]?.repeat ?? 0);

  const dormantSince = new Date(Date.now() - 60 * 24 * 3600_000);
  const dormant = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM (
      SELECT "userId", MAX("createdAt") AS last_at FROM "Order" WHERE "paymentStatus" = 'PAID' GROUP BY "userId"
    ) t WHERE last_at < ${dormantSince}`;

  return {
    totalBuyers: buyers,
    repeatBuyers: repeat,
    repeatRate: buyers > 0 ? Math.round((repeat / buyers) * 100) : 0,
    dormantBuyers: Number(dormant[0]?.count ?? 0),
    monthly: monthly.map((m) => ({
      month: m.month,
      newBuyers: Number(m.newbuyers),
      returning: Number(m.returning),
    })),
  };
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

export async function getSlaMetrics() {
  const now = new Date();
  const [ticketAgg, oldestOpen, shipmentAgg, latePending] = await Promise.all([
    db.$queryRaw<Array<{ open: bigint; resolved24: bigint; total: bigint }>>`
      SELECT COUNT(*) FILTER (WHERE status IN ('OPEN','IN_PROGRESS')) AS open,
             COUNT(*) FILTER (WHERE status IN ('RESOLVED','CLOSED')
                AND "updatedAt" - "createdAt" <= interval '24 hours') AS resolved24,
             COUNT(*) FILTER (WHERE status IN ('RESOLVED','CLOSED')) AS total
      FROM "SupportTicket"`,
    db.supportTicket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "asc" },
      take: 10,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    db.$queryRaw<Array<{ delivered: bigint; ontime: bigint }>>`
      SELECT COUNT(*) AS delivered,
             COUNT(*) FILTER (WHERE "promisedBy" IS NULL OR "deliveredAt" <= "promisedBy") AS ontime
      FROM "Shipment" WHERE "deliveredAt" IS NOT NULL`,
    db.shipment.findMany({
      where: { deliveredAt: null, promisedBy: { lt: now } },
      include: {
        order: { select: { orderNumber: true } },
        seller: { select: { businessNameEn: true } },
      },
      take: 10,
    }),
  ]);

  const resolvedTotal = Number(ticketAgg[0]?.total ?? 0);
  const delivered = Number(shipmentAgg[0]?.delivered ?? 0);

  return {
    openTickets: Number(ticketAgg[0]?.open ?? 0),
    resolvedWithin24hPct:
      resolvedTotal > 0
        ? Math.round((Number(ticketAgg[0]?.resolved24 ?? 0) / resolvedTotal) * 100)
        : null,
    oldestOpen,
    deliveredShipments: delivered,
    onTimeDeliveryPct:
      delivered > 0 ? Math.round((Number(shipmentAgg[0]?.ontime ?? 0) / delivered) * 100) : null,
    lateShipments: latePending,
  };
}

// ─── SEGMENTS ─────────────────────────────────────────────────────────────────

export async function getCustomerSegments() {
  const since30 = new Date(Date.now() - 30 * 24 * 3600_000);
  const since60 = new Date(Date.now() - 60 * 24 * 3600_000);

  const [byRole, spenders, recentBuyers, dormant] = await Promise.all([
    db.user.groupBy({
      by: ["role"],
      where: {
        deletedAt: null,
        role: { in: ["CONSUMER", "COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"] },
      },
      _count: { _all: true },
    }),
    // Erased subjects are excluded, matching the byRole groupBy directly above
    // — which already filters deletedAt, so without this the two halves of the
    // same page disagreed about who exists. This list is also a campaign
    // audience: an erased subject must never be marketed to.
    db.$queryRaw<
      Array<{
        id: string;
        name: string;
        email: string;
        currency: Currency;
        spent: Prisma.Decimal;
        orders: bigint;
      }>
    >`
      SELECT u.id, u."firstName" || ' ' || u."lastName" AS name, u.email,
             o.currency::text AS currency, COALESCE(SUM(o.total), 0) AS spent, COUNT(o.id) AS orders
      FROM "User" u JOIN "Order" o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
      WHERE u."deletedAt" IS NULL
      GROUP BY u.id, o.currency
      ORDER BY o.currency, spent DESC, u.id`,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "userId") AS count FROM "Order" WHERE "paymentStatus" = 'PAID' AND "createdAt" >= ${since30}`,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM (
        SELECT "userId", MAX("createdAt") AS last_at FROM "Order" WHERE "paymentStatus" = 'PAID' GROUP BY "userId"
      ) t WHERE last_at < ${since60}`,
  ]);

  const allSpenders: CurrencySpender[] = spenders.map((s) => ({
    ...s,
    spent: Number(s.spent),
    orders: Number(s.orders),
  }));
  const uniqueBuyersWithPurchases = new Set(allSpenders.map((spender) => spender.id)).size;

  return {
    byRole: byRole.map((r) => ({ role: r.role, count: r._count._all })),
    highValue: selectHighValueBuyers(allSpenders),
    activeLast30d: Number(recentBuyers[0]?.count ?? 0),
    dormant60d: Number(dormant[0]?.count ?? 0),
    totalWithPurchases: uniqueBuyersWithPurchases,
  };
}
