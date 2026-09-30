import { db } from "../index";

const BUYER_WORKSPACE_ROLES = new Set(["COMPANY_ADMIN", "COMPANY_BUYER", "COMPANY_APPROVER"]);

export type BuyerRFQDealLedgerDTO = {
  id: string;
  rfqNumber: string;
  status: string;
  currency: string;
  notes: string | null;
  buyerId: string;
  createdAt: string;
  requiredBy: string | null;
  responseDueAt: string | null;
  awardByAt: string | null;
  expiresAt: string | null;
  acceptedQuoteId: string | null;
  canAward: boolean;
  items: Array<{ id: string; nameEn: string; quantity: number; notes: string | null }>;
  quotes: Array<{
    id: string;
    status: string;
    revision: number;
    currency: string;
    subtotal: string;
    vatAmount: string;
    freightAmount: string;
    freightVatRate: string;
    freightVatAmount: string;
    total: string;
    validUntil: string;
    leadTimeDays: number;
    paymentTermsDays: number;
    notes: string | null;
    commercialFingerprint: string;
    submittedAt: string | null;
    seller: {
      id: string;
      businessNameEn: string;
      businessNameAr: string | null;
      tier: string;
      country: string;
      city: string;
      verification: { type: string; reviewedAt: string } | null;
    };
    items: Array<{
      id: string;
      rfqItemId: string;
      productId: string;
      variantId: string | null;
      sku: string;
      nameEn: string;
      quantity: number;
      unitPrice: string;
      vatRate: string;
      lineSubtotal: string;
      lineVatAmount: string;
      lineTotal: string;
    }>;
    purchaseOrder: { id: string; poNumber: string; status: string } | null;
  }>;
  legacyQuote: {
    sellerName: string;
    sellerTier: string;
    total: string | null;
    items: Array<{ id: string; nameEn: string; quantity: number; unitQuoted: string | null }>;
  } | null;
};

const iso = (value: Date | null) => value?.toISOString() ?? null;
const decimal = (value: { toFixed(scale: number): string }) => value.toFixed(2);

/**
 * Buyer-company-scoped RFQ comparison projection.
 *
 * This is deliberately separate from the legacy single-supplier RFQ service:
 * comparison is a read model, and no quote from another company may enter it.
 * Membership, user and company state are re-read in the same transaction as
 * the RFQ so a stale session cannot turn into competitor-commercial leakage.
 */
