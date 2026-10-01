"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { fetchSellerBackend } from "@/lib/backend";
import { SellerQuotePayloadSchema, type SellerQuotePayload } from "@/lib/seller-quote-contract";

export type QuoteActionState = { error?: string; ok?: boolean };

/**
 * Built per call rather than at module scope so the one refusal it states is
 * written in the caller's language; the shape and the rules are unchanged.
 *
 * `rfqId` is interpolated into a credentialed backend path — the shared
 * RECORD_ID guard (why it is stricter than zod's .cuid()) is documented in
 * @avenick/utils/record-id.
 */
export async function submitQuoteAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const t = await getTranslations("sellerRelations");
  let payload: SellerQuotePayload;
  try {
    payload = SellerQuotePayloadSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch {
    return { error: t("quoteErrors.invalidPayload") };
  }

  try {
    // Encoding is the containment; the schema above is the guard. Keep both —
    // encodeURIComponent holds even if the id shape is ever widened.
    await fetchSellerBackend(`/api/seller/rfqs/${encodeURIComponent(payload.rfqId)}/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Backend and transport text is not a localized product message and can
    // include implementation detail. The page keeps every entered term and
    // gives the seller one stable, translated recovery instruction instead.
    return { error: t("quoteErrors.submitFailed") };
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/submit?rfq=${encodeURIComponent(payload.rfqId)}`);
  redirect(`/quotes/submit?rfq=${encodeURIComponent(payload.rfqId)}&submitted=1`);
}
