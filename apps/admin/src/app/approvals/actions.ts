"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { ProductNotPendingError, approveProduct, db, describeAdminFailure, rejectProduct } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

/** next-intl's translator, as much of it as this module uses. */
type Translator = (key: string, values?: Record<string, string | number>) => string;

// Thrown server-action errors are masked in production, so refusals travel
// back as values and only infrastructure failures are logged.
//
// The schemas are built per call rather than at module scope because every
// message in them is read by an administrator, and a translator does not exist
// until there is a request to read the locale from. The SHAPE of the validation
// is unchanged — only where its wording comes from.
const productIdSchema = (t: Translator) => z.string().trim().regex(RECORD_ID, t("actions.invalidProduct"));
const rejectInputSchema = (t: Translator) =>
  z.object({
    productId: productIdSchema(t),
    reason: z.string().trim().min(3, t("actions.reasonMin")).max(1000, t("actions.reasonMax")),
  });

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
async function stillPendingReview(t: Translator, id: string): Promise<string | null> {
  const product = await db.product.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
  if (!product) return t("actions.productNotFound");
  // actions.alreadyDecided: the compare-and-swap refusal, worded identically to
  // the one the service throws, so a stale page reads the same either way.
  if (product.status !== "PENDING_REVIEW") return t("actions.alreadyDecided");
  return null;
}

/**
 * A stale-queue refusal is an expected outcome, not a failure: it is neither
 * logged as an error nor described generically. Everything else keeps the
 * existing masking.
 */
function decisionFailure(t: Translator, error: unknown, scope: string, id: string, fallback: string): ActionResult {
  if (error instanceof ProductNotPendingError) {
    // The queue is refreshed so the row the admin was looking at disappears.
    revalidateProductSurfaces();
    return { ok: false, error: t("actions.alreadyDecided") };
  }
  log.error(`admin ${scope} product failed`, error, { scope: `approvals.${scope}`, productId: id });
  return { ok: false, error: describeAdminFailure(error, fallback) };
}

export async function approvePendingProduct(input: { productId: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = (await getTranslations("adminReview")) as Translator;
  const parsed = productIdSchema(t).safeParse(input.productId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? t("actions.invalidProduct") };
  try {
    const refusal = await stillPendingReview(t, parsed.data);
    if (refusal) return { ok: false, error: refusal };
    await approveProduct(parsed.data, userId);
  } catch (error) {
    return decisionFailure(t, error, "approve", parsed.data, t("actions.approveFallback"));
  }
  revalidateProductSurfaces();
  return { ok: true, message: t("actions.approved") };
}

export async function rejectPendingProduct(input: { productId: string; reason: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = (await getTranslations("adminReview")) as Translator;
  const parsed = rejectInputSchema(t).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? t("actions.invalidInput"), field: issue?.path[0]?.toString() };
  }
  try {
    const refusal = await stillPendingReview(t, parsed.data.productId);
    if (refusal) return { ok: false, error: refusal };
    await rejectProduct(parsed.data.productId, userId, parsed.data.reason);
  } catch (error) {
    return decisionFailure(t, error, "reject", parsed.data.productId, t("actions.rejectFallback"));
  }
  revalidateProductSurfaces();
  return { ok: true, message: t("actions.rejected") };
}
