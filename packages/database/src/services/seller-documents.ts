import { AuditAction, Prisma, type DocumentStatus, type DocumentType, type SellerStatus } from "@prisma/client";
import { db } from "../index";
import { lockSellerCommercialRows, lockUserCommerceRows } from "./checkout-invariants";

// ─── SELLER COMPLIANCE DOCUMENTS ─────────────────────────────────────────────
//
// The only write path for SellerDocument from the seller side. Before this
// existed the model was authored by the seed script alone; the admin review
// mutation (services/admin.ts reviewDocument) only ever updated a row that
// someone else had created. A seller therefore could not satisfy the KYC gate
// their own approval depended on. This service closes that loop.
//
// The file itself never passes through here. The browser PUTs it straight to
// object storage under a presigned URL issued by the seller portal, and what
// this service records is the resulting object KEY — not a URL. Documents are
// private objects, so no URL is durable or shareable; readers mint a
// short-lived presigned GET from the key at view time.

/** Every DocumentType, in the order the picker offers them. */
export const SELLER_DOCUMENT_TYPES: readonly DocumentType[] = [
  "COMMERCIAL_REGISTRATION",
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "SASO_CERTIFICATE",
  "SFDA_APPROVAL",
  "HALAL_CERTIFICATE",
  "ESMA_CERTIFICATE",
  "ISO_CERTIFICATE",
  "OTHER",
];

/** Enum → human label. Checked against the Prisma enum at compile time. */
export const SELLER_DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  COMMERCIAL_REGISTRATION: "Commercial Registration (CR)",
  TRADE_LICENSE: "Trade License",
  VAT_CERTIFICATE: "VAT Certificate",
  SASO_CERTIFICATE: "SASO Certificate",
  SFDA_APPROVAL: "SFDA Approval",
  HALAL_CERTIFICATE: "Halal Certificate",
  ESMA_CERTIFICATE: "ESMA Certificate",
  ISO_CERTIFICATE: "ISO Certificate",
  OTHER: "Other document",
};

/**
 * Types that carry a validity period, so the uploader asks for an expiry date
 * and the Document Center can warn before it lapses. A CR has no expiry in
 * the sense the platform tracks, and OTHER is whatever the seller says it is.
 */
export const EXPIRING_DOCUMENT_TYPES: readonly DocumentType[] = [
  "TRADE_LICENSE",
  "VAT_CERTIFICATE",
  "ISO_CERTIFICATE",
  "SASO_CERTIFICATE",
  "SFDA_APPROVAL",
  "HALAL_CERTIFICATE",
  "ESMA_CERTIFICATE",
];

export function documentTypeExpires(type: DocumentType): boolean {
  return EXPIRING_DOCUMENT_TYPES.includes(type);
}

/**
 * The rejection reason written onto a row of the same type that a newer one
 * has replaced: an older PENDING_REVIEW row when the seller uploads again
 * (recordSellerDocument below), and an older APPROVED row when an admin
 * approves the renewal (services/admin.ts reviewDocument), so exactly one
 * approved document per type stands at a time. Exported so the UI can
 * recognise a supersession and show it as "replaced", not as an admin refusal.
 */
export const SUPERSEDED_REJECTION_REASON = "Superseded by a newer upload";

/**
 * Seller statuses admitted to file documents. PENDING_REVIEW is here on
 * purpose: approval requires documents, so a seller under review must be
 * able to upload them, or the gate can never open. Nothing commercial admits
 * PENDING_REVIEW — see requireCurrentSellerActor in ./checkout-invariants.
 *
 * apps/seller/src/lib/auth.ts re-exports this list as
 * ONBOARDING_SELLER_STATUSES for the page/route gate — an alias, not a second
 * copy — so the gate and the transaction boundary cannot disagree. This is the
 * only definition.
 */
export const DOCUMENT_UPLOAD_SELLER_STATUSES: readonly SellerStatus[] = ["ACTIVE", "PENDING_REVIEW"];

