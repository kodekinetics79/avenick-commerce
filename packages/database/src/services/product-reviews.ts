import { Prisma, type ProductReview } from "@prisma/client";
import { db, AuditAction } from "../index";
import { lockUserCommerceRows } from "./checkout-invariants";

/**
 * Verified-purchase product reviews.
 *
 * A review may be written only by a buyer who has received the product: an
 * Order of theirs in DELIVERED status with an OrderItem for this product. That
 * single rule is the whole meaning of the "Verified" badge on the storefront —
 * `isVerified` is stamped from it at write time and nothing else sets it.
 * There is no unverified path today; if one is ever added it must write
 * `isVerified: false` so the badge keeps meaning what it says.
 */

export type ReviewEligibilityReason = "anonymous" | "not-purchased" | "already-reviewed" | "ok";

export interface ReviewEligibility {
  eligible: boolean;
  reason: ReviewEligibilityReason;
}

/** Bounds shared with the API route's zod schema so the two never disagree. */
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
export const REVIEW_TITLE_MAX_LENGTH = 120;
export const REVIEW_BODY_MIN_LENGTH = 10;
export const REVIEW_BODY_MAX_LENGTH = 2000;

export type ProductReviewErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "ACCOUNT_INACTIVE"
  | "NOT_ELIGIBLE"
  | "ALREADY_REVIEWED"
  | "INVALID_INPUT";

/** Typed failure so the HTTP layer can map a cause to a status without matching on prose. */
export class ProductReviewError extends Error {
  constructor(readonly code: ProductReviewErrorCode, message: string) {
    super(message);
    this.name = "ProductReviewError";
  }
}

/**
 * Drop C0/C1 control characters except tab, LF and CR, then trim. Review text
 * is rendered verbatim on a public page; a stray NUL or escape sequence has no
 * business there. Returns null for an empty result so optional fields stay
 * optional rather than becoming "".
 */
export function normalizeReviewText(value: string | null | undefined): string | null {
  if (value == null) return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "").trim();
  return cleaned.length > 0 ? cleaned : null;
}

type ReviewClient = Pick<Prisma.TransactionClient, "order" | "productReview">;

/**
 * The eligibility rule, stated once. `status: DELIVERED` is the order's own
 * status, not the line's: a line-level DELIVERED on a still-open order is not
 * a receipt. The line must not have been cancelled either — fulfilment and
 * admin operations cancel individual lines, and a cancelled line in a
 * delivered order is a product the buyer never received.
 */
async function hasReceivedProduct(client: ReviewClient, userId: string, productId: string): Promise<boolean> {
  const delivered = await client.order.count({
    where: { userId, status: "DELIVERED", items: { some: { productId, status: { not: "CANCELLED" } } } },
  });
  return delivered > 0;
}

/**
 * Can this user review this product right now? Callers pass `null` for an
 * anonymous visitor. Purely advisory — the write path re-checks inside its
 * own transaction, so a stale "ok" here is harmless.
 */
export async function getReviewEligibility(input: {
  userId: string | null;
  productId: string;
}): Promise<ReviewEligibility> {
  if (!input.userId) return { eligible: false, reason: "anonymous" };
  const [existing, received] = await Promise.all([
    db.productReview.findUnique({
      where: { productId_userId: { productId: input.productId, userId: input.userId } },
      select: { id: true },
    }),
    hasReceivedProduct(db, input.userId, input.productId),
  ]);
  if (existing) return { eligible: false, reason: "already-reviewed" };
  if (!received) return { eligible: false, reason: "not-purchased" };
  return { eligible: true, reason: "ok" };
}

export interface CreateProductReviewInput {
  productId: string;
  userId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  /** Test seam: runs after the actor fence, before eligibility is read. */
  afterActorLock?: () => Promise<void>;
}

/**
 * Write a verified-purchase review.
 *
 * Runs under the user-commerce fence so a suspension racing the submit is
 * ordered one way or the other, and re-checks the actor, the product and the
 * delivered-order rule from the database inside the same transaction — the
 * session and the GET eligibility answer are hints, not authority. The
 * (productId, userId) unique constraint is the last word on "one review per
 * buyer": a concurrent duplicate surfaces as P2002 and is reported as such
 * rather than as a generic failure.
 */
export async function createProductReview(input: CreateProductReviewInput): Promise<ProductReview> {
  if (!Number.isInteger(input.rating) || input.rating < REVIEW_RATING_MIN || input.rating > REVIEW_RATING_MAX) {
    throw new ProductReviewError("INVALID_INPUT", `Rating must be a whole number from ${REVIEW_RATING_MIN} to ${REVIEW_RATING_MAX}`);
  }
  const title = normalizeReviewText(input.title);
  const body = normalizeReviewText(input.body);
  if (title && title.length > REVIEW_TITLE_MAX_LENGTH) {
    throw new ProductReviewError("INVALID_INPUT", `Title is limited to ${REVIEW_TITLE_MAX_LENGTH} characters`);
  }
  if (body && (body.length < REVIEW_BODY_MIN_LENGTH || body.length > REVIEW_BODY_MAX_LENGTH)) {
    throw new ProductReviewError("INVALID_INPUT", `Review text must be ${REVIEW_BODY_MIN_LENGTH} to ${REVIEW_BODY_MAX_LENGTH} characters`);
  }

  return db.$transaction(async (tx) => {
    await lockUserCommerceRows(tx, [input.userId]);
    const actor = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!actor || actor.status !== "ACTIVE" || actor.deletedAt) {
      throw new ProductReviewError("ACCOUNT_INACTIVE", "An active account is required to write a review");
    }
    await input.afterActorLock?.();

    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, sellerId: true },
    });
    if (!product) throw new ProductReviewError("PRODUCT_NOT_FOUND", "Product not found");

    const received = await hasReceivedProduct(tx, actor.id, product.id);
    if (!received) {
      throw new ProductReviewError("NOT_ELIGIBLE", "Only buyers who received this product can review it");
    }

    let review: ProductReview;
    try {
      review = await tx.productReview.create({
        data: {
          productId: product.id,
          userId: actor.id,
          rating: input.rating,
          title,
          body,
          // True exactly because `received` held above — the badge's only meaning.
          isVerified: received,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ProductReviewError("ALREADY_REVIEWED", "You have already reviewed this product");
      }
      throw error;
    }

    // Same shape as other buyer-authored writes: who reviewed what, and the
    // facts the badge was stamped from. The text is not copied into the audit
    // row — the review is the record; this is the provenance.
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        sellerId: product.sellerId,
        entityType: "ProductReview",
        entityId: review.id,
        action: AuditAction.CREATE,
        after: { productId: product.id, rating: review.rating, isVerified: review.isVerified },
      },
    });

    return review;
  });
}
