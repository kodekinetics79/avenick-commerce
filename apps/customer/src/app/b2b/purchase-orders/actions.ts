"use server";

import { revalidatePath } from "next/cache";
import { fetchB2BJson } from "@/lib/b2b";

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

/** Place an approved line-based PO through governed checkout. */
export async function markOrdered(id: string) {
  await transition(id, "order");
  revalidatePath("/b2b/billing");
}

export async function cancelPO(id: string) {
  await transition(id, "cancel");
}
