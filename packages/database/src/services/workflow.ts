import {
  db,
  AuditAction,
  Prisma,
  type RFQStatus,
  type ReturnStatus,
} from "../index";
import { lockUserCommerceRows } from "./checkout-invariants";

// ─── RFQs (admin oversight) ───────────────────────────────────────────────────

export interface AdminRFQFilters {
  page: number;
  limit: number;
  status?: RFQStatus;
  search?: string;
}

export async function getAdminRFQs(filters: AdminRFQFilters) {
  const where: Prisma.RFQRequestWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { rfqNumber: { contains: filters.search, mode: "insensitive" } },
            { company: { nameEn: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rfqs, total, statusCounts] = await Promise.all([
    db.rFQRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        company: { select: { nameEn: true } },
        seller: { select: { businessNameEn: true } },
        items: { select: { id: true, nameEn: true, quantity: true, unitQuoted: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.rFQRequest.count({ where }),
    db.rFQRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // RFQRequest.buyerId has no relation — resolve buyer identities in one query.
  const buyerIds = [...new Set(rfqs.map((r) => r.buyerId))];
  const buyers = await db.user.findMany({
    where: { id: { in: buyerIds } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const buyerMap = new Map(buyers.map((b) => [b.id, b]));

  return {
    rfqs: rfqs.map((r) => ({ ...r, buyer: buyerMap.get(r.buyerId) ?? null })),
    total,
    statusCounts,
  };
}

// ─── RETURNS / DISPUTES ───────────────────────────────────────────────────────

export interface AdminReturnFilters {
  page: number;
  limit: number;
  status?: ReturnStatus;
}

export async function getAdminReturns(filters: AdminReturnFilters) {
  const where: Prisma.ReturnRequestWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [returns, total, statusCounts] = await Promise.all([
    db.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        seller: { select: { businessNameEn: true } },
      },
    }),
    db.returnRequest.count({ where }),
    db.returnRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return { returns, total, statusCounts };
}

const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ["APPROVED", "REJECTED"],
  APPROVED: ["IN_TRANSIT", "RECEIVED", "REFUNDED"],
  REJECTED: [],
  IN_TRANSIT: ["RECEIVED"],
  RECEIVED: ["REFUNDED"],
  REFUNDED: [],
};

/**
 * Advance a return/dispute with an audit entry. Moving to REFUNDED also
 * records a completed Refund and atomically reverses unsettled settlement value.
 */
export async function setReturnStatus(opts: {
  returnId: string;
  status: ReturnStatus;
  actorId: string;
  resolution?: string;
  refundAmount?: number;
  /** Immutable provider/bank evidence that buyer funds actually moved. */
  refundReference?: string;
}) {
  return db.$transaction(async (tx) => {
    await lockUserCommerceRows(tx, [opts.actorId]);
    // Serialize transitions for this return. Without this lock, two REFUNDED
    // requests can both observe RECEIVED and create two financial records.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`return-transition:${opts.returnId}`}))`,
    );

    const target = await tx.returnRequest.findUnique({
      where: { id: opts.returnId },
      select: {
        id: true,
        status: true,
        orderId: true,
        sellerId: true,
        refundAmount: true,
        items: {
          select: { orderItemId: true, quantity: true, netAmount: true, vatAmount: true, grossAmount: true },
        },
        order: {
          select: {
            total: true,
            currency: true,
            items: { select: { sellerId: true, total: true, vatAmount: true } },
          },
        },
      },
    });
    if (!target) throw new Error("Return request not found");
    const actor = await tx.user.findUnique({
      where: { id: opts.actorId },
      include: { sellerMemberships: true, sellerProfile: { select: { id: true, status: true, deletedAt: true } } },
    });
    const platformAdmin = actor && ["ADMIN", "SUPER_ADMIN"].includes(actor.role);
    const membership = actor?.sellerMemberships[0];
    const sellerId = actor?.sellerProfile?.id ?? membership?.sellerId;
    const activeSellerActor = actor && ["SELLER_OWNER", "SELLER_STAFF"].includes(actor.role)
      && sellerId === target.sellerId && (actor.role === "SELLER_OWNER" || (membership?.isActive && membership.permissions.includes("returns.manage")));
    if (!actor || actor.status !== "ACTIVE" || actor.deletedAt || (!platformAdmin && !activeSellerActor)) {
      throw new Error("Current return-management authority is required");
    }
    if (!RETURN_TRANSITIONS[target.status].includes(opts.status)) {
      throw new Error(`Cannot move a ${target.status.toLowerCase()} return to ${opts.status.toLowerCase()}`);
    }
    const refundReference = opts.refundReference?.trim();
    if (opts.status === "REFUNDED" && !refundReference) {
      throw new Error("Completed refunds require a gateway or bank refund reference");
    }

    const sellerMaximum = target.order.items
      .filter((item) => item.sellerId === target.sellerId)
      .reduce((sum, item) => sum + Number(item.total), 0);
    // Customer-created returns persist the exact selected line/quantity value in
    // refundAmount. Legacy/admin-created returns without a preset retain the
    // seller-line ceiling.
    const authorizedMaximum = target.refundAmount ? Number(target.refundAmount) : sellerMaximum;
    const refundAmount = opts.refundAmount ?? authorizedMaximum;
    if (opts.status === "REFUNDED" && (!Number.isFinite(refundAmount) || refundAmount <= 0)) {
      throw new Error("A positive refund amount is required to refund a return");
    }
    if (opts.status === "REFUNDED" && refundAmount > authorizedMaximum) {
      throw new Error("Refund amount cannot exceed the selected return quantity");
    }
    if (
      opts.status === "REFUNDED" &&
      target.items.length > 0 &&
      Math.round(refundAmount * 100) !== Math.round(authorizedMaximum * 100)
    ) {
      throw new Error("An itemized return must refund the exact selected line quantities");
    }

    const ret = await tx.returnRequest.update({
      where: { id: opts.returnId },
      data: {
        status: opts.status,
        ...(opts.resolution ? { resolution: opts.resolution } : {}),
        ...(opts.status === "REFUNDED" ? { refundAmount } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: opts.actorId,
        sellerId: target.sellerId,
        entityType: "ReturnRequest",
        entityId: opts.returnId,
        action:
          opts.status === "APPROVED"
            ? AuditAction.APPROVE
            : opts.status === "REJECTED"
              ? AuditAction.REJECT
              : AuditAction.STATUS_CHANGE,
        before: { status: target.status },
        after: {
          status: opts.status,
          ...(opts.resolution ? { resolution: opts.resolution } : {}),
          ...(opts.status === "REFUNDED" ? { refundAmount } : {}),
        },
      },
    });
    if (opts.status === "REFUNDED") {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-finance:${target.sellerId}`}))`,
      );
      const completedAt = new Date();
      const exactNet = target.items.reduce((sum, item) => sum + Number(item.netAmount), 0);
      const exactVat = target.items.reduce((sum, item) => sum + Number(item.vatAmount), 0);
      const sellerVat = target.order.items
        .filter((item) => item.sellerId === target.sellerId)
        .reduce((sum, item) => sum + Number(item.vatAmount), 0);
      const sellerNet = target.order.items
        .filter((item) => item.sellerId === target.sellerId)
        .reduce((sum, item) => sum + Number(item.total) - Number(item.vatAmount), 0);
      const refundVatAmount = Number((target.items.length > 0
        ? exactVat
        : sellerMaximum > 0 ? sellerVat * refundAmount / sellerMaximum : 0).toFixed(2));
      const refundNetAmount = Number((target.items.length > 0
        ? exactNet
        : refundAmount - refundVatAmount).toFixed(2));
      const refund = await tx.refund.create({
        data: {
          orderId: target.orderId,
          returnRequestId: target.id,
          amount: refundAmount,
          netAmount: refundNetAmount,
          vatAmount: refundVatAmount,
          reason: opts.resolution ?? `Seller return ${target.id} refunded`,
          status: "COMPLETED",
          processedAt: completedAt,
          gatewayRef: refundReference,
        },
      });
      const commissions = await tx.commission.findMany({
        where: { orderId: target.orderId, sellerId: target.sellerId }, select: { amount: true, rate: true },
      });
      const positiveCommission = commissions.reduce((sum, row) => sum + Math.max(0, Number(row.amount)), 0);
      const reversedCommission = commissions.reduce((sum, row) => sum + Math.max(0, -Number(row.amount)), 0);
      const commercialRatio = target.items.length > 0
        ? (sellerNet > 0 ? refundNetAmount / sellerNet : 0)
        : (sellerMaximum > 0 ? refundAmount / sellerMaximum : 0);
      const reversal = Number(Math.min(
        Math.max(0, positiveCommission - reversedCommission),
        positiveCommission * commercialRatio,
      ).toFixed(2));
      if (reversal > 0) await tx.commission.create({ data: {
        orderId: target.orderId,
        sellerId: target.sellerId,
        amount: -reversal,
        rate: commissions.find((row) => Number(row.amount) > 0)?.rate ?? 0,
        currency: target.order.currency,
      } });

      const payoutItems = await tx.sellerPayoutItem.findMany({
        where: {
          orderId: target.orderId,
          payout: { sellerId: target.sellerId, status: { in: ["PENDING", "PROCESSING"] } },
        },
        include: { payout: { select: { id: true } } },
        orderBy: { id: "asc" },
      });
      let remainingGross = refundAmount;
      let remainingCommission = reversal;
      let nettedFromUnpaidPayouts = 0;
      for (const item of payoutItems) {
        if (remainingGross <= 0) break;
        const grossReduction = Math.min(remainingGross, Number(item.amount));
        const commissionReduction = Math.min(remainingCommission, Number(item.commission));
        const payoutReduction = Number(Math.max(0, grossReduction - commissionReduction).toFixed(2));
        await tx.sellerPayoutItem.update({ where: { id: item.id }, data: {
          amount: Number((Number(item.amount) - grossReduction).toFixed(2)),
          commission: Number((Number(item.commission) - commissionReduction).toFixed(2)),
          net: Number(Math.max(0, Number(item.net) - payoutReduction).toFixed(2)),
        } });
        await tx.sellerPayout.update({ where: { id: item.payout.id }, data: {
          amount: { decrement: payoutReduction },
        } });
        remainingGross = Number((remainingGross - grossReduction).toFixed(2));
        remainingCommission = Number((remainingCommission - commissionReduction).toFixed(2));
        nettedFromUnpaidPayouts = Number((nettedFromUnpaidPayouts + payoutReduction).toFixed(2));
      }
      const sellerClawback = Number(Math.max(0, refundAmount - reversal - nettedFromUnpaidPayouts).toFixed(2));
      if (sellerClawback > 0) {
        await tx.sellerFinancialAdjustment.create({ data: {
          sellerId: target.sellerId,
          orderId: target.orderId,
          refundId: refund.id,
          amount: -sellerClawback,
          currency: target.order.currency,
          status: "OPEN",
          reason: `Completed refund ${refundReference} was not recoverable from an unpaid payout`,
        } });
      }
    }
    return ret;
  });
}

// ─── SUPPORT ──────────────────────────────────────────────────────────────────

export async function getSupportTicket(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  });
}