/**
 * Onboarding sibling of requireCurrentSellerActor.
 *
 * The original is deliberately ACTIVE-only and is left untouched — widening
 * it would let a seller under review quote, fulfil and change prices. This
 * variant takes the same locks and re-resolves the same facts inside the
 * transaction, differing only in which seller statuses it admits. Use it for
 * nothing but compliance evidence.
 */
export async function requireCurrentOnboardingSellerActor(
  tx: Pick<Prisma.TransactionClient, "$executeRaw" | "user">,
  actorId: string,
  sellerId: string,
  required: string | readonly string[],
) {
  await lockUserCommerceRows(tx, [actorId]);
  await lockSellerCommercialRows(tx, [sellerId]);
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    include: {
      sellerProfile: { select: { id: true, status: true, deletedAt: true } },
      sellerMemberships: { include: { seller: { select: { status: true, deletedAt: true } } } },
    },
  });
  if (!actor || actor.status !== "ACTIVE" || actor.deletedAt) throw new Error("Current seller authority is required");
  const admitted = (status: SellerStatus) => DOCUMENT_UPLOAD_SELLER_STATUSES.includes(status);
  if (
    actor.role === "SELLER_OWNER" &&
    actor.sellerProfile?.id === sellerId &&
    admitted(actor.sellerProfile.status) &&
    !actor.sellerProfile.deletedAt
  ) {
    return actor;
  }
  const membership = actor.sellerMemberships.find((row) => row.sellerId === sellerId);
  const permissions = typeof required === "string" ? [required] : [...new Set(required)];
  const hasRequired =
    membership?.permissions.includes("*") || permissions.every((permission) => membership?.permissions.includes(permission));
  if (
    actor.role !== "SELLER_STAFF" ||
    !membership?.isActive ||
    !admitted(membership.seller.status) ||
    membership.seller.deletedAt ||
    !hasRequired
  ) {
    throw new Error(`Current seller permission required: ${permissions.join(" and ")}`);
  }
  return actor;
}

/**
 * Prefix every seller-document object key must carry for `sellerId`. Mirrors
 * the namespace the presigner issues (private/sellers/<id>/documents/). The
 * full policy check — generated-segment shape, allowlisted extension — is
 * isKeyInUploadNamespace() in @avenick/utils/browser-upload-policy, which the
 * seller action applies before calling here. That module is not imported into
 * this package because the shared barrel is bundled into edge middleware and
 * the policy pulls in node:crypto; this guard is the ownership half that must
 * hold no matter who the caller is.
 */
export function sellerDocumentKeyPrefix(sellerId: string): string {
  return `private/sellers/${sellerId}/documents/`;
}

/**
 * Whether a stored SellerDocument.fileUrl is an object key this seller owns.
 * Rows written before this service existed (seed data) hold absolute URLs and
 * return false; readers treat those as legacy links rather than keys.
 */
