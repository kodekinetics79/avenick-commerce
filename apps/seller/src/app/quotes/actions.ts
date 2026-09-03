"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { RECORD_ID } from "@avenick/utils";
import { fetchSellerBackend } from "@/lib/backend";
import { z } from "zod";

export type QuoteActionState = { error?: string; ok?: boolean };

/**
 * Built per call rather than at module scope so the one refusal it states is
 * written in the caller's language; the shape and the rules are unchanged.
 *
 * `rfqId` is interpolated into a credentialed backend path — the shared
 * RECORD_ID guard (why it is stricter than zod's .cuid()) is documented in
 * @avenick/utils/record-id.
 */
function submitQuoteSchema(t: (key: string, values?: Record<string, string | number>) => string) {
  return z.object({
    rfqId: z.string().regex(RECORD_ID, t("quoteErrors.rfqNotIdentified")),
    notes: z.string().trim().max(1000).optional(),
    items: z
      .array(z.object({ itemId: z.string().min(1), unitQuoted: z.number().positive() }))
      .min(1),
  });
}

export async function submitQuoteAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const t = await getTranslations("sellerRelations");
  const schema = submitQuoteSchema(t);
  let payload: z.infer<ReturnType<typeof submitQuoteSchema>>;
  try {
    payload = schema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : t("quoteErrors.invalidPayload");
    return { error: message ?? t("quoteErrors.invalidPayload") };
  }

  try {
    // Encoding is the containment; the schema above is the guard. Keep both —
    // encodeURIComponent holds even if the id shape is ever widened.
    await fetchSellerBackend(`/api/seller/rfqs/${encodeURIComponent(payload.rfqId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: payload.items, notes: payload.notes }),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : t("quoteErrors.submitFailed") };
  }

  revalidatePath("/quotes");
  redirect("/quotes");
}
