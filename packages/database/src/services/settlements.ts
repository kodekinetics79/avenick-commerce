/**
 * Seller settlement: turning accrued commission into a payable SellerPayout.
 *
 * Commission accrues in orders.accrueCommissions() when an order is paid, and is
 * marked settled in finance.setPayoutStatus() when the payout that carries its
 * order reaches PAID. Nothing sat between those two points — no application code
 * created a SellerPayout — so a seller could never be paid, and every completed
 * refund fell through workflow.setReturnStatus()'s payout-netting branch into a
 * permanently OPEN SellerFinancialAdjustment. This module is that middle step.
 */
import { db, AuditAction, Prisma, type Currency, type PayoutStatus } from "../index";
import { requireCurrentAdminActor } from "./checkout-invariants";

const ZERO = new Prisma.Decimal(0);

/**
 * The claim predicate, in Prisma form. `claimableAccrualSql` below is the same
 * rule in SQL for the read side — change one and you must change the other, or
 * the board will advertise accrual that a run will not pick up.
 *
 * An accrual is claimable when:
 *  - it is unsettled. `settledAt` is written in exactly one place —
 *    finance.setPayoutStatus() when a payout reaches PAID — so "unsettled"
 *    means "not yet paid out", which is the definition this module inherits
 *    rather than invents;
 *  - it is a charge, not a refund reversal (`amount > 0`). A reversal is
 *    never a claim of its own: settleSeller() folds it into the line of the
 *    charge it reverses (commission less reversal, gross less the refund)
 *    together with the receivable workflow.setReturnStatus() booked for that
 *    refund, and finance.setPayoutStatus() settles it with the rest of the
 *    order's rows when the payout is paid;
 *  - its order is paid and not cancelled — money that was never collected, or
 *    was collected for an order since cancelled, is not payable; and
 *  - the order has never been claimed into a payout of this seller. The
 *    SellerPayoutItem row IS the claim marker: Commission has no claim column,
 *    and `settledAt` already means *paid*, not *claimed*.
 */
function claimableAccrualWhere(
  sellerId: string,
  periodFrom: Date,
  periodTo: Date,
): Prisma.CommissionWhereInput {
  return {
    sellerId,
    settledAt: null,
    amount: { gt: 0 },
    createdAt: { gte: periodFrom, lte: periodTo },
    order: {
      paymentStatus: "PAID",
      status: { not: "CANCELLED" },
      payoutItems: { none: { payout: { sellerId } } },
    },
  };
}

export interface GenerateSellerPayoutsInput {
  /** Inclusive start of the accrual window (Commission.createdAt). */
  periodFrom: Date;
  /** Inclusive end of the accrual window. */
  periodTo: Date;
  /** Platform admin performing the run; re-verified inside every transaction. */
  actorId: string;
  /** Restrict the run to one seller. Omit to settle every seller with claimable accrual. */
  sellerId?: string;
}

export interface GeneratedPayout {
  payoutId: string;
  sellerId: string;
  sellerName: string;
  currency: Currency;
  gross: Prisma.Decimal;
  commission: Prisma.Decimal;
  net: Prisma.Decimal;
  orderCount: number;
  /** OPEN refund receivables on the claimed orders that this payout absorbed. */
  adjustmentsApplied: number;
}

export interface SettlementFailure {
  sellerId: string;
  sellerName: string;
  reason: string;
}

export interface GenerateSellerPayoutsResult {
  periodFrom: Date;
  periodTo: Date;
  payouts: GeneratedPayout[];
  /** Sellers examined under their settlement fence. */
  sellersConsidered: number;
  /** Sellers whose accrual was already claimed by an earlier run — an idempotent replay. */
  sellersAlreadyClaimed: number;
  /** Sellers skipped because the profile is missing or soft-deleted; their accrual stays unclaimed. */
  sellersHeld: number;
  /** Sellers whose claimable orders net to nothing payable (fully refunded); nothing was created. */
  sellersNothingPayable: number;
  /**
   * Sellers whose ledger refused to settle (a negative line, a currency
   * mismatch, refunds that do not reconcile with their receivables). Their
   * transaction rolled back and the run moved on; nothing was paid.
   */
  failures: SettlementFailure[];
  /** Accruals inside the window that no run can claim: the order is unpaid or cancelled. */
  heldAccrualCount: number;
}

