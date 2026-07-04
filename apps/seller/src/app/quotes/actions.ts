"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchSellerBackend } from "@/lib/backend";
import { z } from "zod";

export type QuoteActionState = { error?: string; ok?: boolean };

const SubmitQuoteSchema = z.object({
  rfqId: z.string().min(1),
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
    await fetchSellerBackend(`/api/seller/rfqs/${payload.rfqId}`, {
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
