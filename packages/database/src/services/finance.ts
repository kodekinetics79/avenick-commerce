import {
  db,
  AuditAction,
  Prisma,
  type Currency,
  type PaymentStatus,
  type PayoutStatus,
} from "../index";
import { requireCurrentAdminActor } from "./checkout-invariants";

const ZERO = new Prisma.Decimal(0);

/**
 * One money figure, and the rows behind it, for exactly one currency.
 *
 * Every total this module returns is shaped like this because the platform
 * holds no FX rate table: AED, SAR and KWD amounts cannot be added, so a
 * blended headline would be a number that is true of nothing. Callers render
 * the rows side by side — they must never reduce them to a single sum.
 */
export interface FinanceCurrencyTotal {
  currency: Currency;
  amount: Prisma.Decimal;
  /** Records behind `amount`; what a record is depends on the field it came from. */
  count: number;
}

/** Fold rows into one entry per currency, ordered by currency code. */
function foldByCurrency(
  rows: Array<{ currency: Currency; amount?: Prisma.Decimal | null; count?: number }>,
): FinanceCurrencyTotal[] {
  const totals = new Map<Currency, FinanceCurrencyTotal>();
  for (const row of rows) {
    const current = totals.get(row.currency);
    totals.set(row.currency, {
      currency: row.currency,
      amount: (current?.amount ?? ZERO).add(row.amount ?? ZERO),
      count: (current?.count ?? 0) + (row.count ?? 0),
    });
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** The same rows with the sign flipped: refunds and clawbacks subtract. */
const negated = (rows: Array<{ currency: Currency; amount: Prisma.Decimal }>) =>
  rows.map((row) => ({ currency: row.currency, amount: row.amount.neg() }));

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

/**
 * Everything the finance dashboard renders, per currency throughout.
 *
 * Previously every figure here was a single cross-currency `SUM` handed to the
 * page and labelled AED. With no FX rate table in the repository those sums
 * added dirhams to riyals; each one is now grouped by the currency the money
 * was actually denominated in.
 */
export async function getFinanceOverview() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    ordersMonth,
    ordersYear,
    commissionsMonth,
    commissionsYear,
    payoutTotals,
    refundsPendingRows,
    unsettledCommissionRows,
    refundsCompletedRows,
    openSellerReceivables,
    monthlyRows,
  ] = await Promise.all([
    db.order.groupBy({
      by: ["currency"],
      where: { paymentStatus: "PAID", createdAt: { gte: monthStart } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // Year-to-date GMV and output VAT come off the same grouped scan.
    db.order.groupBy({
      by: ["currency"],
      where: { paymentStatus: "PAID", createdAt: { gte: yearStart } },
      _sum: { total: true, vatAmount: true },
      _count: { _all: true },
    }),
    db.commission.groupBy({
      by: ["currency"],
      where: { createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.commission.groupBy({
      by: ["currency"],
      where: { createdAt: { gte: yearStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Pending and paid payouts differ only by status, so one grouped pass by
    // (status, currency) serves both tiles.
    db.sellerPayout.groupBy({
      by: ["status", "currency"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Refund carries no currency column of its own — it is denominated in its
    // order's currency — so every refund figure below joins Order to learn it.
    db.$queryRaw<Array<{ currency: Currency; amount: Prisma.Decimal; refunds: bigint }>>`
      SELECT o.currency::text AS currency,
             COALESCE(SUM(r.amount), 0) AS amount,
             COUNT(*) AS refunds
      FROM "Refund" r JOIN "Order" o ON o.id = r."orderId"
      WHERE r.status IN ('PENDING', 'APPROVED', 'PROCESSING')
      GROUP BY 1`,
    db.commission.groupBy({
      by: ["currency"],
      where: { settledAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.$queryRaw<Array<{ currency: Currency; month: Prisma.Decimal; year: Prisma.Decimal; vatYear: Prisma.Decimal }>>`
      SELECT o.currency::text AS currency,
             COALESCE(SUM(r.amount) FILTER (
               WHERE COALESCE(r."processedAt", r."createdAt") >= ${monthStart}), 0) AS month,
             COALESCE(SUM(r.amount), 0) AS year,
             COALESCE(SUM(r."vatAmount"), 0) AS "vatYear"
      FROM "Refund" r JOIN "Order" o ON o.id = r."orderId"
      WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}
      GROUP BY 1`,
    db.sellerFinancialAdjustment.groupBy({
      by: ["currency"],
      where: { status: "OPEN" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Monthly GMV/VAT series for the chart. The refund leg joins Order for the
    // same reason, and the outer join matches on (currency, month): joining on
    // month alone would have netted a SAR refund off AED sales.
    db.$queryRaw<Array<{ currency: Currency; month: Date; gmv: Prisma.Decimal; vat: Prisma.Decimal }>>`
      WITH sales AS (
        SELECT o.currency::text AS currency, date_trunc('month', o."createdAt") AS month,
               SUM(o.total) AS gmv, SUM(o."vatAmount") AS vat
        FROM "Order" o
        WHERE o."paymentStatus" = 'PAID' AND o."createdAt" >= ${yearStart}
        GROUP BY 1, 2
      ), refunded AS (
        SELECT o.currency::text AS currency,
               date_trunc('month', COALESCE(r."processedAt", r."createdAt")) AS month,
               SUM(r.amount) AS gmv, SUM(r."vatAmount") AS vat
        FROM "Refund" r JOIN "Order" o ON o.id = r."orderId"
        WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}
        GROUP BY 1, 2
      )
      SELECT COALESCE(s.currency, r.currency) AS currency,
             COALESCE(s.month, r.month) AS month,
             COALESCE(s.gmv, 0) - COALESCE(r.gmv, 0) AS gmv,
             COALESCE(s.vat, 0) - COALESCE(r.vat, 0) AS vat
      FROM sales s FULL OUTER JOIN refunded r ON r.currency = s.currency AND r.month = s.month
      ORDER BY 1, 2`,
  ]);

  const refundsMonth = refundsCompletedRows.map((r) => ({ currency: r.currency, amount: r.month }));
  const refundsYear = refundsCompletedRows.map((r) => ({ currency: r.currency, amount: r.year }));
  const refundVatYear = refundsCompletedRows.map((r) => ({ currency: r.currency, amount: r.vatYear }));

  // GMV and output VAT are net of completed refunds. `count` stays the paid
  // order count: a refund is not an order, so it contributes value, not a row.
  const gmvMonth = foldByCurrency([
    ...ordersMonth.map((o) => ({ currency: o.currency, amount: o._sum.total, count: o._count._all })),
    ...negated(refundsMonth),
  ]);
  const gmvYear = foldByCurrency([
    ...ordersYear.map((o) => ({ currency: o.currency, amount: o._sum.total, count: o._count._all })),
    ...negated(refundsYear),
  ]);
  const vatCollectedYear = foldByCurrency([
    ...ordersYear.map((o) => ({ currency: o.currency, amount: o._sum.vatAmount, count: o._count._all })),
    ...negated(refundVatYear),
  ]);

  const pendingPayouts = foldByCurrency(
    payoutTotals
      .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
      .map((p) => ({ currency: p.currency, amount: p._sum.amount, count: p._count._all })),
  );
  const paidPayouts = foldByCurrency(
    payoutTotals
      .filter((p) => p.status === "PAID")
      .map((p) => ({ currency: p.currency, amount: p._sum.amount, count: p._count._all })),
  );

  // Open adjustments are stored negative (value owed back by the seller); the
  // board reads them as a positive receivable, still per currency.
  const sellerReceivables = foldByCurrency(
    openSellerReceivables.map((a) => ({
      currency: a.currency,
      amount: (a._sum.amount ?? ZERO).abs(),
      count: a._count._all,
    })),
  );

  return {
    /** Paid GMV net of completed refunds, this calendar month, per currency. */
    gmvMonth,
    /** Paid GMV net of completed refunds, year to date, per currency. */
    gmvYear,
    commissionMonth: foldByCurrency(
      commissionsMonth.map((c) => ({ currency: c.currency, amount: c._sum.amount, count: c._count._all })),
    ),
    commissionYear: foldByCurrency(
      commissionsYear.map((c) => ({ currency: c.currency, amount: c._sum.amount, count: c._count._all })),
    ),
    pendingPayouts,
    paidPayouts,
    refundsPending: foldByCurrency(
      refundsPendingRows.map((r) => ({ currency: r.currency, amount: r.amount, count: Number(r.refunds) })),
    ),
    /** Output VAT on paid orders less VAT on completed refunds, YTD, per currency. */
    vatCollectedYear,
    unsettledCommissions: foldByCurrency(
      unsettledCommissionRows.map((c) => ({ currency: c.currency, amount: c._sum.amount, count: c._count._all })),
    ),
    sellerReceivables,
    /**
     * Payable less receivable, within each currency. A currency present on one
     * side and not the other simply appears with its own figure; the two are
     * never offset against each other across currencies.
     */
    netSellerSettlement: foldByCurrency([
      ...pendingPayouts.map((p) => ({ currency: p.currency, amount: p.amount })),
      ...negated(sellerReceivables.map((r) => ({ currency: r.currency, amount: r.amount }))),
    ]),
    /** One row per (currency, month); the chart draws a series per currency. */
    monthly: monthlyRows.map((m) => ({ currency: m.currency, month: m.month, gmv: m.gmv, vat: m.vat })),
  };
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export interface PaymentFilters {
  page: number;
  limit: number;
  status?: PaymentStatus;
  search?: string;
}

export async function getPayments(filters: PaymentFilters) {
  const where: Prisma.PaymentWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { gatewayRef: { contains: filters.search, mode: "insensitive" } },
            { order: { orderNumber: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [payments, total, statusCounts] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            type: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
    db.payment.count({ where }),
    db.payment.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
  ]);

  return { payments, total, statusCounts };
}

// ─── PAYOUTS / SETTLEMENTS ────────────────────────────────────────────────────

export interface PayoutFilters {
  page: number;
  limit: number;
  status?: PayoutStatus;
}

/**
 * WARNING — not currency-safe. `SellerPayout.amount` and
 * `SellerFinancialAdjustment.amount` each carry their own `currency`, and this
 * function sums and subtracts across all of them as floats, so
 * `netSettlementPosition` is meaningless for a seller trading in more than one
 * currency (the platform holds no FX rates). It is currently rendered on no
 * page; its shape is asserted by
 * `__tests__/finance-refund-settlement-concurrency.pg.integration.test.ts`.
 * Group by `currency` — as `getFinanceOverview` now does — before wiring it to
 * any view or credit decision.
 */
export async function getSellerFinancialPosition(sellerId: string) {
  const [payable, receivable] = await Promise.all([
    db.sellerPayout.aggregate({
      where: { sellerId, status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: { _all: true },
    }),
    db.sellerFinancialAdjustment.aggregate({
      where: { sellerId, status: "OPEN" }, _sum: { amount: true }, _count: { _all: true },
    }),
  ]);
  const payableAmount = Number(payable._sum.amount ?? 0);
  const receivableAmount = Math.abs(Number(receivable._sum.amount ?? 0));
  return {
    payableAmount,
    payableCount: payable._count._all,
    receivableAmount,
    receivableCount: receivable._count._all,
    netSettlementPosition: payableAmount - receivableAmount,
  };
}

export async function getPayouts(filters: PayoutFilters) {
  const where: Prisma.SellerPayoutWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [payouts, total, statusCounts] = await Promise.all([
    db.sellerPayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        seller: { select: { id: true, businessNameEn: true } },
        _count: { select: { items: true } },
      },
    }),
    db.sellerPayout.count({ where }),
    db.sellerPayout.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
  ]);

  return { payouts, total, statusCounts };
}

/** Advance a payout through its lifecycle with an audit entry. */
export async function setPayoutStatus(opts: {
  payoutId: string;
  status: PayoutStatus;
  actorId: string;
  reference?: string;
}) {
  if (!opts.actorId.trim()) throw new Error("Payout transition requires an actor");
  const reference = opts.reference?.trim();
  if (opts.status === "PAID" && !reference) throw new Error("Paid payouts require a settlement reference");
  const allowed: Record<PayoutStatus, PayoutStatus[]> = {
    PENDING: ["PROCESSING", "PAID", "FAILED"],
    PROCESSING: ["PAID", "FAILED"],
    FAILED: ["PROCESSING"],
    PAID: [],
  };
  return db.$transaction(async (tx) => {
    await requireCurrentAdminActor(tx, opts.actorId);
    const target = await tx.sellerPayout.findUnique({
      where: { id: opts.payoutId }, select: { id: true, status: true, sellerId: true },
    });
    if (!target) throw new Error("Payout not found");
    // Refund completion takes this same seller-wide lock. Whichever operation
    // wins decides whether value is removed from an unpaid payout or becomes a
    // durable post-settlement receivable.
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-finance:${target.sellerId}`}))`);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-payout:${opts.payoutId}`}))`);
    const current = await tx.sellerPayout.findUniqueOrThrow({
      where: { id: target.id }, select: { id: true, status: true, sellerId: true },
    });
    if (current.status === opts.status) return tx.sellerPayout.findUniqueOrThrow({ where: { id: current.id } });
    if (!allowed[current.status].includes(opts.status)) {
      throw new Error(`Cannot move a ${current.status.toLowerCase()} payout to ${opts.status.toLowerCase()}`);
    }
    const processedAt = opts.status === "PAID" ? new Date() : undefined;
    const payout = await tx.sellerPayout.update({
      where: { id: target.id },
      data: { status: opts.status, ...(reference ? { reference } : {}), ...(processedAt ? { processedAt } : {}) },
    });
    await tx.auditLog.create({ data: {
      actorId: opts.actorId, sellerId: target.sellerId, entityType: "SellerPayout", entityId: target.id,
      action: AuditAction.STATUS_CHANGE, before: { status: current.status },
      after: { status: opts.status, ...(reference ? { reference } : {}), ...(processedAt ? { processedAt } : {}) },
    } });
    if (opts.status === "PAID") await tx.commission.updateMany({
      where: { sellerId: target.sellerId, settledAt: null, order: { payoutItems: { some: { payoutId: target.id } } } },
      data: { settledAt: processedAt },
    });
    return payout;
  });
}

// ─── COMMISSIONS ──────────────────────────────────────────────────────────────

export async function getCommissions(filters: { page: number; limit: number; settled?: boolean }) {
  const where: Prisma.CommissionWhereInput = {
    ...(filters.settled === true ? { settledAt: { not: null } } : {}),
    ...(filters.settled === false ? { settledAt: null } : {}),
  };

  const [commissions, total] = await Promise.all([
    db.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        seller: { select: { businessNameEn: true } },
        order: { select: { orderNumber: true, total: true, currency: true } },
      },
    }),
    db.commission.count({ where }),
  ]);

  return { commissions, total };
}

// ─── VAT / TAX INVOICES ───────────────────────────────────────────────────────

/** A VAT figure for one currency. Never combine two of these. */
export interface VatCurrencyRow {
  currency: Currency;
  vat: Prisma.Decimal;
  gross: Prisma.Decimal;
  orders: number;
}

/** A VAT figure for one currency in one month. */
export interface VatMonthRow {
  month: Date;
  currency: Currency;
  vat: Prisma.Decimal;
  orders: number;
}

/**
 * Output VAT year to date, per currency and per (currency, month).
 *
 * VAT rates differ by jurisdiction — 5% in the UAE, 15% in KSA — and the
 * repository has no FX rate table, so a total across currencies would be both
 * unconvertible and a blend of two different tax regimes. Nothing here is
 * summed across currencies, and callers must not do it either.
 *
 * Note that `currency` is the currency the order was denominated in, which is
 * a proxy for the filing jurisdiction rather than the jurisdiction itself. The
 * order does carry a destination country — checkout validates
 * `Order.shippingAddress.country` against the `Country` enum — but there is no
 * tax place-of-supply field and nothing here is grouped by that country, so a
 * return filed off these rows must have its jurisdiction confirmed per order.
 */
export async function getVatSummary() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [byCurrency, monthly, invoiceCount] = await Promise.all([
    db.$queryRaw<Array<{ currency: Currency; vat: Prisma.Decimal; gross: Prisma.Decimal; orders: bigint }>>`
      WITH sales AS (
        SELECT o.currency, SUM(o."vatAmount") AS vat, SUM(o.total) AS gross, COUNT(*) AS orders
        FROM "Order" o
        WHERE o."paymentStatus" = 'PAID' AND o."createdAt" >= ${yearStart}
        GROUP BY o.currency
      ), refunded AS (
        SELECT o.currency, SUM(r."vatAmount") AS vat, SUM(r.amount) AS gross
        FROM "Refund" r JOIN "Order" o ON o.id = r."orderId"
        WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}
        GROUP BY o.currency
      )
      SELECT COALESCE(s.currency, r.currency)::text AS currency,
             COALESCE(s.vat, 0) - COALESCE(r.vat, 0) AS vat,
             COALESCE(s.gross, 0) - COALESCE(r.gross, 0) AS gross,
             COALESCE(s.orders, 0) AS orders
      FROM sales s FULL OUTER JOIN refunded r ON r.currency = s.currency
      ORDER BY 1`,
    // Grouped by currency as well as month. The refund leg joins Order for the
    // currency it has none of; matching on month alone netted a 15% KSA refund
    // off 5% UAE output VAT.
    db.$queryRaw<Array<{ month: Date; currency: Currency; vat: Prisma.Decimal; orders: bigint }>>`
      WITH sales AS (
        SELECT date_trunc('month', o."createdAt") AS month, o.currency::text AS currency,
               SUM(o."vatAmount") AS vat, COUNT(*) AS orders
        FROM "Order" o
        WHERE o."paymentStatus" = 'PAID' AND o."createdAt" >= ${yearStart}
        GROUP BY 1, 2
      ), refunded AS (
        SELECT date_trunc('month', COALESCE(r."processedAt", r."createdAt")) AS month,
               o.currency::text AS currency, SUM(r."vatAmount") AS vat
        FROM "Refund" r JOIN "Order" o ON o.id = r."orderId"
        WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}
        GROUP BY 1, 2
      )
      SELECT COALESCE(s.month, r.month) AS month,
             COALESCE(s.currency, r.currency) AS currency,
             COALESCE(s.vat, 0) - COALESCE(r.vat, 0) AS vat,
             COALESCE(s.orders, 0) AS orders
      FROM sales s FULL OUTER JOIN refunded r ON r.month = s.month AND r.currency = s.currency
      ORDER BY 1, 2`,
    db.taxInvoice.count(),
  ]);

  const rows: VatCurrencyRow[] = byCurrency.map((c) => ({
    currency: c.currency,
    vat: c.vat,
    gross: c.gross,
    orders: Number(c.orders),
  }));
  const months: VatMonthRow[] = monthly.map((m) => ({
    month: m.month,
    currency: m.currency,
    vat: m.vat,
    orders: Number(m.orders),
  }));

  return {
    byCurrency: rows,
    monthly: months,
    /** Distinct currencies with VAT activity — a count, safe to total. */
    currencyCount: new Set(rows.map((r) => r.currency)).size,
    /** Taxable order count YTD. A count of rows, not money, so it may be summed. */
    taxableOrders: rows.reduce((sum, r) => sum + r.orders, 0),
    invoiceCount,
  };
}

export async function getTaxInvoices(filters: { page: number; limit: number; search?: string }) {
  const where: Prisma.TaxInvoiceWhereInput = filters.search
    ? {
        OR: [
          { invoiceNo: { contains: filters.search, mode: "insensitive" } },
          { order: { orderNumber: { contains: filters.search, mode: "insensitive" } } },
        ],
      }
    : {};

  const [invoices, total] = await Promise.all([
    db.taxInvoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        order: {
          select: {
            orderNumber: true,
            type: true,
            user: { select: { firstName: true, lastName: true } },
            company: { select: { nameEn: true, vatNumber: true } },
          },
        },
      },
    }),
    db.taxInvoice.count({ where }),
  ]);

  return { invoices, total };
}