/**
 * One seller's ledger refuses to settle. Thrown inside the per-seller
 * transaction to roll it back, then caught by the run loop so a single seller
 * with inconsistent rows cannot stop every seller sorted after it. Anything
 * else thrown in the transaction — lost admin authority, a database fault —
 * propagates and aborts the run.
 */
class SettlementHoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementHoldError";
  }
}

type SellerOutcome =
  | { kind: "held" }
  | { kind: "claimed" }
  | { kind: "nothingPayable" }
  | { kind: "created"; created: GeneratedPayout[] };

/** Fixed-scale money for messages and the audit trail; a JSON number would round it. */
const fixed = (value: Prisma.Decimal) => value.toFixed(2);

/**
 * Create one PENDING SellerPayout per (seller, currency) from the commission
 * accrued in a period, with one SellerPayoutItem per order.
 *
 * Idempotent: re-running the same period cannot pay twice. Each seller is
 * settled inside its own transaction behind `seller-finance:<sellerId>` — the
 * same fence finance.setPayoutStatus() and workflow.setReturnStatus() take — and
 * the claim itself is checked, written and re-verified inside that fence.
 *
 * Refunds completed BEFORE an order is claimed are folded into its line here,
 * by the same rule workflow.setReturnStatus() applies when the payout exists
 * first: gross less the refunded amount, commission less its reversal. The
 * OPEN SellerFinancialAdjustment that refund booked (refund − reversal) is
 * exactly the value this fold withholds, so it is marked APPLIED in the same
 * transaction. Without this an order refunded before its settlement run was
 * paid out in full and its receivable stayed open forever.
 */
export async function generateSellerPayouts(
  input: GenerateSellerPayoutsInput,
): Promise<GenerateSellerPayoutsResult> {
  const actorId = input.actorId?.trim();
  if (!actorId) throw new Error("Payout generation requires an actor");
  const { periodFrom, periodTo, sellerId } = input;
  if (!(periodFrom instanceof Date) || Number.isNaN(periodFrom.getTime())
    || !(periodTo instanceof Date) || Number.isNaN(periodTo.getTime())) {
    throw new Error("Payout generation requires a valid settlement period");
  }
  if (periodFrom.getTime() > periodTo.getTime()) {
    throw new Error("Settlement period starts after it ends");
  }
  // A window ending after today would be stored on the payout as a period the
  // platform has not lived through yet; the accrual it could add does not
  // exist. Refuse rather than clamp, so the record means what it says.
  const endOfToday = new Date();
  endOfToday.setUTCHours(23, 59, 59, 999);
  if (periodTo.getTime() > endOfToday.getTime()) {
    throw new Error("Settlement period cannot end after today");
  }

  // Candidate discovery is a plain read; the authoritative decision is retaken
  // per seller under that seller's fence below, so a seller that becomes
  // ineligible between the two is simply skipped there.
  const candidates = await db.commission.groupBy({
    by: ["sellerId"],
    where: {
      settledAt: null,
      amount: { gt: 0 },
      createdAt: { gte: periodFrom, lte: periodTo },
      ...(sellerId ? { sellerId } : {}),
      order: { paymentStatus: "PAID", status: { not: "CANCELLED" } },
    },
    orderBy: { sellerId: "asc" },
  });
  const sellerIds = candidates.map((row) => row.sellerId);

  const payouts: GeneratedPayout[] = [];
  const failures: SettlementFailure[] = [];
  let sellersAlreadyClaimed = 0;
  let sellersHeld = 0;
  let sellersNothingPayable = 0;

  // One transaction per seller. The settlement fence is per seller, so a single
  // transaction over every seller would hold all of their fences at once (and
  // outrun DB_TX_TIMEOUT_MS on a large run). Iterating the sorted seller list
  // keeps lock acquisition deterministic between concurrent runs.
  for (const currentSellerId of sellerIds) {
    let outcome: SellerOutcome;
    try {
      outcome = await db.$transaction((tx) =>
        settleSeller(tx, { sellerId: currentSellerId, actorId, periodFrom, periodTo }),
      );
    } catch (error) {
      if (!(error instanceof SettlementHoldError)) throw error;
      const seller = await db.sellerProfile.findUnique({
        where: { id: currentSellerId },
        select: { businessNameEn: true },
      });
      failures.push({
        sellerId: currentSellerId,
        sellerName: seller?.businessNameEn ?? currentSellerId,
        reason: error.message,
      });
      continue;
    }

    if (outcome.kind === "held") sellersHeld += 1;
    else if (outcome.kind === "claimed") sellersAlreadyClaimed += 1;
    else if (outcome.kind === "nothingPayable") sellersNothingPayable += 1;
    else payouts.push(...outcome.created);
  }

  // Unsettled charges inside the window whose order is unpaid or cancelled: no
  // run will ever claim them. Counted and returned so the operator sees the gap
  // instead of wondering why the accrual and the payouts disagree.
  const heldAccrualCount = await db.commission.count({
    where: {
      settledAt: null,
      amount: { gt: 0 },
      createdAt: { gte: periodFrom, lte: periodTo },
      ...(sellerId ? { sellerId } : {}),
      OR: [{ order: { paymentStatus: { not: "PAID" } } }, { order: { status: "CANCELLED" } }],
    },
  });

  return {
    periodFrom,
    periodTo,
    payouts,
    sellersConsidered: sellerIds.length,
    sellersAlreadyClaimed,
    sellersHeld,
    sellersNothingPayable,
    failures,
    heldAccrualCount,
  };
}

