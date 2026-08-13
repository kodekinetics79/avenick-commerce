import { Prisma } from "@prisma/client";
import { db, AuditAction, type Currency } from "../index";

function generateRfqNumber(): string {
  const year = new Date().getFullYear();
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `RFQ-${year}-${time}${rand}`;
}

// ─── BUYER SIDE ───────────────────────────────────────────────────────────────

export interface CreateRFQInput {
  buyerId: string;
  companyId?: string;
  currency?: Currency;
  notes?: string;
  requiredBy?: Date;
  items: Array<{ nameEn: string; quantity: number; notes?: string; productId?: string }>;
}

export async function createRFQ(input: CreateRFQInput) {
  if (input.items.length === 0) throw new Error("An RFQ must contain at least one item");

  return db.rFQRequest.create({
    data: {
      rfqNumber: generateRfqNumber(),
      buyerId: input.buyerId,
      companyId: input.companyId,
      status: "SUBMITTED",
      currency: input.currency ?? "AED",
      notes: input.notes,
      requiredBy: input.requiredBy,
      items: {
        create: input.items.map((i) => ({
          nameEn: i.nameEn,
          quantity: i.quantity,
          notes: i.notes,
          productId: i.productId,
        })),
      },
    },
    include: { items: true },
  });
}

/** RFQs visible to a buyer: their own, plus their company's when applicable. */
export async function getRFQsForBuyer(opts: { buyerId: string; companyId?: string }) {
  const where: Prisma.RFQRequestWhereInput = opts.companyId
    ? { OR: [{ buyerId: opts.buyerId }, { companyId: opts.companyId }] }
    : { buyerId: opts.buyerId };

  return db.rFQRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: true,
      seller: { select: { businessNameEn: true, tier: true } },
      _count: { select: { messages: true } },
    },
  });
}

