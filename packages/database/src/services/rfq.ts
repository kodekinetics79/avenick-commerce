import { Prisma, type RFQStatus } from "@prisma/client";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { db, AuditAction, type Currency } from "../index";
import {
  assertRequiredVariantSelection,
  lockCompanyApprovalRows,
  lockProductCommercialRows,
  requireCurrentCompanyActor,
  requireCurrentSellerActor,
} from "./checkout-invariants";
import { assertMatchingIdempotencyFingerprint } from "./commerce-governance";

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
  creationKey?: string;
  currency?: Currency;
  notes?: string;
  requiredBy?: Date;
  items: Array<{ nameEn: string; quantity: number; notes?: string; productId?: string }>;
}

export async function createRFQ(input: CreateRFQInput) {
  if (input.items.length === 0) throw new Error("An RFQ must contain at least one item");
  const creationKey = input.creationKey?.trim();
  if (creationKey && !input.companyId) throw new Error("An RFQ creation key requires company scope");
  if (creationKey && creationKey.length > 200) throw new Error("RFQ creation key is limited to 200 characters");

  return db.rFQRequest.create({
    data: {
      rfqNumber: generateRfqNumber(),
      buyerId: input.buyerId,
      companyId: input.companyId,
      creationKey: creationKey || undefined,
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

/**
 * How many messages the buyer's RFQ page carries. `messageTotal` on the DTO
 * says how many exist, so the page can state "latest N of M" honestly.
 */
export const RFQ_MESSAGE_WINDOW = 50;

/**
 * Object-scoped detail: only the requesting buyer (or their company) can read it.
 *
 * Messages are the newest RFQ_MESSAGE_WINDOW, returned oldest-first. Fetching
 * `asc, take` would hand back the first fifty forever, so on a long thread the
 * buyer would never see the seller's latest reply; fetching newest-first and
 * flipping keeps the window on the live end of the conversation while the
 * DTO stays chronological. The id tiebreak makes the order deterministic when
 * two messages share a timestamp.
 */
export async function getRFQForBuyer(opts: { rfqId: string; buyerId: string; companyId?: string }) {
  const rfq = await db.rFQRequest.findFirst({
    where: {
      id: opts.rfqId,
      ...(opts.companyId
        ? { OR: [{ buyerId: opts.buyerId }, { companyId: opts.companyId }] }
        : { buyerId: opts.buyerId }),
    },
    include: {
      items: true,
      seller: {
        select: {
          businessNameEn: true,
          tier: true,
          // THE BASIS A VERIFIED MARK MAY CITE, by the same rule the product page
          // applies (services/products.ts, getProductBySlug). The stored tier is
          // not one: the pilot importer and the seed scripts write VERIFIED on
          // sellers that have no reviewed document. Type and date only — the
          // file, its name and the reviewer never leave this function.
          documents: {
            where: {
              status: "APPROVED",
              reviewedAt: { not: null },
              OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }],
            },
            orderBy: { reviewedAt: "desc" },
            take: 1,
            select: { type: true, reviewedAt: true },
          },
        },
      },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: RFQ_MESSAGE_WINDOW },
      _count: { select: { messages: true } },
    },
  });
  if (!rfq) return null;
  const { _count, messages, seller, ...rest } = rfq;
  const reviewed = seller?.documents[0];
  return {
    ...rest,
    seller: seller
      ? {
          businessNameEn: seller.businessNameEn,
          tier: seller.tier,
          // null, not a guess, when no approved document stands.
          verification: reviewed?.reviewedAt ? { type: reviewed.type, reviewedAt: reviewed.reviewedAt } : null,
        }
      : null,
    messages: messages.reverse(),
    messageTotal: _count.messages,
  };
}

/** Buyer decision on a quoted RFQ. */
export async function decideRFQ(opts: {
  rfqId: string;
  buyerId: string;
  companyId?: string;
  decision: "ACCEPTED" | "REJECTED";
  expectedQuoteVersion: number;
}) {
  if (!Number.isInteger(opts.expectedQuoteVersion) || opts.expectedQuoteVersion < 0) {
    throw new Error("Expected quote version is required");
  }
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
    if (rfq.quoteVersion !== opts.expectedQuoteVersion) {
      throw new Error("Quote changed since it was viewed; review the latest quote before deciding");
    }

    const decided = await tx.rFQRequest.updateMany({
      where: { id: rfq.id, status: rfq.status, quoteVersion: opts.expectedQuoteVersion },
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

/**
 * Statuses in which an unclaimed RFQ is still open to any seller's quote.
 * submitQuote is the only writer of RFQRequest.sellerId, and it moves the row
 * to QUOTED in the same update, so "claimed and still in one of these" is
 * empty by construction — which is why the claimed arm below has no status.
 */
export const UNASSIGNED_RFQ_OPEN_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const satisfies readonly RFQStatus[];

/**
 * The seller inbox predicate: RFQs nobody has claimed yet and that are still
 * open to quotes, plus every RFQ this seller has claimed (whatever its status
 * now, so a quoted or accepted one stays reachable). getRFQsForSeller lists
 * with it and getSellerDashboard (services/products.ts) counts with it, so
 * the badge can never disagree with the list it opens onto.
 */
export function SELLER_RFQ_INBOX_WHERE(sellerId: string): Prisma.RFQRequestWhereInput {
  return {
    OR: [
      { status: { in: [...UNASSIGNED_RFQ_OPEN_STATUSES] }, sellerId: null },
      { sellerId },
    ],
  };
}

/**
 * Inbox page size. getSellerDashboard counts every row the predicate matches,
 * so the list can lag the badge once a seller has more than this; the page
 * compares its row count against this constant to say when it was cut.
 */
export const SELLER_RFQ_INBOX_LIMIT = 50;

/**
 * How many of a seller's own quoted RFQs the quote-history list returns. The
 * route's `take` and the page's "showing the newest N" notice read this same
 * constant: a page that names a different number than the query used would be
 * telling the seller their whole record is on screen when it is not.
 */
export const SELLER_QUOTE_HISTORY_LIMIT = 100;

/** RFQs a seller can quote: open + unassigned, or already assigned to them. */
export async function getRFQsForSeller(sellerId: string) {
  return db.rFQRequest.findMany({
    where: SELLER_RFQ_INBOX_WHERE(sellerId),
    orderBy: { createdAt: "desc" },
    take: SELLER_RFQ_INBOX_LIMIT,
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
  afterActorLock?: () => Promise<void>;
}

/** Seller submits unit prices for an open RFQ; totals are computed server-side. */
export async function submitQuote(input: SubmitQuoteInput) {
  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, "quotes.submit");
    await input.afterActorLock?.();
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
      },
    });
    if (claimed.count !== 1) throw new Error("This RFQ is assigned to another seller");
    for (const quoted of canonicalQuote) {
      await tx.rFQItem.update({ where: { id: quoted.item.id }, data: { unitQuoted: quoted.unitQuoted } });
    }
    // RFQ notes are the buyer's requirements; seller commentary belongs to
    // the attributed RFQ conversation and commits with this quote revision.
    const sellerNote = input.notes?.trim();
    if (sellerNote) {
      await tx.message.create({
        data: {
          rfqId: input.rfqId,
          senderId: input.actorId,
          senderType: "SELLER",
          body: sellerNote,
        },
      });
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

// ─── MULTI-SUPPLIER QUOTE FOUNDATION ──────────────────────────────────────────

export interface SubmitSupplierQuoteLineInput {
  rfqItemId: string;
  productId: string;
  variantId?: string;
  unitPrice: number;
  vatRate: number;
}

export interface SubmitSupplierQuoteInput {
  rfqId: string;
  sellerId: string;
  actorId: string;
  submissionKey: string;
  items: SubmitSupplierQuoteLineInput[];
  freightAmount: number;
  freightVatRate: number;
  validUntil: Date;
  leadTimeDays: number;
  paymentTermsDays: number;
  notes?: string;
  /** Deterministic seam after authorization and RFQ locks are held. */
  afterLocks?: () => Promise<void>;
}

export interface AcceptSupplierQuoteInput {
  rfqId: string;
  quoteId: string;
  companyId: string;
  actorId: string;
  expectedFingerprint: string;
  /** Deterministic seam proving acceptance, PO, audit and notifications roll back together. */
  faultAfterPurchaseOrderCreate?: () => void;
}

const decimalMoney = (value: Prisma.Decimal) => value.toDecimalPlaces(2);
const decimalRate = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100`);
  return new Prisma.Decimal(value).toDecimalPlaces(2);
};
const decimalAmount = (value: number, label: string, allowZero = true) => {
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label} must be ${allowZero ? "non-negative" : "positive"}`);
  }
  return new Prisma.Decimal(value).toDecimalPlaces(4);
};

function stableQuoteValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableQuoteValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableQuoteValue(item)]),
    );
  }
  return value;
}

