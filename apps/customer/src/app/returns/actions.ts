"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cookieHeaderFromStore, fetchBackendJsonWithCookies } from "@/lib/backend";
import { z } from "zod";

export type ReturnActionState = { error?: string; ok?: boolean; message?: string };

const CreateReturnSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().positive() })).min(1),
});

export async function createReturnRequest(
  _prev: ReturnActionState,
  formData: FormData,
): Promise<ReturnActionState> {
  try {
    const store = await cookies();
    const cookieHeader = cookieHeaderFromStore(store);

    const selectedIds = formData.getAll("orderItemId").map(String);
    const parsed = CreateReturnSchema.safeParse({
      orderId: formData.get("orderId"),
      reason: formData.get("reason"),
      notes: formData.get("notes") || undefined,
      items: selectedIds.map((orderItemId) => ({
        orderItemId,
        quantity: Number(formData.get(`quantity:${orderItemId}`)),
      })),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const result = await fetchBackendJsonWithCookies<{ message?: string }>(
      "/api/returns",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      },
      cookieHeader,
    );

    revalidatePath("/returns");
    // No review-time promise: the platform measures no returns SLA.
    return { ok: true, message: result.message ?? "Return request submitted. Track its review status below." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit return request." };
  }
}