/** Object-scoped detail: only the requesting buyer (or their company) can read it. */
export async function getRFQForBuyer(opts: { rfqId: string; buyerId: string; companyId?: string }) {
  return db.rFQRequest.findFirst({
    where: {
      id: opts.rfqId,
      ...(opts.companyId
        ? { OR: [{ buyerId: opts.buyerId }, { companyId: opts.companyId }] }
        : { buyerId: opts.buyerId }),
    },
    include: {
      items: true,
      seller: { select: { businessNameEn: true, tier: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 50 },
    },
  });
}

/** Buyer decision on a quoted RFQ. */
export async function decideRFQ(opts: {
  rfqId: string;
  buyerId: string;
  companyId?: string;
  decision: "ACCEPTED" | "REJECTED";
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`rfq-claim:${opts.rfqId}`}))`,
    );
    const rfq = await tx.rFQRequest.findFirst({
      where: {
        id: opts.rfqId,
        ...(opts.companyId
          ? { OR: [{ buyerId: opts.buyerId }, { companyId: opts.companyId }] }
          : { buyerId: opts.buyerId }),
      },
      select: { id: true, status: true, quoteVersion: true, totalQuoted: true },
    });
    if (!rfq) throw new Error("RFQ not found");
    if (!["QUOTED", "NEGOTIATING"].includes(rfq.status)) {
      throw new Error("Only quoted RFQs can be accepted or rejected");
    }

    const decided = await tx.rFQRequest.updateMany({
      where: { id: rfq.id, status: rfq.status, quoteVersion: rfq.quoteVersion },
      data: { status: opts.decision },
    });
    if (decided.count !== 1) throw new Error("RFQ changed concurrently; reload and retry");
    await tx.auditLog.create({
      data: {
        actorId: opts.buyerId,
        entityType: "RFQRequest",
        entityId: opts.rfqId,
        action: opts.decision === "ACCEPTED" ? AuditAction.APPROVE : AuditAction.REJECT,
        before: {
          status: rfq.status,
          quoteVersion: rfq.quoteVersion,
          totalQuoted: rfq.totalQuoted == null ? null : Number(rfq.totalQuoted),
        },
        after: {
          status: opts.decision,
          acceptedQuoteVersion: opts.decision === "ACCEPTED" ? rfq.quoteVersion : undefined,
          totalQuoted: rfq.totalQuoted == null ? null : Number(rfq.totalQuoted),
        },
      },
    });
    return tx.rFQRequest.findUniqueOrThrow({ where: { id: rfq.id } });
  });
}

// ─── SELLER SIDE ──────────────────────────────────────────────────────────────

/** RFQs a seller can quote: open + unassigned, or already assigned to them. */
export async function getRFQsForSeller(sellerId: string) {
  return db.rFQRequest.findMany({
    where: {
      OR: [
        { status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, sellerId: null },
        { sellerId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: true,
      company: { select: { nameEn: true } },
    },
  });
}

export interface SubmitQuoteInput {
  rfqId: string;
  sellerId: string;
  actorId: string;
  items: Array<{ itemId: string; unitQuoted: number }>;
  notes?: string;
}

/** Seller submits unit prices for an open RFQ; totals are computed server-side. */
export async function submitQuote(input: SubmitQuoteInput) {
  return db.$transaction(async (tx) => {
    // Only one seller can claim an unassigned RFQ. The lock also serializes a
    // seller's own re-quotes so item prices, aggregate total and audit agree.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`rfq-claim:${input.rfqId}`}))`,
    );

    const rfq = await tx.rFQRequest.findUnique({
      where: { id: input.rfqId },
      include: { items: true },
    });
    if (!rfq) throw new Error("RFQ not found");
    if (rfq.sellerId && rfq.sellerId !== input.sellerId) {
      throw new Error("This RFQ is assigned to another seller");
    }
    if (!["SUBMITTED", "UNDER_REVIEW", "QUOTED", "NEGOTIATING"].includes(rfq.status)) {
      throw new Error("This RFQ is no longer open for quotes");
    }

    const itemMap = new Map(rfq.items.map((i) => [i.id, i]));
    const quotedItemIds = new Set(input.items.map((quoted) => quoted.itemId));
    if (
      input.items.length !== rfq.items.length ||
      quotedItemIds.size !== input.items.length ||
      rfq.items.some((item) => !quotedItemIds.has(item.id))
    ) {
      throw new Error("Quote must contain each RFQ item exactly once");
    }
    for (const quoted of input.items) {
      if (!itemMap.has(quoted.itemId)) throw new Error("Quoted item does not belong to this RFQ");
      if (!Number.isFinite(quoted.unitQuoted) || quoted.unitQuoted <= 0) {
        throw new Error("Quoted unit prices must be positive");
      }
    }

    const quotedByItemId = new Map(input.items.map((quoted) => [quoted.itemId, quoted.unitQuoted]));
    const canonicalQuote = rfq.items.map((item) => ({
      item,
      unitQuoted: quotedByItemId.get(item.id)!,
    }));
    const totalQuoted = canonicalQuote.reduce((sum, quoted) => {
      return sum + quoted.unitQuoted * quoted.item.quantity;
    }, 0);
    if (!Number.isFinite(totalQuoted)) throw new Error("Quoted total is invalid");

    const nextQuoteVersion = rfq.quoteVersion + 1;
    const claimed = await tx.rFQRequest.updateMany({
      where: {
        id: input.rfqId,
        status: rfq.status,
        quoteVersion: rfq.quoteVersion,
        OR: [{ sellerId: null }, { sellerId: input.sellerId }],
      },
      data: {
        sellerId: input.sellerId,
        status: "QUOTED",
        quoteVersion: nextQuoteVersion,
        totalQuoted,
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });
    if (claimed.count !== 1) throw new Error("This RFQ is assigned to another seller");
    for (const quoted of canonicalQuote) {
      await tx.rFQItem.update({ where: { id: quoted.item.id }, data: { unitQuoted: quoted.unitQuoted } });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "RFQRequest",
        entityId: input.rfqId,
        action: AuditAction.UPDATE,
        before: {
          status: rfq.status,
          quoteVersion: rfq.quoteVersion,
          totalQuoted: rfq.totalQuoted == null ? null : Number(rfq.totalQuoted),
        },
        after: { status: "QUOTED", quoteVersion: nextQuoteVersion, totalQuoted },
      },
    });
    const updated = await tx.rFQRequest.findUniqueOrThrow({ where: { id: input.rfqId } });
    return updated;
  });
}