export function isSellerDocumentKey(fileUrl: string, sellerId: string): boolean {
  if (!fileUrl.startsWith(sellerDocumentKeyPrefix(sellerId))) return false;
  const rest = fileUrl.slice(sellerDocumentKeyPrefix(sellerId).length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..") && !/\s/.test(rest);
}

export interface RecordSellerDocumentInput {
  sellerId: string;
  actorId: string;
  type: DocumentType;
  /** Object key returned by the presigner; stored verbatim in fileUrl. */
  fileKey: string;
  /** The seller's original filename, kept for display only. */
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
  expiryDate?: Date | null;
}

export interface RecordSellerDocumentResult {
  id: string;
  status: DocumentStatus;
  /** Older PENDING_REVIEW rows of the same type that this upload replaced. */
  supersededIds: string[];
}

const FILE_NAME_MAX = 255;

/**
 * Record an uploaded compliance document for admin review.
 *
 * Renewal rule: an APPROVED row of the same type is never overwritten. The new
 * upload is a separate PENDING_REVIEW row, and the approved one stands until
 * an admin decides on the renewal — a seller must not be able to un-approve
 * themselves by uploading, and the platform must not lose the evidence it
 * approved. There is only ever one open review per type: older PENDING_REVIEW
 * rows of the same type are closed as REJECTED with SUPERSEDED_REJECTION_REASON
 * inside the same transaction, so the admin queue shows one item, the newest.
 * REJECTED and EXPIRED rows are history and are left alone.
 */
export async function recordSellerDocument(input: RecordSellerDocumentInput): Promise<RecordSellerDocumentResult> {
  const fileName = input.fileName.trim();
  if (!fileName) throw new Error("A file name is required");
  if (fileName.length > FILE_NAME_MAX) throw new Error(`File names must be ${FILE_NAME_MAX} characters or fewer`);
  if (!SELLER_DOCUMENT_TYPES.includes(input.type)) throw new Error("Unknown document type");
  if (!isSellerDocumentKey(input.fileKey, input.sellerId)) {
    throw new Error("Only files uploaded through the Document Center can be recorded");
  }
  if (input.fileSize !== undefined && input.fileSize !== null && (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0)) {
    throw new Error("File size must be a positive number of bytes");
  }
  if (input.expiryDate && Number.isNaN(input.expiryDate.getTime())) throw new Error("Expiry date is not a valid date");

  return db.$transaction(async (tx) => {
    await requireCurrentOnboardingSellerActor(tx, input.actorId, input.sellerId, "documents.manage");

    const seller = await tx.sellerProfile.findUnique({ where: { id: input.sellerId }, select: { deletedAt: true } });
    if (!seller || seller.deletedAt) throw new Error("Seller not found");

    // Close the previous open review for this type before opening the new one.
    const openReviews = await tx.sellerDocument.findMany({
      where: { sellerId: input.sellerId, type: input.type, status: "PENDING_REVIEW" },
      select: { id: true },
    });
    // reviewedAt/reviewedBy stay null: nobody reviewed these rows, the seller
    // replaced them. The audit entry records who and when.
    //
    // Each row is closed with its own compare-and-set. The admin reviewer
    // (services/admin.ts reviewDocument) now takes the same seller lock, but
    // the status predicate stays the guarantee rather than the lock: a row
    // read as PENDING_REVIEW that is APPROVED by the time this write lands is
    // left alone, and only a row that actually changed gets an audit entry and
    // a place in supersededIds — the log must never claim a supersession that
    // did not happen.
    const supersededIds: string[] = [];
    for (const row of openReviews) {
      const { count } = await tx.sellerDocument.updateMany({
        where: { id: row.id, status: "PENDING_REVIEW" },
        data: { status: "REJECTED", rejectionReason: SUPERSEDED_REJECTION_REASON },
      });
      if (count !== 1) continue;
      supersededIds.push(row.id);
      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          sellerId: input.sellerId,
          entityType: "SellerDocument",
          entityId: row.id,
          action: AuditAction.STATUS_CHANGE,
          before: { status: "PENDING_REVIEW" },
          after: { status: "REJECTED", reason: SUPERSEDED_REJECTION_REASON },
        },
      });
    }

    const document = await tx.sellerDocument.create({
      data: {
        sellerId: input.sellerId,
        type: input.type,
        fileUrl: input.fileKey,
        fileName,
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType ?? null,
        status: "PENDING_REVIEW",
        expiryDate: input.expiryDate ?? null,
      },
      select: { id: true, status: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "SellerDocument",
        entityId: document.id,
        action: AuditAction.CREATE,
        after: {
          source: "SELLER_DOCUMENT_CENTER",
          type: input.type,
          fileName,
          fileSize: input.fileSize ?? null,
          mimeType: input.mimeType ?? null,
          expiryDate: input.expiryDate ? input.expiryDate.toISOString() : null,
          supersededIds,
        },
      },
    });

    return { id: document.id, status: document.status, supersededIds };
  });
}
