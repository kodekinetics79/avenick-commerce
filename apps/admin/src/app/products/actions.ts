"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { describeAdminFailure, restoreProduct, suppressProduct } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";

const productId = z.string().trim().regex(RECORD_ID, "Invalid product reference");
const suppressInput = z.object({
  productId,
  reason: z.string().trim().min(3, "Give the seller a reason they can act on").max(1000, "Keep the reason under 1000 characters"),
});

function revalidateProductSurfaces() {
  revalidatePath("/products");
  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function suppressListing(input: { productId: string; reason: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = suppressInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input", field: issue?.path[0]?.toString() };
  }
  try {
    await suppressProduct({ productId: parsed.data.productId, actorId: userId, reason: parsed.data.reason });
  } catch (error) {
    log.error("admin suppress product failed", error, { scope: "products.suppress", productId: parsed.data.productId });
    return { ok: false, error: describeAdminFailure(error, "Could not suppress this listing; reload and retry") };
  }
  revalidateProductSurfaces();
  return { ok: true, message: "Listing suppressed; the seller sees the reason in their issues queue" };
}

export async function restoreListing(input: { productId: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = productId.safeParse(input.productId);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product reference" };
  let status: string;
  try {
    ({ status } = await restoreProduct({ productId: parsed.data, actorId: userId }));
  } catch (error) {
    log.error("admin restore product failed", error, { scope: "products.restore", productId: parsed.data });
    return { ok: false, error: describeAdminFailure(error, "Could not restore this listing; reload and retry") };
  }
  revalidateProductSurfaces();
  return { ok: true, message: `Listing restored to ${status.toLowerCase().replace(/_/g, " ")}` };
}
