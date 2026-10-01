import type {
  RFQQuoteStatus,
  RFQStatus,
  RFQSupplierInvitationStatus,
} from "@prisma/client";
import { db } from "../client";

export const SELLER_INVITED_RFQ_LIMIT = 50;
export const SELLER_QUOTE_REVISION_LIMIT = 100;

const OPEN_RFQ_STATUSES: readonly RFQStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "NEGOTIATING",
];

export type SellerInvitationPosture = "open" | "quoted" | "closed";

export function sellerInvitationCanSubmit(
  row: {
    invitationStatus: RFQSupplierInvitationStatus;
    rfqStatus: RFQStatus;
    acceptedQuoteId: string | null;
    responseDueAt: Date | null;
    expiresAt: Date | null;
  },
  now = new Date(),
) {
  const invitationOpen = !["DECLINED", "CLOSED"].includes(row.invitationStatus);
  const requestOpen = OPEN_RFQ_STATUSES.includes(row.rfqStatus) && !row.acceptedQuoteId;
  const beforeDeadline = (!row.responseDueAt || row.responseDueAt > now) && (!row.expiresAt || row.expiresAt > now);
  return invitationOpen && requestOpen && beforeDeadline;
}

/**
 * Seller-relative RFQ posture. The request-level QUOTED status can mean that a
 * different invited supplier responded, so it must never close this seller's
 * invitation by itself.
 */
export function sellerInvitationPosture(
  row: {
    invitationStatus: RFQSupplierInvitationStatus;
    rfqStatus: RFQStatus;
    acceptedQuoteId: string | null;
    responseDueAt: Date | null;
    expiresAt: Date | null;
    latestQuoteStatus: RFQQuoteStatus | null;
  },
  now = new Date(),
): SellerInvitationPosture {
  if (row.latestQuoteStatus) return "quoted";
  return sellerInvitationCanSubmit(row, now) ? "open" : "closed";
}

const invitationQuoteSelect = {
  id: true,
  revision: true,
  status: true,
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
  submittedAt: true,
  commercialFingerprint: true,
} as const;

/** RFQs explicitly invited to one seller, newest invitation first. */
export async function listSellerRfqInvitations(sellerId: string) {
  return db.rFQSupplierInvitation.findMany({
    where: { sellerId },
    orderBy: { invitedAt: "desc" },
    take: SELLER_INVITED_RFQ_LIMIT,
    select: {
      id: true,
      status: true,
      invitedAt: true,
      viewedAt: true,
      respondedAt: true,
      closedAt: true,
      rfq: {
        select: {
          id: true,
          rfqNumber: true,
          status: true,
          currency: true,
          notes: true,
          acceptedQuoteId: true,
          requiredBy: true,
          responseDueAt: true,
          awardByAt: true,
          expiresAt: true,
          createdAt: true,
          company: { select: { nameEn: true } },
          items: { select: { id: true, nameEn: true, quantity: true, notes: true, productId: true } },
        },
      },
      quotes: {
        orderBy: { revision: "desc" },
        take: 1,
        select: invitationQuoteSelect,
      },
    },
  });
}

export async function countSellerRfqInvitations(sellerId: string) {
  return db.rFQSupplierInvitation.count({ where: { sellerId } });
}

/** Invitations which still need this seller's first response. */
export async function countSellerActionableRfqInvitations(sellerId: string, now = new Date()) {
  return db.rFQSupplierInvitation.count({
    where: {
      sellerId,
      status: { in: ["INVITED", "VIEWED"] },
      quotes: { none: {} },
      rfq: {
        acceptedQuoteId: null,
        status: { in: [...OPEN_RFQ_STATUSES] },
        AND: [
          { OR: [{ responseDueAt: null }, { responseDueAt: { gt: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
    },
  });
}

/** Minimal invitation-scoped lookup for links and permission-aware navigation. */
export async function getSellerRfqInvitationAccess(opts: { rfqId: string; sellerId: string }) {
  return db.rFQSupplierInvitation.findUnique({
    where: { rfqId_sellerId: { rfqId: opts.rfqId, sellerId: opts.sellerId } },
    select: {
      status: true,
      rfq: {
        select: {
          status: true,
          acceptedQuoteId: true,
          responseDueAt: true,
          expiresAt: true,
        },
      },
      quotes: { orderBy: { revision: "desc" }, take: 1, select: { status: true } },
    },
  });
}

/**
 * Seller quote workspace. The composite invitation key is the access boundary:
 * an existing RFQ without this seller's invitation returns null exactly like a
 * missing RFQ.
 */
export async function getSellerRfqQuoteWorkspace(opts: { rfqId: string; sellerId: string }) {
  const invitation = await db.rFQSupplierInvitation.findUnique({
    where: { rfqId_sellerId: { rfqId: opts.rfqId, sellerId: opts.sellerId } },
    select: {
      id: true,
      status: true,
      invitedAt: true,
      viewedAt: true,
      respondedAt: true,
      closedAt: true,
      rfq: {
        select: {
          id: true,
          rfqNumber: true,
          status: true,
          currency: true,
          notes: true,
          acceptedQuoteId: true,
          requiredBy: true,
          responseDueAt: true,
          awardByAt: true,
          expiresAt: true,
          createdAt: true,
          company: { select: { nameEn: true } },
          items: { select: { id: true, nameEn: true, quantity: true, notes: true, productId: true } },
        },
      },
      quotes: {
        orderBy: { revision: "desc" },
        take: 1,
        select: {
          ...invitationQuoteSelect,
          items: {
            select: {
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
        },
      },
    },
  });
  if (!invitation) return null;

  const products = await db.product.findMany({
    where: { sellerId: opts.sellerId, status: "ACTIVE", deletedAt: null, isB2BEnabled: true },
    orderBy: [{ nameEn: "asc" }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      nameEn: true,
      variants: {
        where: { isActive: true },
        orderBy: [{ nameEn: "asc" }, { sku: "asc" }],
        select: { id: true, sku: true, nameEn: true },
      },
    },
  });

  return { invitation, products };
}

/** Every immutable quote revision owned by this seller. */
export async function listSellerQuoteRevisions(sellerId: string) {
  return db.rFQQuote.findMany({
    where: { sellerId },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: SELLER_QUOTE_REVISION_LIMIT,
    select: {
      ...invitationQuoteSelect,
      rfqId: true,
      sellerId: true,
      createdAt: true,
      rfq: {
        select: {
          rfqNumber: true,
          requiredBy: true,
          company: { select: { nameEn: true } },
        },
      },
      _count: { select: { items: true } },
    },
  });
}