/** Canonical request identity used for seller-scoped retry safety. */
export function supplierQuoteRequestFingerprint(input: Omit<SubmitSupplierQuoteInput, "afterLocks">): string {
  const canonical = JSON.stringify(stableQuoteValue({
    rfqId: input.rfqId,
    sellerId: input.sellerId,
    items: input.items.map((item) => ({
      rfqItemId: item.rfqItemId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      unitPrice: Number(item.unitPrice.toFixed(4)),
      vatRate: Number(item.vatRate.toFixed(2)),
    })).sort((left, right) => left.rfqItemId.localeCompare(right.rfqItemId)),
    freightAmount: Number(input.freightAmount.toFixed(2)),
    freightVatRate: Number(input.freightVatRate.toFixed(2)),
    validUntil: input.validUntil.toISOString(),
    leadTimeDays: input.leadTimeDays,
    paymentTermsDays: input.paymentTermsDays,
    notes: input.notes?.trim() || null,
  }));
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

function validateSupplierQuoteInput(input: SubmitSupplierQuoteInput) {
  const submissionKey = input.submissionKey.trim();
  if (!submissionKey || submissionKey.length > 200) throw new Error("A bounded quote submission key is required");
  if (!input.items.length || input.items.length > 50) throw new Error("A quote must contain between 1 and 50 lines");
  if (!(input.validUntil instanceof Date) || Number.isNaN(input.validUntil.getTime())) throw new Error("Quote validity is required");
  if (!Number.isInteger(input.leadTimeDays) || input.leadTimeDays < 0 || input.leadTimeDays > 3650) {
    throw new Error("Lead time must be a whole number of days between 0 and 3650");
  }
  if (!Number.isInteger(input.paymentTermsDays) || input.paymentTermsDays < 0 || input.paymentTermsDays > 3650) {
    throw new Error("Payment terms must be a whole number of days between 0 and 3650");
  }
  if (input.notes && input.notes.trim().length > 2000) throw new Error("Quote notes are limited to 2000 characters");
  decimalAmount(input.freightAmount, "Freight amount");
  decimalRate(input.freightVatRate, "Freight VAT rate");
  for (const item of input.items) {
    decimalAmount(item.unitPrice, "Quoted unit price", false);
    decimalRate(item.vatRate, "Quoted VAT rate");
  }
  return submissionKey;
}

/**
 * Submit an immutable quote revision for an explicitly invited seller.
 * A retry with the same seller/key/fingerprint returns the original revision;
 * reusing the key for different terms is rejected.
 */
export async function submitSupplierQuote(input: SubmitSupplierQuoteInput) {
  const submissionKey = validateSupplierQuoteInput(input);
  const requestFingerprint = supplierQuoteRequestFingerprint({ ...input, submissionKey });

  return db.$transaction(async (tx) => {
    await requireCurrentSellerActor(tx, input.actorId, input.sellerId, "quotes.submit");
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`rfq-award:${input.rfqId}`}))`);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`rfq-quote:${input.rfqId}:${input.sellerId}`}))`);
    await input.afterLocks?.();

    const replay = await tx.rFQQuote.findUnique({
      where: { sellerId_submissionKey: { sellerId: input.sellerId, submissionKey } },
      include: { items: true },
    });
    if (replay) {
      assertMatchingIdempotencyFingerprint(replay.requestFingerprint, requestFingerprint);
      return replay;
    }

    const invitation = await tx.rFQSupplierInvitation.findUnique({
      where: { rfqId_sellerId: { rfqId: input.rfqId, sellerId: input.sellerId } },
      include: { rfq: { include: { items: true } } },
    });
    if (!invitation || ["DECLINED", "CLOSED"].includes(invitation.status)) {
      throw new Error("An open supplier invitation is required");
    }
    const rfq = invitation.rfq;
    if (!rfq.companyId) throw new Error("A company-scoped RFQ is required");
    if (!["SUBMITTED", "UNDER_REVIEW", "QUOTED", "NEGOTIATING"].includes(rfq.status) || rfq.acceptedQuoteId) {
      throw new Error("This RFQ is no longer open for supplier quotes");
    }
    const now = new Date();
    if (rfq.expiresAt && rfq.expiresAt <= now) throw new Error("This RFQ has expired");
    if (rfq.responseDueAt && rfq.responseDueAt <= now) throw new Error("The supplier response deadline has passed");
    if (input.validUntil <= now) throw new Error("Quote validity must end in the future");

    const requestedById = new Map(rfq.items.map((item) => [item.id, item]));
    const quotedIds = new Set(input.items.map((item) => item.rfqItemId));
    if (input.items.length !== rfq.items.length || quotedIds.size !== input.items.length
      || rfq.items.some((item) => !quotedIds.has(item.id))) {
      throw new Error("Quote must contain each RFQ item exactly once");
    }

    await lockProductCommercialRows(tx, input.items.map((item) => item.productId));
    const products = await tx.product.findMany({
      where: { id: { in: [...new Set(input.items.map((item) => item.productId))] } },
      include: { variants: true },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    let subtotal = new Prisma.Decimal(0);
    let vatAmount = new Prisma.Decimal(0);
    const itemData = input.items.map((line) => {
      const requested = requestedById.get(line.rfqItemId);
      if (!requested) throw new Error("Quoted item does not belong to this RFQ");
      const product = productById.get(line.productId);
      if (!product || product.sellerId !== input.sellerId || product.deletedAt || product.status !== "ACTIVE" || !product.isB2BEnabled) {
        throw new Error("Every quote line must map to an active B2B product owned by the invited seller");
      }
      assertRequiredVariantSelection(product.nameEn, product.variants, line.variantId);
      const variant = line.variantId ? product.variants.find((candidate) => candidate.id === line.variantId) : undefined;
      if (line.variantId && (!variant || !variant.isActive)) throw new Error("Quoted variant is not active on the mapped product");
      const unitPrice = decimalAmount(line.unitPrice, "Quoted unit price", false);
      const vatRate = decimalRate(line.vatRate, "Quoted VAT rate");
      const lineSubtotal = decimalMoney(unitPrice.mul(requested.quantity));
      const lineVatAmount = decimalMoney(lineSubtotal.mul(vatRate).div(100));
      subtotal = subtotal.add(lineSubtotal);
      vatAmount = vatAmount.add(lineVatAmount);
      return {
        rfqItemId: requested.id,
        productId: product.id,
        variantId: variant?.id,
        sku: variant?.sku ?? product.sku,
        nameEn: variant?.nameEn ?? product.nameEn,
        quantity: requested.quantity,
        unitPrice,
        vatRate,
        lineSubtotal,
        lineVatAmount,
        lineTotal: lineSubtotal.add(lineVatAmount),
      };
    });

    subtotal = decimalMoney(subtotal);
    vatAmount = decimalMoney(vatAmount);
    const freightAmount = decimalMoney(decimalAmount(input.freightAmount, "Freight amount"));
    const freightVatRate = decimalRate(input.freightVatRate, "Freight VAT rate");
    const freightVatAmount = decimalMoney(freightAmount.mul(freightVatRate).div(100));
    const total = subtotal.add(vatAmount).add(freightAmount).add(freightVatAmount);
    if (total.greaterThan("999999999999.99")) throw new Error("Quoted total exceeds the supported commercial limit");

    const latest = await tx.rFQQuote.findFirst({
      where: { invitationId: invitation.id },
      orderBy: { revision: "desc" },
      select: { id: true, revision: true, status: true },
    });
    const revision = (latest?.revision ?? 0) + 1;
    const commercialFingerprint = bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(stableQuoteValue({
      rfqId: rfq.id,
      sellerId: input.sellerId,
      revision,
      currency: rfq.currency,
      subtotal: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      freightAmount: freightAmount.toFixed(2),
      freightVatRate: freightVatRate.toFixed(2),
      freightVatAmount: freightVatAmount.toFixed(2),
      total: total.toFixed(2),
      validUntil: input.validUntil.toISOString(),
      leadTimeDays: input.leadTimeDays,
      paymentTermsDays: input.paymentTermsDays,
      items: itemData.map((item) => ({
        rfqItemId: item.rfqItemId,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(4),
        vatRate: item.vatRate.toFixed(2),
      })).sort((left, right) => left.rfqItemId.localeCompare(right.rfqItemId)),
    })))));

    const draft = await tx.rFQQuote.create({
      data: {
        invitationId: invitation.id,
        rfqId: rfq.id,
        sellerId: input.sellerId,
        revision,
        status: "DRAFT",
        currency: rfq.currency,
        subtotal,
        vatAmount,
        freightAmount,
        freightVatRate,
        freightVatAmount,
        total,
        validUntil: input.validUntil,
        leadTimeDays: input.leadTimeDays,
        paymentTermsDays: input.paymentTermsDays,
        notes: input.notes?.trim() || null,
        commercialFingerprint,
        submissionKey,
        requestFingerprint,
        submittedById: input.actorId,
        items: { create: itemData },
      },
    });
    if (latest?.status === "SUBMITTED") {
      await tx.rFQQuote.update({
        where: { id: latest.id },
        data: { status: "SUPERSEDED", supersededById: draft.id },
      });
    }
    const submitted = await tx.rFQQuote.update({
      where: { id: draft.id },
      data: { status: "SUBMITTED", submittedAt: now },
      include: { items: true },
    });
    await tx.rFQSupplierInvitation.update({
      where: { id: invitation.id },
      data: { status: "QUOTED", respondedAt: invitation.respondedAt ?? now },
    });
    if (["SUBMITTED", "UNDER_REVIEW", "NEGOTIATING"].includes(rfq.status)) {
      await tx.rFQRequest.update({ where: { id: rfq.id }, data: { status: "QUOTED" } });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        companyId: rfq.companyId,
        entityType: "RFQQuote",
        entityId: submitted.id,
        action: AuditAction.CREATE,
        after: {
          rfqId: rfq.id,
          invitationId: invitation.id,
          revision,
          currency: rfq.currency,
          total: total.toFixed(2),
          commercialFingerprint,
          supersededQuoteId: latest?.status === "SUBMITTED" ? latest.id : null,
        },
      },
    });
    await tx.notification.create({
      data: {
        userId: rfq.buyerId,
        type: "RFQ",
        titleEn: "Supplier quote received",
        bodyEn: `A supplier submitted revision ${revision} for ${rfq.rfqNumber}.`,
        data: { rfqId: rfq.id, quoteId: submitted.id, revision },
      },
    });
    return submitted;
  });
}

