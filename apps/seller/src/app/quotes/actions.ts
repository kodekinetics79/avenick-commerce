"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RECORD_ID } from "@avenick/utils";
import { fetchSellerBackend } from "@/lib/backend";
import { z } from "zod";

export type QuoteActionState = { error?: string; ok?: boolean };

// `rfqId` is interpolated into a credentialed backend path — the shared
// RECORD_ID guard (why it is stricter than zod's .cuid()) is documented in
// @avenick/utils/record-id.
const RfqIdSchema = z
  .string()
  .regex(RECORD_ID, "That RFQ could not be identified — reopen it from the RFQ list.");

const SubmitQuoteSchema = z.object({
  rfqId: RfqIdSchema,
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(z.object({ itemId: z.string().min(1), unitQuoted: z.number().positive() }))
    .min(1),
});

export async function submitQuoteAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  let payload: z.infer<typeof SubmitQuoteSchema>;
  try {
    payload = SubmitQuoteSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid quote payload";
    return { error: message ?? "Invalid quote payload" };
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
    return { error: e instanceof Error ? e.message : "Failed to submit the quote" };
  }

  revalidatePath("/quotes");
  redirect("/quotes");
}
