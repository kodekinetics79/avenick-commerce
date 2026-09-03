"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireAdminSession } from "@/lib/auth";
import { adminAdjustStock, describeAdminFailure } from "@avenick/database";
import { log } from "@avenick/observability";
import { RECORD_ID } from "@avenick/utils";
import type { ActionResult } from "@/app/approvals/actions";

/**
 * The refusal messages are read by the operator, so they are translated; the
 * schema is therefore built inside the request, where a translator exists.
 */
type Msg = (key: string, values?: Record<string, string | number>) => string;

const adjustInput = (t: Msg) =>
  z.object({
    stockId: z.string().trim().regex(RECORD_ID, t("invalidStockRef")),
    newQty: z.coerce
      .number({ invalid_type_error: t("enterQty") })
      .int(t("wholeNumber"))
      .min(0, t("notNegative"))
      .max(1_000_000_000, t("tooLarge")),
    reason: z.string().trim().min(3, t("reasonRequired")).max(500, t("reasonTooLong", { max: 500 })),
    reference: z
      .string()
      .trim()
      .max(120, t("referenceTooLong", { max: 120 }))
      .optional()
      .transform((value) => (value ? value : undefined)),
  });

export async function adjustStockAction(input: { stockId: string; newQty: string | number; reason: string; reference?: string }): Promise<ActionResult> {
  const { userId } = await requireAdminSession();
  const t = await getTranslations("adminCommerce.stockActions");
  const parsed = adjustInput(t).safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? t("invalidInput"), field: issue?.path[0]?.toString() };
  }
  const { data } = parsed;
  let result: { previousQty: number; qty: number };
  try {
    result = await adminAdjustStock({ stockId: data.stockId, newQty: data.newQty, reason: data.reason, reference: data.reference, actorId: userId });
  } catch (error) {
    log.error("admin stock adjustment failed", error, { scope: "warehouse.adjust", stockId: data.stockId });
    const field = (error as { field?: string } | null)?.field;
    return { ok: false, error: describeAdminFailure(error, t("failed")), field };
  }
  revalidatePath("/warehouse/stock");
  revalidatePath("/warehouse");
  return { ok: true, message: t("adjusted", { from: String(result.previousQty), to: String(result.qty) }) };
}