/** Atomically award one immutable quote and create its exact draft PO snapshot. */
export async function acceptSupplierQuote(input: AcceptSupplierQuoteInput) {
  if (!/^[a-f0-9]{64}$/i.test(input.expectedFingerprint)) throw new Error("Expected quote fingerprint is required");
  return db.$transaction(async (tx) => {
    await lockCompanyApprovalRows(tx, [input.companyId]);
    const companyActor = await requireCurrentCompanyActor(tx, input, ["COMPANY_ADMIN", "COMPANY_BUYER"]);
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`rfq-award:${input.rfqId}`}))`);

    const quote = await tx.rFQQuote.findFirst({
      where: { id: input.quoteId, rfqId: input.rfqId, rfq: { companyId: input.companyId } },
      include: {
        items: true,
        invitation: { select: { id: true, status: true } },
        seller: { select: { id: true, userId: true, status: true, deletedAt: true } },
        rfq: {
          include: {
            items: { select: { id: true, quantity: true } },
            invitations: { include: { seller: { select: { id: true, userId: true } } } },
          },
        },
      },
    });
    if (!quote) throw new Error("Supplier quote not found");
    if (companyActor.role === "COMPANY_BUYER" && quote.rfq.buyerId !== input.actorId) {
      throw new Error("Only a company admin may award another buyer's RFQ");
    }
    assertMatchingIdempotencyFingerprint(quote.commercialFingerprint, input.expectedFingerprint);

    if (quote.rfq.acceptedQuoteId) {
      if (quote.rfq.acceptedQuoteId !== quote.id) throw new Error("Another supplier quote has already been accepted");
      const existing = await tx.purchaseOrder.findUnique({
        where: { sourceRfqQuoteId: quote.id }, include: { items: true },
      });
      if (!existing) throw new Error("Accepted quote is missing its draft purchase order");
      return { quote, purchaseOrder: existing };
    }
    const now = new Date();
    if (quote.status !== "SUBMITTED") throw new Error("Only a submitted supplier quote can be accepted");
    if (quote.invitation.status !== "QUOTED") throw new Error("The supplier invitation is no longer awardable");
    if (quote.validUntil <= now) throw new Error("This supplier quote has expired");
    if (quote.rfq.expiresAt && quote.rfq.expiresAt <= now) throw new Error("This RFQ has expired");
    if (quote.rfq.awardByAt && quote.rfq.awardByAt <= now) throw new Error("The RFQ award deadline has passed");
    if (quote.seller.status !== "ACTIVE" || quote.seller.deletedAt) throw new Error("The quoted seller is no longer active");
    const currentRequirementById = new Map(quote.rfq.items.map((item) => [item.id, item.quantity]));
    if (quote.items.length !== quote.rfq.items.length
      || quote.items.some((item) => currentRequirementById.get(item.rfqItemId) !== item.quantity)) {
      throw new Error("RFQ requirements changed after this quote was submitted");
    }

    await lockProductCommercialRows(tx, quote.items.map((item) => item.productId));
    const currentProducts = await tx.product.findMany({
      where: { id: { in: quote.items.map((item) => item.productId) } },
      include: { variants: true },
    });
    const currentById = new Map(currentProducts.map((product) => [product.id, product]));
    for (const line of quote.items) {
      const product = currentById.get(line.productId);
      const variant = line.variantId ? product?.variants.find((candidate) => candidate.id === line.variantId) : undefined;
      if (!product || product.sellerId !== quote.sellerId || product.deletedAt || product.status !== "ACTIVE" || !product.isB2BEnabled
        || (line.variantId && (!variant || !variant.isActive))) {
        throw new Error("A mapped seller product is no longer available for this quote");
      }
    }

    const accepted = await tx.rFQQuote.updateMany({
      where: { id: quote.id, status: "SUBMITTED" },
      data: { status: "ACCEPTED", acceptedById: input.actorId, acceptedAt: now },
    });
    if (accepted.count !== 1) throw new Error("Supplier quote changed concurrently; reload and retry");
    await tx.rFQRequest.update({
      where: { id: quote.rfqId },
      data: { status: "ACCEPTED", acceptedQuoteId: quote.id },
    });
    await tx.rFQQuote.updateMany({
      where: { rfqId: quote.rfqId, id: { not: quote.id }, status: "SUBMITTED" },
      data: { status: "REJECTED" },
    });
    await tx.rFQSupplierInvitation.updateMany({
      where: { rfqId: quote.rfqId, status: { in: ["INVITED", "VIEWED", "QUOTED"] } },
      data: { status: "CLOSED", closedAt: now },
    });

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        poNumber: `PO-RFQ-${quote.id}`,
        companyId: input.companyId,
        requesterId: quote.rfq.buyerId,
        status: "DRAFT",
        currency: quote.currency,
        subtotal: quote.subtotal,
        vatAmount: quote.vatAmount,
        freightAmount: quote.freightAmount,
        freightVatRate: quote.freightVatRate,
        freightVatAmount: quote.freightVatAmount,
        total: quote.total,
        sourceRfqQuoteId: quote.id,
        requiredDate: quote.rfq.requiredBy,
        notes: quote.notes,
        items: {
          create: quote.items.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            sellerId: quote.sellerId,
            sku: line.sku,
            nameEn: line.nameEn,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            lineSubtotal: line.lineSubtotal,
            sourceRfqQuoteItemId: line.id,
            priceExplanation: {
              source: "RFQ_QUOTE",
              rfqId: quote.rfqId,
              quoteId: quote.id,
              quoteRevision: quote.revision,
              commercialFingerprint: quote.commercialFingerprint,
            },
          })),
        },
      },
      include: { items: true },
    });
    input.faultAfterPurchaseOrderCreate?.();

    await tx.auditLog.createMany({ data: [
      {
        actorId: input.actorId,
        sellerId: quote.sellerId,
        companyId: input.companyId,
        entityType: "RFQQuote",
        entityId: quote.id,
        action: AuditAction.APPROVE,
        before: { status: quote.status },
        after: {
          status: "ACCEPTED", rfqId: quote.rfqId, revision: quote.revision,
          commercialFingerprint: quote.commercialFingerprint, purchaseOrderId: purchaseOrder.id,
        },
      },
      {
        actorId: input.actorId,
        sellerId: quote.sellerId,
        companyId: input.companyId,
        entityType: "PurchaseOrder",
        entityId: purchaseOrder.id,
        action: AuditAction.CREATE,
        after: {
          status: "DRAFT", sourceRfqQuoteId: quote.id, currency: quote.currency,
          total: quote.total.toFixed(2), commercialFingerprint: quote.commercialFingerprint,
        },
      },
    ] });

    const notificationUsers = new Set(quote.rfq.invitations.map((invitation) => invitation.seller.userId));
    notificationUsers.add(quote.rfq.buyerId);
    await tx.notification.createMany({
      data: [...notificationUsers].map((userId) => {
        const winner = userId === quote.seller.userId;
        const buyer = userId === quote.rfq.buyerId;
        return {
          userId,
          type: "RFQ" as const,
          titleEn: winner ? "Your quote was accepted" : buyer ? "Draft purchase order created" : "RFQ closed",
          bodyEn: winner
            ? `${quote.rfq.rfqNumber} was awarded to your company.`
            : buyer
              ? `${quote.rfq.rfqNumber} was awarded and a draft purchase order is ready.`
              : `${quote.rfq.rfqNumber} has been awarded and closed.`,
          data: winner
            ? { rfqId: quote.rfqId, quoteId: quote.id, purchaseOrderId: purchaseOrder.id }
            : buyer
              ? { rfqId: quote.rfqId, purchaseOrderId: purchaseOrder.id }
              : { rfqId: quote.rfqId, status: "CLOSED" },
        };
      }),
    });

    const finalQuote = await tx.rFQQuote.findUniqueOrThrow({ where: { id: quote.id }, include: { items: true } });
    return { quote: finalQuote, purchaseOrder };
  });
}