interface OrderLine {
  orderId: string;
  /** Seller's VAT-inclusive merchandise on the order, less refunds already completed against it. */
  amount: Prisma.Decimal;
  /** Commission charged less any reversal already booked for those refunds. */
  commission: Prisma.Decimal;
  net: Prisma.Decimal;
  /** OPEN receivables this line absorbs; marked APPLIED when the payout is written. */
  adjustmentIds: string[];
}

/** Settle one seller inside its own transaction and settlement fence. */
async function settleSeller(
  tx: Prisma.TransactionClient,
  opts: { sellerId: string; actorId: string; periodFrom: Date; periodTo: Date },
): Promise<SellerOutcome> {
  const { sellerId, actorId, periodFrom, periodTo } = opts;
  // Same acquisition order as finance.setPayoutStatus: the actor fence first
  // (requireCurrentAdminActor takes user-commerce), then seller finance. Admin
  // authority is re-proved here, not trusted from the page.
  await requireCurrentAdminActor(tx, actorId);
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-finance:${sellerId}`}))`,
  );

  const seller = await tx.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { id: true, businessNameEn: true, deletedAt: true },
  });
  // A soft-deleted seller has no payable account. Hold the accrual rather
  // than pay it out or silently drop it: the run reports the count.
  if (!seller || seller.deletedAt) return { kind: "held" };

  const claimable = await tx.commission.findMany({
    where: claimableAccrualWhere(seller.id, periodFrom, periodTo),
    select: { orderId: true },
  });
  if (claimable.length === 0) return { kind: "claimed" };
  const claimedOrderIds = [...new Set(claimable.map((row) => row.orderId))].sort();

  // Everything the line needs, per claimed order, read under the fence: every
  // unsettled commission row of this seller on it (charges AND reversals),
  // this seller's merchandise, the refunds already completed against this
  // seller's return requests, and the receivables those refunds booked.
  const orders = await tx.order.findMany({
    where: { id: { in: claimedOrderIds } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      currency: true,
      // Only this seller's lines. Commission was accrued on exactly these
      // lines (ex-VAT), so the payout gross is their VAT-inclusive total — the
      // same basis SellerPayoutItem.amount carries for the refund netting in
      // workflow.setReturnStatus().
      items: { where: { sellerId: seller.id }, select: { total: true } },
      commissions: {
        where: { sellerId: seller.id, settledAt: null },
        select: { id: true, amount: true, currency: true },
      },
      // Refund carries no sellerId; it is scoped through the return request
      // that produced it, which is how workflow.setReturnStatus() created it.
      refunds: {
        where: { status: "COMPLETED", returnRequest: { sellerId: seller.id } },
        select: { id: true, amount: true },
      },
      financialAdjustments: {
        where: { sellerId: seller.id, status: "OPEN" },
        select: { id: true, amount: true, currency: true },
      },
    },
  });

  // Group by currency first, then by order. A payout total is a single scalar
  // and this repo has no FX table anywhere, so a seller accruing in AED and
  // SAR gets one payout per currency, never one blended number.
  const byCurrency = new Map<Currency, OrderLine[]>();
  for (const order of orders) {
    for (const row of order.commissions) {
      if (row.currency !== order.currency) {
        // Unconvertible without an FX table. Refuse rather than pick one.
        throw new SettlementHoldError(
          `Commission ${row.id} is denominated in ${row.currency} but order ${order.id} is in ${order.currency}`,
        );
      }
    }
    for (const adjustment of order.financialAdjustments) {
      if (adjustment.currency !== order.currency) {
        throw new SettlementHoldError(
          `Adjustment ${adjustment.id} is denominated in ${adjustment.currency} but order ${order.id} is in ${order.currency}`,
        );
      }
    }

    const merchandise = order.items.reduce((sum, item) => sum.add(item.total), ZERO);
    const refunded = order.refunds.reduce((sum, refund) => sum.add(refund.amount), ZERO);
    const charged = order.commissions
      .filter((row) => row.amount.gt(ZERO))
      .reduce((sum, row) => sum.add(row.amount), ZERO);
    const reversed = order.commissions
      .filter((row) => row.amount.lt(ZERO))
      .reduce((sum, row) => sum.add(row.amount.abs()), ZERO);
    const receivable = order.financialAdjustments.reduce((sum, row) => sum.add(row.amount.abs()), ZERO);

    // workflow.setReturnStatus() books each refund's receivable as
    // (refund − reversal) when no unpaid payout item exists — and none can
    // have existed for an order that is only now being claimed. So the open
    // receivables on this order must equal refunds less reversals; if the
    // ledger disagrees with itself, no number here is trustworthy.
    const expectedReceivable = refunded.sub(reversed);
    if (!receivable.equals(expectedReceivable)) {
      throw new SettlementHoldError(
        `Order ${order.id}: open refund receivable ${fixed(receivable)} ${order.currency} does not reconcile with ${fixed(refunded)} refunded less ${fixed(reversed)} commission reversed`,
      );
    }

    const amount = merchandise.sub(refunded);
    const commission = charged.sub(reversed);
    const net = amount.sub(commission);
    // Commission above the merchandise it was charged on, or refunds above
    // the merchandise they were taken from, means the accrual basis is broken.
    // A negative line would be an invented number, so refuse to settle it.
    if (amount.isNegative() || commission.isNegative() || net.isNegative()) {
      throw new SettlementHoldError(
        `Order ${order.id} nets to ${fixed(net)} ${order.currency} (${fixed(amount)} merchandise after refunds, ${fixed(commission)} commission) — refusing to settle a negative line`,
      );
    }

    const lines = byCurrency.get(order.currency) ?? [];
    byCurrency.set(order.currency, lines);
    lines.push({
      orderId: order.id,
      amount,
      commission,
      net,
      adjustmentIds: order.financialAdjustments.map((row) => row.id),
    });
  }

  const created: GeneratedPayout[] = [];
  const now = new Date();
  for (const currency of [...byCurrency.keys()].sort()) {
    const items = byCurrency.get(currency)!;
    const gross = items.reduce((sum, item) => sum.add(item.amount), ZERO);
    const commission = items.reduce((sum, item) => sum.add(item.commission), ZERO);
    const net = gross.sub(commission);
    // Nothing payable: every claimed order in this currency was refunded in
    // full. A zero payout would look like a settlement on both the admin board
    // and the seller's payouts page while moving no money, so the accrual
    // stays claimable and rides along with the next payout that does pay.
    if (net.lte(ZERO)) continue;

    const orderIds = items.map((item) => item.orderId);
    const adjustmentIds = items.flatMap((item) => item.adjustmentIds);
    const payout = await tx.sellerPayout.create({
      data: {
        sellerId: seller.id,
        amount: net,
        currency,
        status: "PENDING",
        periodFrom,
        periodTo,
        notes: `Settlement run ${periodFrom.toISOString().slice(0, 10)} → ${periodTo.toISOString().slice(0, 10)}: ${items.length} order(s), gross ${fixed(gross)} ${currency} less ${fixed(commission)} commission${adjustmentIds.length ? `; ${adjustmentIds.length} refund receivable(s) applied` : ""}`,
        items: {
          create: items.map((item) => ({
            orderId: item.orderId,
            amount: item.amount,
            commission: item.commission,
            net: item.net,
          })),
        },
      },
      select: { id: true },
    });

    // Compare-and-set on the claim. The rows were read under this seller's
    // fence with `payoutItems: none`, so after our write there must be
    // exactly one payout item per claimed order for this seller. Any other
    // count means a second claim exists and this money would be paid twice
    // — roll the whole transaction back rather than emit it.
    const claimed = await tx.sellerPayoutItem.count({
      where: { orderId: { in: orderIds }, payout: { sellerId: seller.id } },
    });
    if (claimed !== orderIds.length) {
      throw new Error(
        `Settlement claim conflict for seller ${seller.id}: ${claimed} payout items exist for ${orderIds.length} claimed order(s)`,
      );
    }

    // The receivables folded into these lines are now recovered. Conditional
    // on OPEN — the state read above — so a concurrent writer outside the
    // fence cannot have applied them twice.
    if (adjustmentIds.length > 0) {
      const applied = await tx.sellerFinancialAdjustment.updateMany({
        where: { id: { in: adjustmentIds }, status: "OPEN" },
        data: { status: "APPLIED", appliedAt: now },
      });
      if (applied.count !== adjustmentIds.length) {
        throw new Error(
          `Settlement receivable conflict for seller ${seller.id}: ${applied.count} of ${adjustmentIds.length} open adjustments could be applied`,
        );
      }
    }

    await tx.auditLog.create({
      data: {
        actorId,
        sellerId: seller.id,
        entityType: "SellerPayout",
        entityId: payout.id,
        action: AuditAction.CREATE,
        after: {
          status: "PENDING",
          currency,
          // Money is written to the audit trail as fixed-scale strings; a
          // JSON number would round it.
          gross: fixed(gross),
          commission: fixed(commission),
          net: fixed(net),
          periodFrom: periodFrom.toISOString(),
          periodTo: periodTo.toISOString(),
          orderIds,
          adjustmentIds,
        },
      },
    });

    created.push({
      payoutId: payout.id,
      sellerId: seller.id,
      sellerName: seller.businessNameEn,
      currency,
      gross,
      commission,
      net,
      orderCount: items.length,
      adjustmentsApplied: adjustmentIds.length,
    });
  }
  if (created.length === 0) return { kind: "nothingPayable" };
  return { kind: "created", created };
}

