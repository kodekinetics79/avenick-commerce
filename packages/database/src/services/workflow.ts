import {
  db,
  AuditAction,
  Prisma,
  type RFQStatus,
  type ReturnStatus,
} from "../index";

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
 * creates a pending Refund on the order for the agreed amount.
 */
export async function setReturnStatus(opts: {
  returnId: string;
  status: ReturnStatus;
  actorId: string;
  resolution?: string;
  refundAmount?: number;
}) {
  return db.$transaction(async (tx) => {
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
        order: {
          select: {
            items: { select: { sellerId: true, total: true } },
          },
        },
      },
    });
    if (!target) throw new Error("Return request not found");
    if (!RETURN_TRANSITIONS[target.status].includes(opts.status)) {
      throw new Error(`Cannot move a ${target.status.toLowerCase()} return to ${opts.status.toLowerCase()}`);
    }

    const sellerMaximum = target.order.items
      .filter((item) => item.sellerId === target.sellerId)
      .reduce((sum, item) => sum + Number(item.total), 0);
    const refundAmount = opts.refundAmount ?? (target.refundAmount ? Number(target.refundAmount) : sellerMaximum);
    if (opts.status === "REFUNDED" && (!Number.isFinite(refundAmount) || refundAmount <= 0)) {
      throw new Error("A positive refund amount is required to refund a return");
    }
    if (opts.status === "REFUNDED" && refundAmount > sellerMaximum) {
      throw new Error("Refund amount cannot exceed this seller's order lines");
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
      await tx.refund.create({
        data: {
          orderId: target.orderId,
          amount: refundAmount,
          reason: opts.resolution ?? `Seller return ${target.id} refunded`,
          status: "PENDING",
        },
      });
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
