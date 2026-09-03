"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { describeAdminFailure, restoreProduct, suppressProduct } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";
import { statusLabel } from "@/app/approvals/status-labels";

/** next-intl's translator, as much of it as this module uses. */
type Translator = (key: string, values?: Record<string, string | number>) => string;

// Built per call rather than at module scope: every message in these schemas is
// read by an administrator, and a translator does not exist until there is a
// request to read the locale from. The validation itself is unchanged.
const productIdSchema = (t: Translator) => z.string().trim().regex(RECORD_ID, t("actions.invalidProduct"));
const suppressInputSchema = (t: Translator) =>
  z.object({
    productId: productIdSchema(t),
    reason: z.string().trim().min(3, t("actions.reasonMin")).max(1000, t("actions.reasonMax")),
  });

function revalidateProductSurfaces() {
  revalidatePath("/products");
  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function suppressListing(input: { productId: string; reason: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = (await getTranslations("adminReview")) as Translator;
  const parsed = suppressInputSchema(t).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? t("actions.invalidInput"), field: issue?.path[0]?.toString() };
  }
  try {
    await suppressProduct({ productId: parsed.data.productId, actorId: userId, reason: parsed.data.reason });
  } catch (error) {
    log.error("admin suppress product failed", error, { scope: "products.suppress", productId: parsed.data.productId });
    return { ok: false, error: describeAdminFailure(error, t("actions.suppressFallback")) };
  }
  revalidateProductSurfaces();
  return { ok: true, message: t("actions.suppressed") };
}

export async function restoreListing(input: { productId: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = (await getTranslations("adminReview")) as Translator;
  const parsed = productIdSchema(t).safeParse(input.productId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? t("actions.invalidProduct") };
  let status: string;
  try {
    ({ status } = await restoreProduct({ productId: parsed.data, actorId: userId }));
  } catch (error) {
    log.error("admin restore product failed", error, { scope: "products.restore", productId: parsed.data });
    return { ok: false, error: describeAdminFailure(error, t("actions.restoreFallback")) };
  }
  revalidateProductSurfaces();
  // The state the row actually landed in, named — never a flat "restored".
  return { ok: true, message: t("actions.restored", { status: statusLabel(t, status, "statusInline") }) };
}
