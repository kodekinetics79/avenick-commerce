"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { adminAdjustStock, describeAdminFailure } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";

const adjustInput = z.object({
  stockId: z.string().trim().regex(RECORD_ID, "Invalid stock reference"),
  newQty: z.coerce.number({ invalid_type_error: "Enter the new on-hand quantity" }).int("On-hand must be a whole number").min(0, "On-hand cannot be negative").max(1_000_000_000, "On-hand is unrealistically large"),
  reason: z.string().trim().min(3, "Say why the count changed (stocktake, damage, receipt…)").max(500, "Keep the reason under 500 characters"),
  reference: z.string().trim().max(120, "Keep the reference under 120 characters").optional().transform((value) => (value ? value : undefined)),
});

export async function adjustStockAction(input: { stockId: string; newQty: string | number; reason: string; reference?: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const parsed = adjustInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input", field: issue?.path[0]?.toString() };
  }
  const { data } = parsed;
  let result: { previousQty: number; qty: number };
  try {
    result = await adminAdjustStock({ stockId: data.stockId, newQty: data.newQty, reason: data.reason, reference: data.reference, actorId: userId });
  } catch (error) {
    log.error("admin stock adjustment failed", error, { scope: "warehouse.adjust", stockId: data.stockId });
    const field = (error as { field?: string } | null)?.field;
    return { ok: false, error: describeAdminFailure(error, "Could not adjust stock; reload and retry"), field };
  }
  revalidatePath("/warehouse/stock");
  revalidatePath("/warehouse");
  return { ok: true, message: `On-hand ${result.previousQty} → ${result.qty}` };
}
