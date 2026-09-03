import { db, Prisma } from "../index";

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

/**
 * Executive KPIs. Every `*Trend` is a month-over-month percentage delta or
 * null when the figure is not measured against a prior period. Null is a
 * statement the view must honour — it is never coerced to 0 or borrowed from
 * a neighbouring metric.
 */
export interface ExecutiveKpis {
  gmvMonth: number;
  gmvTotal: number;
  gmvTrend: number | null;
  ordersTotal: number;
  aov: number;
  b2bRevenue: number;
  b2bTrend: number | null;
  b2cRevenue: number;
  b2cTrend: number | null;
  commission: number;
  commissionTrend: number | null;
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
    db.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { total: true }, _count: { _all: true }, _avg: { total: true } }),
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: monthStart } }, _sum: { total: true } }),
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: prevMonthStart, lt: monthStart } }, _sum: { total: true } }),
    db.order.groupBy({ by: ["type"], where: { paymentStatus: "PAID" }, _sum: { total: true } }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
    db.rFQRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.sellerProfile.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.company.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.sellerProfile.count({ where: { status: "PENDING_REVIEW" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "InventoryStock" WHERE (qty - "reservedQty") <= "reorderPoint"`,
    db.order.count({ where: { paymentStatus: "PAID", status: { in: ["CONFIRMED", "PROCESSING"] } } }),
    db.rFQRequest.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, sellerId: null } }),
    db.$queryRaw<Array<{ name: string; gmv: Prisma.Decimal }>>`
      SELECT c."nameEn" AS name, COALESCE(SUM(oi.total), 0) AS gmv
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId" AND o."paymentStatus" = 'PAID'
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      GROUP BY c."nameEn" ORDER BY gmv DESC LIMIT 5`,
    db.$queryRaw<Array<{ id: string; name: string; tier: string; gmv: Prisma.Decimal; orders: bigint; rating: number | null }>>`
      SELECT sp.id, sp."businessNameEn" AS name, sp.tier::text AS tier,
             COALESCE(SUM(oi.total), 0) AS gmv,
             COUNT(DISTINCT oi."orderId") AS orders,
             (SELECT AVG(pr.rating)::float FROM "ProductReview" pr
                JOIN "Product" pp ON pp.id = pr."productId" WHERE pp."sellerId" = sp.id) AS rating
      FROM "SellerProfile" sp
      JOIN "OrderItem" oi ON oi."sellerId" = sp.id
      JOIN "Order" o ON o.id = oi."orderId" AND o."paymentStatus" = 'PAID'
      GROUP BY sp.id ORDER BY gmv DESC LIMIT 5`,
    // Erasure (services/data-rights.ts) anonymises the identity in place and
    // sets deletedAt: the orders are retained because they must be, but the
    // person is gone and must stop being named in reports. Without the guard
    // this report renders "Erased User" and their tombstone address next to a
    // spend figure — the same guard the consumerCount above already applies.
    db.$queryRaw<Array<{ id: string; name: string; type: string; totalorders: bigint; totalspent: Prisma.Decimal }>>`
      SELECT u.id, u."firstName" || ' ' || u."lastName" AS name,
             CASE WHEN u.role = 'CONSUMER' THEN 'B2C' ELSE 'B2B' END AS type,
             COUNT(o.id) AS totalorders, COALESCE(SUM(o.total), 0) AS totalspent
      FROM "User" u JOIN "Order" o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
      WHERE u."deletedAt" IS NULL
      GROUP BY u.id ORDER BY totalspent DESC LIMIT 5`,
    db.commission.aggregate({ _sum: { amount: true } }),
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
    db.order.groupBy({ by: ["type"], where: { paymentStatus: "PAID", createdAt: { gte: monthStart } }, _sum: { total: true } }),
    db.order.groupBy({ by: ["type"], where: { paymentStatus: "PAID", createdAt: { gte: prevMonthStart, lt: monthStart } }, _sum: { total: true } }),
    // Commission rows carry their own createdAt, so the same comparison holds.
    db.commission.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.commission.aggregate({ where: { createdAt: { gte: prevMonthStart, lt: monthStart } }, _sum: { amount: true } }),
  ]);

  const gmvTotal = Number(paidAgg._sum.total ?? 0);
  const typeTotal = (rows: typeof typeSplit, type: "B2B" | "B2C") =>
    Number(rows.find((t) => t.type === type)?._sum.total ?? 0);
  const b2b = typeTotal(typeSplit, "B2B");
  const b2c = typeTotal(typeSplit, "B2C");

  const statusCount = (statuses: string[]) =>
    statusCounts.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s._count._all, 0);
  const rfqCount = (statuses: string[]) =>
    rfqCounts.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s._count._all, 0);

  const lowStockCount = Number(lowStock[0]?.count ?? 0);
  const gmvMonth = Number(monthAgg._sum.total ?? 0);
  const gmvPrevMonth = Number(prevMonthAgg._sum.total ?? 0);
  const gmvTrend = monthOverMonth(gmvMonth, gmvPrevMonth);
  const b2bTrend = monthOverMonth(typeTotal(monthTypeSplit, "B2B"), typeTotal(prevMonthTypeSplit, "B2B"));
  const b2cTrend = monthOverMonth(typeTotal(monthTypeSplit, "B2C"), typeTotal(prevMonthTypeSplit, "B2C"));
  const commissionTrend = monthOverMonth(
    Number(monthCommissionAgg._sum.amount ?? 0),
    Number(prevMonthCommissionAgg._sum.amount ?? 0),
  );

  const totalRfqs = rfqCounts.reduce((s, c) => s + c._count._all, 0);
  const rfqConversion = totalRfqs > 0 ? Math.round((rfqCount(["ACCEPTED"]) / totalRfqs) * 100) : 0;
  const fulfillmentRate =
    paidAgg._count._all > 0
      ? Math.round((statusCount(["DELIVERED"]) / paidAgg._count._all) * 100)
      : 0;
  const totalUnits = stockAgg._sum.qty ?? 0;
  const warehouseUtilization =
    totalUnits > 0 ? Math.round(((stockAgg._sum.reservedQty ?? 0) / totalUnits) * 100) : 0;

  // Rule-based operational recommendations from live signals (no ML claims).
  const recommendations: Array<{
    icon: string; iconStyle: string; title: string; description: string;
    confidence: number; tag: string; tagStyle: string; actionLabel: string; actionHref: string;
  }> = [];
  if (pendingSellers > 0) {
    recommendations.push({
      icon: "ShoppingCart", iconStyle: "bg-amber-500/15 text-amber-600",
      title: `${pendingSellers} seller application${pendingSellers === 1 ? "" : "s"} awaiting review`,
      description: "New suppliers cannot list products until approved. Review the onboarding queue.",
      confidence: 100, tag: "Onboarding", tagStyle: "bg-amber-500/15 text-amber-600",
      actionLabel: "Review sellers", actionHref: "/sellers/pending",
    });
  }
  if (unshippedPaid > 0) {
    recommendations.push({
      icon: "Truck", iconStyle: "bg-blue-500/15 text-primary",
      title: `${unshippedPaid} paid order${unshippedPaid === 1 ? "" : "s"} not yet fulfilled`,
      description: "Orders are paid and waiting in the pick & pack queue. Aging orders hurt delivery SLAs.",
      confidence: 100, tag: "Fulfilment", tagStyle: "bg-blue-500/15 text-primary",
      actionLabel: "Open queue", actionHref: "/warehouse/pickpack",
    });
  }
  if (lowStockCount > 0) {
    recommendations.push({
      icon: "Boxes", iconStyle: "bg-red-500/15 text-red-600",
      title: `${lowStockCount} stock line${lowStockCount === 1 ? "" : "s"} at or below reorder point`,
      description: "Low availability risks oversells and lost sales. Ask sellers to restock.",
      confidence: 100, tag: "Inventory", tagStyle: "bg-red-500/15 text-red-600",
      actionLabel: "View stock", actionHref: "/warehouse/stock?filter=low",
    });
  }
  if (openRFQs > 0) {
    recommendations.push({
      icon: "FileQuestion", iconStyle: "bg-purple-500/15 text-purple-600",
      title: `${openRFQs} open RFQ${openRFQs === 1 ? "" : "s"} without an assigned seller`,
      description: "Unassigned RFQs stall B2B pipeline. Route them to matching suppliers.",
      confidence: 100, tag: "B2B Pipeline", tagStyle: "bg-purple-500/15 text-purple-600",
      actionLabel: "View RFQs", actionHref: "/rfqs",
    });
  }

  // Keys match the DashboardView contract. GMV, B2B, B2C and commission are
  // measured this month against the previous month (null when the previous
  // month is empty). The remaining figures are point-in-time counts and
  // ratios with no prior-period query behind them, so their trend is null —
  // not 0, which would read as "measured and flat".
  const kpis: ExecutiveKpis = {
    gmvMonth,
    gmvTotal,
    gmvTrend,
    ordersTotal: paidAgg._count._all,
    aov: Number(paidAgg._avg.total ?? 0),
    b2bRevenue: b2b,
    b2bTrend,
    b2cRevenue: b2c,
    b2cTrend,
    commission: Number(commissionAgg._sum.amount ?? 0),
    commissionTrend,
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
      // Absolute amounts — the view formats them as currency and derives %.
      revenueSplit: { b2b, b2c },
      rfqFunnel: [
        { stage: "Submitted", count: rfqCount(["SUBMITTED"]), color: "bg-blue-500" },
        { stage: "Under review", count: rfqCount(["UNDER_REVIEW"]), color: "bg-purple-500" },
        { stage: "Quoted", count: rfqCount(["QUOTED", "NEGOTIATING"]), color: "bg-amber-500" },
        { stage: "Accepted", count: rfqCount(["ACCEPTED"]), color: "bg-green-500" },
      ],
      orderLifecycle: [
        { stage: "Awaiting payment", count: statusCount(["PENDING_PAYMENT"]), color: "bg-slate-400" },
        { stage: "Confirmed", count: statusCount(["CONFIRMED"]), color: "bg-blue-500" },
        { stage: "Processing", count: statusCount(["PROCESSING"]), color: "bg-amber-500" },
        { stage: "Shipped", count: statusCount(["SHIPPED", "OUT_FOR_DELIVERY"]), color: "bg-purple-500" },
        { stage: "Delivered", count: statusCount(["DELIVERED", "COMPLETED"]), color: "bg-green-500" },
      ],
      topCategories: categoryGmv.map((c) => ({
        name: c.name,
        gmv: Number(c.gmv),
        share: gmvTotal > 0 ? Math.round((Number(c.gmv) / gmvTotal) * 100) : 0,
      })),
      topSuppliers: sellerGmv.map((s) => ({
        name: s.name,
        gmv: Number(s.gmv),
        orders: Number(s.orders),
        rating: s.rating ? Math.round(s.rating * 10) / 10 : 0,
        tier: s.tier,
      })),
      aiRecommendations: recommendations,
      operationalHealth: [
        { label: "Pending seller reviews", value: pendingSellers, severity: pendingSellers > 0 ? "warn" : "ok", href: "/sellers/pending" },
        { label: "Open support tickets", value: openTickets, severity: openTickets > 5 ? "warn" : "ok", href: "/support" },
        { label: "Low stock lines", value: lowStockCount, severity: lowStockCount > 0 ? "warn" : "ok", href: "/warehouse/stock?filter=low" },
        { label: "Unfulfilled paid orders", value: unshippedPaid, severity: unshippedPaid > 3 ? "warn" : "ok", href: "/warehouse/pickpack" },
      ],
    },
    topCustomers: topCustomerRows.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      totalOrders: Number(c.totalorders),
      totalSpent: Number(c.totalspent),
    })),
  };
}

// ─── SUPPLIER PERFORMANCE ─────────────────────────────────────────────────────

export async function getSupplierPerformance() {
  const rows = await db.$queryRaw<Array<{
    id: string;
    name: string;
    tier: string;
    gmv: Prisma.Decimal;
    orders: bigint;
    returns: bigint;
    shipments: bigint;
    ontime: bigint;
    health: number | null;
    rating: number | null;
  }>>`
    SELECT sp.id, sp."businessNameEn" AS name, sp.tier::text AS tier,
      COALESCE((SELECT SUM(oi.total) FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
                WHERE oi."sellerId" = sp.id AND o."paymentStatus" = 'PAID'), 0) AS gmv,
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
    FROM "SellerProfile" sp
    WHERE sp.status = 'ACTIVE' AND sp."deletedAt" IS NULL
    ORDER BY gmv DESC`;

  return rows.map((r) => {
    const orders = Number(r.orders);
    const shipments = Number(r.shipments);
    const onTimePct = shipments > 0 ? Math.round((Number(r.ontime) / shipments) * 100) : null;
    const returnRate = orders > 0 ? Math.round((Number(r.returns) / orders) * 1000) / 10 : 0;
    const health = r.health ? Math.round(r.health) : null;
    // Composite score: listing health (40%), on-time (30%), rating (20%), low returns (10%).
    const parts: number[] = [];
    if (health !== null) parts.push(health * 0.4);
    if (onTimePct !== null) parts.push(onTimePct * 0.3);
    if (r.rating) parts.push((r.rating / 5) * 100 * 0.2);
    parts.push(Math.max(0, 100 - returnRate * 10) * 0.1);
    const denominator =
      (health !== null ? 0.4 : 0) + (onTimePct !== null ? 0.3 : 0) + (r.rating ? 0.2 : 0) + 0.1;
    const score = Math.round(parts.reduce((s, p) => s + p, 0) / (denominator || 1));

    return {
      id: r.id,
      name: r.name,
      tier: r.tier,
      gmv: Number(r.gmv),
      orders,
      onTimePct,
      returnRate,
      health,
      rating: r.rating ? Math.round(r.rating * 10) / 10 : null,
      score,
    };
  });
}

// ─── CRM ──────────────────────────────────────────────────────────────────────

export async function getCrmOverview() {
  const [rawRelationships, activities, topBuyers] = await Promise.all([
    db.sellerCustomer.findMany({
      orderBy: { totalSpent: "desc" },
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
    db.$queryRaw<Array<{ id: string; name: string; email: string; role: string; orders: bigint; spent: Prisma.Decimal; lastorder: Date | null }>>`
      SELECT u.id, u."firstName" || ' ' || u."lastName" AS name, u.email, u.role::text AS role,
             COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent, MAX(o."createdAt") AS lastorder
      FROM "User" u JOIN "Order" o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
      WHERE u."deletedAt" IS NULL
      GROUP BY u.id ORDER BY spent DESC LIMIT 10`,
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
      ...b,
      orders: Number(b.orders),
      spent: Number(b.spent),
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
      include: { order: { select: { orderNumber: true } }, seller: { select: { businessNameEn: true } } },
      take: 10,
    }),
  ]);

  const resolvedTotal = Number(ticketAgg[0]?.total ?? 0);
  const delivered = Number(shipmentAgg[0]?.delivered ?? 0);

  return {
    openTickets: Number(ticketAgg[0]?.open ?? 0),
    resolvedWithin24hPct:
      resolvedTotal > 0 ? Math.round((Number(ticketAgg[0]?.resolved24 ?? 0) / resolvedTotal) * 100) : null,
    oldestOpen,
    deliveredShipments: delivered,
    onTimeDeliveryPct: delivered > 0 ? Math.round((Number(shipmentAgg[0]?.ontime ?? 0) / delivered) * 100) : null,
    lateShipments: latePending,
  };
}

// ─── SEGMENTS ─────────────────────────────────────────────────────────────────

export async function getCustomerSegments() {
  const since30 = new Date(Date.now() - 30 * 24 * 3600_000);
  const since60 = new Date(Date.now() - 60 * 24 * 3600_000);

  const [byRole, spenders, recentBuyers, dormant] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { deletedAt: null, role: { in: ["CONSUMER", "COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"] } }, _count: { _all: true } }),
    // Erased subjects are excluded, matching the byRole groupBy directly above
    // — which already filters deletedAt, so without this the two halves of the
    // same page disagreed about who exists. This list is also a campaign
    // audience: an erased subject must never be marketed to.
    db.$queryRaw<Array<{ id: string; name: string; email: string; spent: Prisma.Decimal; orders: bigint }>>`
      SELECT u.id, u."firstName" || ' ' || u."lastName" AS name, u.email,
             COALESCE(SUM(o.total), 0) AS spent, COUNT(o.id) AS orders
      FROM "User" u JOIN "Order" o ON o."userId" = u.id AND o."paymentStatus" = 'PAID'
      WHERE u."deletedAt" IS NULL
      GROUP BY u.id ORDER BY spent DESC`,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "userId") AS count FROM "Order" WHERE "paymentStatus" = 'PAID' AND "createdAt" >= ${since30}`,
    db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM (
        SELECT "userId", MAX("createdAt") AS last_at FROM "Order" WHERE "paymentStatus" = 'PAID' GROUP BY "userId"
      ) t WHERE last_at < ${since60}`,
  ]);

  const allSpenders = spenders.map((s) => ({ ...s, spent: Number(s.spent), orders: Number(s.orders) }));
  const highValueCutoff = allSpenders.length > 0 ? Math.max(1, Math.ceil(allSpenders.length * 0.2)) : 0;

  return {
    byRole: byRole.map((r) => ({ role: r.role, count: r._count._all })),
    highValue: allSpenders.slice(0, highValueCutoff),
    activeLast30d: Number(recentBuyers[0]?.count ?? 0),
    dormant60d: Number(dormant[0]?.count ?? 0),
    totalWithPurchases: allSpenders.length,
  };
}
