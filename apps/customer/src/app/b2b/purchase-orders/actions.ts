"use server";

import { revalidatePath } from "next/cache";
import { fetchB2BJson, type B2BActionState } from "@/lib/b2b";

/**
 * Create a PO. If an active approval policy's threshold is met, it routes to
 * PENDING_APPROVAL; otherwise it's auto-approved.
 */
export async function createPO(_prev: B2BActionState, formData: FormData): Promise<B2BActionState> {
  const description = String(formData.get("description") ?? "").trim();
  const total = Number(String(formData.get("total") ?? "").trim());
  const requiredRaw = String(formData.get("requiredDate") ?? "").trim();
  if (!description) return { error: "Add a description." };
  if (!total || Number.isNaN(total) || total <= 0) return { error: "Enter a positive total amount." };

  let result: { message: string };
  try {
    result = await fetchB2BJson<{ message: string }>("/api/b2b/purchase-orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        description,
        total,
        requiredDate: requiredRaw || undefined,
      }),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to create purchase order." };
  }
  revalidatePath("/b2b/purchase-orders");
  revalidatePath("/b2b/approvals");
  return { ok: true, message: result.message };
}

async function transition(id: string, action: "approve" | "reject" | "order" | "cancel") {
  try {
    await fetchB2BJson(`/api/b2b/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
  } catch {
    return;
  }
  revalidatePath("/b2b/purchase-orders");
  revalidatePath("/b2b/approvals");
  revalidatePath("/b2b");
}

export async function approvePO(id: string) {
  await transition(id, "approve");
}

export async function rejectPO(id: string) {
  await transition(id, "reject");
}

/** Placing an approved PO creates a B2B order + tax invoice, then marks it ORDERED. */
export async function markOrdered(id: string) {
  await transition(id, "order");
  revalidatePath("/b2b/billing");
}

export async function cancelPO(id: string) {
  await transition(id, "cancel");
}
