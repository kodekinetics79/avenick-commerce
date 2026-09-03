"use server";

import { revalidatePath } from "next/cache";
import { requireSellerPermission } from "@/lib/auth";
import { db, advanceSellerOrderItems } from "@avenick/database";

const ALLOWED = ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export async function bulkUpdateOrderStatus(orderIds: string[], status: (typeof ALLOWED)[number]) {
  const { seller, userId } = await requireSellerPermission("orders.fulfill");
  if (!ALLOWED.includes(status) || orderIds.length === 0) return { count: 0 };

  // Resolve only orders containing this seller's own lines. The fulfillment
  // service updates those lines and derives the parent order from all sellers.
  const valid = await db.order.findMany({
    where: { id: { in: orderIds }, items: { some: { sellerId: seller.id } } },
    select: { id: true },
  });

  let updated = 0;
  for (const order of valid) {
    try {
      await advanceSellerOrderItems({
        orderId: order.id,
        sellerId: seller.id,
        status,
        actorId: userId,
        message: `Seller ${seller.businessNameEn} advanced its lines to ${status.replace(/_/g, " ").toLowerCase()}`,
      });
      updated += 1;
    } catch {
      // Keep the bulk action bounded: invalid/non-released orders are skipped
      // rather than allowing one bad row to advance unrelated orders.
    }
  }

  revalidatePath("/orders");
  return { count: updated };
}
