"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { ProductNotPendingError, approveProduct, db, describeAdminFailure, rejectProduct } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

// Thrown server-action errors are masked in production, so refusals travel
// back as values and only infrastructure failures are logged.
const productId = z.string().trim().regex(RECORD_ID, "Invalid product reference");
const rejectInput = z.object({
  productId,
  reason: z.string().trim().min(3, "Give the seller a reason they can act on").max(1000, "Keep the reason under 1000 characters"),
});

/** The queue page was stale: the service found the row already decided, withdrawn or suppressed and wrote nothing. */
const ALREADY_DECIDED = "This item was already decided — reload to see its current state.";

function revalidateProductSurfaces() {
  revalidatePath("/approvals");
  revalidatePath("/products");
  revalidatePath("/");
}

/**
 * A review decision only makes sense against a listing still in the queue.
 * The service's transaction is the authority — approveProduct/rejectProduct
 * compare-and-set on PENDING_REVIEW under the product lock and throw
 * ProductNotPendingError when the row has moved — so this pre-check exists
 * only to answer the common stale-page case without opening a transaction.
 */
async function stillPendingReview(id: string): Promise<string | null> {
  const product = await db.product.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
  if (!product) return "Product not found";
  if (product.status !== "PENDING_REVIEW") return ALREADY_DECIDED;
  return null;
}

/**
 * A stale-queue refusal is an expected outcome, not a failure: it is neither
 * logged as an error nor described generically. Everything else keeps the
 * existing masking.
 */
function decisionFailure(error: unknown, scope: string, id: string, fallback: string): ActionResult {
  if (error instanceof ProductNotPendingError) {
    // The queue is refreshed so the row the admin was looking at disappears.
    revalidateProductSurfaces();
    return { ok: false, error: ALREADY_DECIDED };
  }
  log.error(`admin ${scope} product failed`, error, { scope: `approvals.${scope}`, productId: id });
  return { ok: false, error: describeAdminFailure(error, fallback) };
}

export async function approvePendingProduct(input: { productId: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = productId.safeParse(input.productId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product reference" };
  try {
    const refusal = await stillPendingReview(parsed.data);
    if (refusal) return { ok: false, error: refusal };
    await approveProduct(parsed.data, userId);
  } catch (error) {
    return decisionFailure(error, "approve", parsed.data, "Could not approve this listing; reload and retry");
  }
  revalidateProductSurfaces();
  return { ok: true, message: "Listing approved and live" };
}

export async function rejectPendingProduct(input: { productId: string; reason: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = rejectInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input", field: issue?.path[0]?.toString() };
  }
  try {
    const refusal = await stillPendingReview(parsed.data.productId);
    if (refusal) return { ok: false, error: refusal };
    await rejectProduct(parsed.data.productId, userId, parsed.data.reason);
  } catch (error) {
    return decisionFailure(error, "reject", parsed.data.productId, "Could not reject this listing; reload and retry");
  }
  revalidateProductSurfaces();
  return { ok: true, message: "Listing rejected; the seller sees the reason in their issues queue" };
}
