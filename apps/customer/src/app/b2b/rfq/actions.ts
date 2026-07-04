"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fetchB2BJson, type B2BActionState } from "@/lib/b2b";
import { z } from "zod";

const RFQItemSchema = z.object({
  nameEn: z.string().trim().min(2).max(300),
  quantity: z.number().int().positive().max(1_000_000),
  notes: z.string().trim().max(500).optional(),
});

const CreateRFQSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  requiredBy: z.string().optional(),
  items: z.array(RFQItemSchema).min(1).max(50),
});

export async function submitRFQ(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  let payload: z.infer<typeof CreateRFQSchema>;
  try {
    payload = CreateRFQSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : "Invalid RFQ payload";
    return { error: message ?? "Invalid RFQ payload" };
  }

  const requiredBy = payload.requiredBy ? new Date(payload.requiredBy) : undefined;
  if (requiredBy && Number.isNaN(requiredBy.getTime())) {
    return { error: "Enter a valid required-by date" };
  }

  let rfq: { id: string };
  try {
    rfq = await fetchB2BJson<{ id: string }>("/api/b2b/rfqs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes: payload.notes,
        requiredBy: requiredBy?.toISOString(),
        items: payload.items,
      }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create RFQ." };
  }

  revalidatePath("/b2b/quotes");
  redirect(`/b2b/rfq/${rfq.id}`);
}

export async function acceptRFQQuote(id: string) {
  try {
    await fetchB2BJson(`/api/b2b/rfqs/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "ACCEPTED" }),
    });
  } catch {
    return;
  }
  revalidatePath(`/b2b/rfq/${id}`);
  revalidatePath("/b2b/quotes");
}

export async function rejectRFQQuote(id: string) {
  try {
    await fetchB2BJson(`/api/b2b/rfqs/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "REJECTED" }),
    });
  } catch {
    return;
  }
  revalidatePath(`/b2b/rfq/${id}`);
  revalidatePath("/b2b/quotes");
}