export async function getBuyerRFQDealLedger(input: {
  rfqId: string;
  actorId: string;
  companyId: string;
}): Promise<BuyerRFQDealLedgerDTO | null> {
  return db.$transaction(async (tx) => {
    const member = await tx.companyMember.findFirst({
      where: { userId: input.actorId, companyId: input.companyId },
      include: {
        user: { select: { role: true, status: true, deletedAt: true } },
        company: { select: { status: true, deletedAt: true } },
      },
    });
    if (
      !member?.isActive ||
      member.user.status !== "ACTIVE" ||
      member.user.deletedAt ||
      member.company.status !== "ACTIVE" ||
      member.company.deletedAt ||
      member.role !== member.user.role ||
      !BUYER_WORKSPACE_ROLES.has(member.role)
    ) {
      return null;
    }

    const rfq = await tx.rFQRequest.findFirst({
      where: { id: input.rfqId, companyId: input.companyId },
      select: {
        id: true,
        rfqNumber: true,
        status: true,
        currency: true,
        notes: true,
        buyerId: true,
        createdAt: true,
        requiredBy: true,
        responseDueAt: true,
        awardByAt: true,
        expiresAt: true,
        acceptedQuoteId: true,
        totalQuoted: true,
        seller: { select: { businessNameEn: true, tier: true } },
        items: {
          orderBy: { id: "asc" },
          select: { id: true, nameEn: true, quantity: true, notes: true, unitQuoted: true },
        },
        quotes: {
          where: { status: { not: "DRAFT" } },
          orderBy: [{ sellerId: "asc" }, { revision: "desc" }],
          select: {
            id: true,
            sellerId: true,
            status: true,
            revision: true,
            currency: true,
            subtotal: true,
            vatAmount: true,
            freightAmount: true,
            freightVatRate: true,
            freightVatAmount: true,
            total: true,
            validUntil: true,
            leadTimeDays: true,
            paymentTermsDays: true,
            notes: true,
            commercialFingerprint: true,
            submittedAt: true,
            seller: {
              select: {
                id: true,
                businessNameEn: true,
                businessNameAr: true,
                tier: true,
                country: true,
                city: true,
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
            items: {
              orderBy: { rfqItemId: "asc" },
              select: {
                id: true,
                rfqItemId: true,
                productId: true,
                variantId: true,
                sku: true,
                nameEn: true,
                quantity: true,
                unitPrice: true,
                vatRate: true,
                lineSubtotal: true,
                lineVatAmount: true,
                lineTotal: true,
              },
            },
            sourcePurchaseOrder: { select: { id: true, poNumber: true, status: true } },
          },
        },
      },
    });
    if (!rfq) return null;

    // A supplier may have several immutable revisions. The comparison shows its
    // newest non-draft revision; older rows remain evidence in the database.
    const latestBySeller = new Map<string, (typeof rfq.quotes)[number]>();
    for (const quote of rfq.quotes) {
      if (!latestBySeller.has(quote.sellerId)) latestBySeller.set(quote.sellerId, quote);
    }
    const quotes = [...latestBySeller.values()].map((quote) => {
      const reviewed = quote.seller.documents[0];
      return {
        id: quote.id,
        status: quote.status,
        revision: quote.revision,
        currency: quote.currency,
        subtotal: decimal(quote.subtotal),
        vatAmount: decimal(quote.vatAmount),
        freightAmount: decimal(quote.freightAmount),
        freightVatRate: decimal(quote.freightVatRate),
        freightVatAmount: decimal(quote.freightVatAmount),
        total: decimal(quote.total),
        validUntil: quote.validUntil.toISOString(),
        leadTimeDays: quote.leadTimeDays,
        paymentTermsDays: quote.paymentTermsDays,
        notes: quote.notes,
        commercialFingerprint: quote.commercialFingerprint,
        submittedAt: iso(quote.submittedAt),
        seller: {
          id: quote.seller.id,
          businessNameEn: quote.seller.businessNameEn,
          businessNameAr: quote.seller.businessNameAr,
          tier: quote.seller.tier,
          country: quote.seller.country,
          city: quote.seller.city,
          verification: reviewed?.reviewedAt
            ? { type: reviewed.type, reviewedAt: reviewed.reviewedAt.toISOString() }
            : null,
        },
        items: quote.items.map((item) => ({
          id: item.id,
          rfqItemId: item.rfqItemId,
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          nameEn: item.nameEn,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(4),
          vatRate: item.vatRate.toFixed(2),
          lineSubtotal: decimal(item.lineSubtotal),
          lineVatAmount: decimal(item.lineVatAmount),
          lineTotal: decimal(item.lineTotal),
        })),
        purchaseOrder: quote.sourcePurchaseOrder,
      };
    });

    return {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      status: rfq.status,
      currency: rfq.currency,
      notes: rfq.notes,
      buyerId: rfq.buyerId,
      createdAt: rfq.createdAt.toISOString(),
      requiredBy: iso(rfq.requiredBy),
      responseDueAt: iso(rfq.responseDueAt),
      awardByAt: iso(rfq.awardByAt),
      expiresAt: iso(rfq.expiresAt),
      acceptedQuoteId: rfq.acceptedQuoteId,
      canAward: member.role === "COMPANY_ADMIN" || (member.role === "COMPANY_BUYER" && rfq.buyerId === input.actorId),
      items: rfq.items.map(({ unitQuoted: _legacyPrice, ...item }) => item),
      quotes,
      legacyQuote: quotes.length === 0 && rfq.seller
        ? {
            sellerName: rfq.seller.businessNameEn,
            sellerTier: rfq.seller.tier,
            total: rfq.totalQuoted ? decimal(rfq.totalQuoted) : null,
            items: rfq.items.map((item) => ({
              id: item.id,
              nameEn: item.nameEn,
              quantity: item.quantity,
              unitQuoted: item.unitQuoted ? decimal(item.unitQuoted) : null,
            })),
          }
        : null,
    };
  });
}
