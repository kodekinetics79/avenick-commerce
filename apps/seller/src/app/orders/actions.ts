"use server";

import { revalidatePath } from "next/cache";
import { requireSellerSession } from "@/lib/auth";
import { db, updateOrderStatus } from "@avenick/database";

const ALLOWED = ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export async function bulkUpdateOrderStatus(orderIds: string[], status: (typeof ALLOWED)[number]) {
  const { seller } = await requireSellerSession();
  if (!ALLOWED.includes(status) || orderIds.length === 0) return { count: 0 };

  // Only orders that actually contain this seller's items.
  const valid = await db.order.findMany({
    where: { id: { in: orderIds }, items: { some: { sellerId: seller.id } } },
    select: { id: true },
  });
  for (const o of valid) {
    await updateOrderStatus(o.id, status, seller.userId, `Bulk-updated to ${status.replace(/_/g, " ").toLowerCase()} by seller`);
  }
  revalidatePath("/orders");
  return { count: valid.length };
}
