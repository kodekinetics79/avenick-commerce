import type { ProductStatus } from "@avenick/database";

/**
 * The only status moves a seller may make from the list or from a CSV. Everything
 * else is either the review gate (DRAFT → PENDING_REVIEW → ACTIVE lives in the
 * product form and the admin approval queue) or a platform action (SUPPRESSED,
 * and SUSPENDED — the seller UI labels it "Suspended by platform").
 *
 *  - INACTIVE: pause an ACTIVE listing. Reversible by the seller.
 *  - ACTIVE:   resume a listing the seller paused. Allowed only from INACTIVE
 *              and only when `publishedAt` is set, i.e. an approver activated
 *              it once. A DRAFT/PENDING_REVIEW/REJECTED product can never be
 *              made ACTIVE here — that would let one click on the list (or one
 *              cell in a CSV) skip the review the form just routed it into.
 *
 * This lives outside products/actions.ts because that file is a "use server"
 * module, which may only export async functions; the rule itself is pure and
 * is unit-tested directly.
 */
export const SELLER_BULK_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type BulkStatus = (typeof SELLER_BULK_STATUSES)[number];

export type BulkStatusSkipReason = "NOT_APPROVED_YET" | "PLATFORM_SUPPRESSED" | "ALREADY_IN_STATUS" | "NOT_PAUSABLE";

/**
 * Why a seller-initiated move to `target` must not happen for this product, or
 * null when it may. The same rule fences the bulk action and the CSV import so
 * neither path can do what the other refuses.
 */
export function bulkTransitionBlocker(
  target: BulkStatus,
  product: { status: ProductStatus; publishedAt: Date | null },
): BulkStatusSkipReason | null {
  if (product.status === target) return "ALREADY_IN_STATUS";
  // Both platform-owned statuses are refused with the same reason: telling a
  // seller a suspended listing is "not yet approved" would send them to the
  // review form for something only the platform can undo.
  if (product.status === "SUPPRESSED" || product.status === "SUSPENDED") return "PLATFORM_SUPPRESSED";
  if (target === "ACTIVE") {
    return product.status === "INACTIVE" && product.publishedAt ? null : "NOT_APPROVED_YET";
  }
  // target === "INACTIVE": only a live listing can be paused; drafts and
  // queued reviews are withdrawn from the form, not from here.
  return product.status === "ACTIVE" ? null : "NOT_PAUSABLE";
}