// ─── SETTLEMENT BOARD (READ) ──────────────────────────────────────────────────

/**
 * The read-side twin of claimableAccrualWhere(). Kept as one fragment so the
 * "awaiting settlement" figures on the admin board and the rows a run actually
 * claims are the same population. The NOT EXISTS clause is the per-seller claim
 * guard that Prisma cannot express in a single grouped query.
 *
 * Unlike the claim predicate this keeps every unsettled row of a claimable
 * order — reversals included — so SUM(c.amount) is the commission the run
 * will actually withhold, net of refunds already reversed, not the gross
 * charge. The inner EXISTS is what makes an order claimable: an unsettled
 * charge on it. MIN(c."createdAt") is unaffected; a reversal always
 * postdates its charge.
 */
const claimableAccrualSql = Prisma.sql`
  FROM "Commission" c
  JOIN "Order" o ON o.id = c."orderId"
  JOIN "SellerProfile" sp ON sp.id = c."sellerId"
  WHERE c."settledAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM "Commission" ch
      WHERE ch."orderId" = c."orderId" AND ch."sellerId" = c."sellerId"
        AND ch."settledAt" IS NULL AND ch.amount > 0
    )
    AND o."paymentStatus" = 'PAID'
    AND o.status <> 'CANCELLED'
    AND sp."deletedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "SellerPayoutItem" pi
      JOIN "SellerPayout" p ON p.id = pi."payoutId"
      WHERE pi."orderId" = c."orderId" AND p."sellerId" = c."sellerId"
    )`;

