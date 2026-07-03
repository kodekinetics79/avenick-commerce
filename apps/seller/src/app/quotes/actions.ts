"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { submitQuote } from "@avenick/database";
import { requireSellerSession } from "@/lib/auth";
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
  const { session, seller } = await requireSellerSession();

  let payload: z.infer<typeof SubmitQuoteSchema>;
  try {
    payload = SubmitQuoteSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid quote payload";
    return { error: message ?? "Invalid quote payload" };
  }

  try {
    await submitQuote({
      rfqId: payload.rfqId,
      sellerId: seller.id,
      actorId: (session.user as { id: string }).id,
      items: payload.items,
      notes: payload.notes,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to submit the quote" };
  }

  revalidatePath("/quotes");
  redirect("/quotes");
}
