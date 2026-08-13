import {
  db,
  AuditAction,
  Prisma,
  type PaymentStatus,
  type PayoutStatus,
} from "../index";
import { requireCurrentAdminActor } from "./checkout-invariants";

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

export async function getFinanceOverview() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [
    gmvMonth,
    gmvYear,
    commissionMonth,
    commissionYear,
    pendingPayouts,
    paidPayouts,
    refundsPending,
    vatYear,
    unsettledCommissions,
    refundsCompletedMonth,
    refundsCompletedYear,
    [refundVatYear],
    openSellerReceivables,
  ] = await Promise.all([
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: monthStart } }, _sum: { total: true } }),
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: yearStart } }, _sum: { total: true } }),
    db.commission.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.commission.aggregate({ where: { createdAt: { gte: yearStart } }, _sum: { amount: true } }),
    db.sellerPayout.aggregate({ where: { status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true }, _count: { _all: true } }),
    db.sellerPayout.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
    db.refund.aggregate({ where: { status: { in: ["PENDING", "APPROVED", "PROCESSING"] } }, _sum: { amount: true }, _count: { _all: true } }),
    db.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: yearStart } }, _sum: { vatAmount: true } }),
    db.commission.aggregate({ where: { settledAt: null }, _sum: { amount: true }, _count: { _all: true } }),
    db.refund.aggregate({ where: {
      status: "COMPLETED",
      OR: [{ processedAt: { gte: monthStart } }, { processedAt: null, createdAt: { gte: monthStart } }],
    }, _sum: { amount: true } }),
    db.refund.aggregate({ where: {
      status: "COMPLETED",
      OR: [{ processedAt: { gte: yearStart } }, { processedAt: null, createdAt: { gte: yearStart } }],
    }, _sum: { amount: true } }),
    db.$queryRaw<Array<{ vat: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(r."vatAmount"), 0) AS vat
      FROM "Refund" r
      WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}`,
    db.sellerFinancialAdjustment.aggregate({
      where: { status: "OPEN" }, _sum: { amount: true }, _count: { _all: true },
    }),
  ]);

  // Monthly GMV/commission series for the current year (for charts).
  const monthly = await db.$queryRaw<Array<{ month: Date; gmv: Prisma.Decimal; vat: Prisma.Decimal }>>`
    WITH sales AS (
      SELECT date_trunc('month', o."createdAt") AS month,
             SUM(o.total) AS gmv, SUM(o."vatAmount") AS vat
      FROM "Order" o
      WHERE o."paymentStatus" = 'PAID' AND o."createdAt" >= ${yearStart}
      GROUP BY 1
    ), refunded AS (
      SELECT date_trunc('month', COALESCE(r."processedAt", r."createdAt")) AS month,
             SUM(r.amount) AS gmv, SUM(r."vatAmount") AS vat
      FROM "Refund" r
      WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}
      GROUP BY 1
    )
    SELECT COALESCE(s.month, r.month) AS month,
           COALESCE(s.gmv, 0) - COALESCE(r.gmv, 0) AS gmv,
           COALESCE(s.vat, 0) - COALESCE(r.vat, 0) AS vat
    FROM sales s FULL OUTER JOIN refunded r ON r.month = s.month
    ORDER BY 1`;

  const sellerReceivableAmount = Math.abs(Number(openSellerReceivables._sum.amount ?? 0));
  return {
    gmvMonth: Number(gmvMonth._sum.total ?? 0) - Number(refundsCompletedMonth._sum.amount ?? 0),
    gmvYear: Number(gmvYear._sum.total ?? 0) - Number(refundsCompletedYear._sum.amount ?? 0),
    commissionMonth: Number(commissionMonth._sum.amount ?? 0),
    commissionYear: Number(commissionYear._sum.amount ?? 0),
    pendingPayoutAmount: Number(pendingPayouts._sum.amount ?? 0),
    pendingPayoutCount: pendingPayouts._count._all,
    paidPayoutAmount: Number(paidPayouts._sum.amount ?? 0),
    paidPayoutCount: paidPayouts._count._all,
    refundsPendingAmount: Number(refundsPending._sum.amount ?? 0),
    refundsPendingCount: refundsPending._count._all,
    vatCollectedYear: Number(vatYear._sum.vatAmount ?? 0) - Number(refundVatYear?.vat ?? 0),
    unsettledCommissionAmount: Number(unsettledCommissions._sum.amount ?? 0),
    unsettledCommissionCount: unsettledCommissions._count._all,
    sellerReceivableAmount,
    sellerReceivableCount: openSellerReceivables._count._all,
    netSellerSettlementPosition: Number(pendingPayouts._sum.amount ?? 0) - sellerReceivableAmount,
    monthly: monthly.map((m) => ({ month: m.month, gmv: Number(m.gmv), vat: Number(m.vat) })),
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

export async function getVatSummary() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [byCurrency, monthly, invoiceCount] = await Promise.all([
    db.$queryRaw<Array<{ currency: string; vat: Prisma.Decimal; gross: Prisma.Decimal; orders: bigint }>>`
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
      FROM sales s FULL OUTER JOIN refunded r ON r.currency = s.currency`,
    db.$queryRaw<Array<{ month: Date; vat: Prisma.Decimal; orders: bigint }>>`
      WITH sales AS (
        SELECT date_trunc('month', o."createdAt") AS month,
               SUM(o."vatAmount") AS vat, COUNT(*) AS orders
        FROM "Order" o
        WHERE o."paymentStatus" = 'PAID' AND o."createdAt" >= ${yearStart}
        GROUP BY 1
      ), refunded AS (
        SELECT date_trunc('month', COALESCE(r."processedAt", r."createdAt")) AS month,
               SUM(r."vatAmount") AS vat
        FROM "Refund" r
        WHERE r.status = 'COMPLETED' AND COALESCE(r."processedAt", r."createdAt") >= ${yearStart}
        GROUP BY 1
      )
      SELECT COALESCE(s.month, r.month) AS month,
             COALESCE(s.vat, 0) - COALESCE(r.vat, 0) AS vat,
             COALESCE(s.orders, 0) AS orders
      FROM sales s FULL OUTER JOIN refunded r ON r.month = s.month
      ORDER BY 1`,
    db.taxInvoice.count(),
  ]);

  return {
    byCurrency: byCurrency.map((c) => ({
      currency: c.currency,
      vat: Number(c.vat),
      gross: Number(c.gross),
      orders: Number(c.orders),
    })),
    monthly: monthly.map((m) => ({ month: m.month, vat: Number(m.vat), orders: Number(m.orders) })),
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