/** Sellers shown in the "awaiting settlement" panel before the list is truncated. */
const CLAIMABLE_SELLER_LIMIT = 25;

/**
 * Order lines listed per payout. A settlement period can carry hundreds of
 * orders, so the lines are a bounded preview and the totals beside them come
 * from an aggregate over every line — a truncated sum would understate a payout.
 */
const PAYOUT_LINE_PREVIEW = 25;

export interface ClaimableAccrualByCurrency {
  currency: Currency;
  amount: Prisma.Decimal;
  orders: number;
  sellers: number;
  earliestAt: Date;
}

export interface ClaimableAccrualBySeller {
  sellerId: string;
  sellerName: string;
  currency: Currency;
  amount: Prisma.Decimal;
  orders: number;
}

export interface SettlementBoardFilters {
  page: number;
  limit: number;
  status?: PayoutStatus;
}

/**
 * Everything the settlements screen renders: the real payout rows with their
 * lines, per-currency status totals (never a cross-currency sum), and the
 * accrual a run would claim right now.
 */
export async function getSettlementBoard(filters: SettlementBoardFilters) {
  const where: Prisma.SellerPayoutWhereInput = filters.status ? { status: filters.status } : {};

  const [payouts, total, statusTotals, byCurrencyRows, bySellerRows] = await Promise.all([
    db.sellerPayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        seller: { select: { id: true, businessNameEn: true } },
        _count: { select: { items: true } },
        items: {
          orderBy: { id: "asc" },
          take: PAYOUT_LINE_PREVIEW,
          select: {
            id: true,
            amount: true,
            commission: true,
            net: true,
            order: { select: { id: true, orderNumber: true } },
          },
        },
      },
    }),
    db.sellerPayout.count({ where }),
    // Totals are grouped by currency as well as status: a single blended
    // figure would be a number that is true of nothing.
    db.sellerPayout.groupBy({
      by: ["status", "currency"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // `currency` comes back as the enum's text form, which is exactly the
    // Currency union; ordering never compares amounts across currencies.
    db.$queryRaw<Array<{ currency: Currency; amount: Prisma.Decimal; orders: bigint; sellers: bigint; earliestAt: Date }>>(Prisma.sql`
      SELECT c.currency::text AS currency,
             SUM(c.amount) AS amount,
             COUNT(DISTINCT c."orderId") AS orders,
             COUNT(DISTINCT c."sellerId") AS sellers,
             MIN(c."createdAt") AS "earliestAt"
      ${claimableAccrualSql}
      GROUP BY 1
      ORDER BY 1`),
    db.$queryRaw<Array<{ sellerId: string; sellerName: string; currency: Currency; amount: Prisma.Decimal; orders: bigint }>>(Prisma.sql`
      SELECT c."sellerId" AS "sellerId",
             sp."businessNameEn" AS "sellerName",
             c.currency::text AS currency,
             SUM(c.amount) AS amount,
             COUNT(DISTINCT c."orderId") AS orders
      ${claimableAccrualSql}
      GROUP BY 1, 2, 3
      ORDER BY 3, 4 DESC
      LIMIT ${CLAIMABLE_SELLER_LIMIT + 1}`),
  ]);

  // Exact line totals for the listed payouts, aggregated in Postgres over every
  // line rather than over the preview. SellerPayout.amount and the sum of its
  // lines are maintained together (generation writes both; workflow's refund
  // netting decrements both), so a disagreement is worth showing, not hiding.
  const lineTotals = payouts.length
    ? await db.sellerPayoutItem.groupBy({
        by: ["payoutId"],
        where: { payoutId: { in: payouts.map((payout) => payout.id) } },
        _sum: { amount: true, commission: true, net: true },
      })
    : [];
  const totalsByPayout = new Map(
    lineTotals.map((row) => [
      row.payoutId,
      {
        gross: row._sum.amount ?? ZERO,
        commission: row._sum.commission ?? ZERO,
        net: row._sum.net ?? ZERO,
      },
    ]),
  );

  const bySeller: ClaimableAccrualBySeller[] = bySellerRows
    .slice(0, CLAIMABLE_SELLER_LIMIT)
    .map((row) => ({
      sellerId: row.sellerId,
      sellerName: row.sellerName,
      currency: row.currency,
      amount: row.amount,
      orders: Number(row.orders),
    }));

  const byCurrency: ClaimableAccrualByCurrency[] = byCurrencyRows.map((row) => ({
    currency: row.currency,
    amount: row.amount,
    orders: Number(row.orders),
    sellers: Number(row.sellers),
    earliestAt: row.earliestAt,
  }));

  return {
    payouts: payouts.map((payout) => ({
      ...payout,
      /** Sum of every line on this payout, not just the previewed ones. */
      lineTotals: totalsByPayout.get(payout.id) ?? { gross: ZERO, commission: ZERO, net: ZERO },
      previewLimit: PAYOUT_LINE_PREVIEW,
    })),
    total,
    statusTotals,
    claimable: {
      byCurrency,
      bySeller,
      /** True when more sellers have claimable accrual than the panel lists. */
      truncated: bySellerRows.length > CLAIMABLE_SELLER_LIMIT,
      /** Oldest unclaimed accrual, so a run can default to a window that covers everything. */
      earliestAt: byCurrency.reduce<Date | null>(
        (oldest, row) => (oldest && oldest <= row.earliestAt ? oldest : row.earliestAt),
        null,
      ),
    },
  };
}
