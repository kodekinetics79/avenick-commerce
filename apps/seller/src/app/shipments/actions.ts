"use server";

import { revalidatePath } from "next/cache";
import { requireSellerSession } from "@/lib/auth";
import { db } from "@avenick/database";

const NEXT: Record<string, string> = {
  PENDING: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function advanceShipment(id: string) {
  const { seller } = await requireSellerSession();
  const sh = await db.shipment.findUnique({ where: { id } });
  if (!sh || sh.sellerId !== seller.id) return;
  const next = NEXT[sh.status] as "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | undefined;
  if (!next) return;

  await db.$transaction([
    db.shipment.update({
      where: { id },
      data: {
        status: next,
        ...(sh.status === "PENDING" ? { shippedAt: new Date() } : {}),
        ...(next === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    }),
    db.shipmentEvent.create({
      data: { shipmentId: id, status: next, note: `Marked ${next.replace(/_/g, " ").toLowerCase()}` },
    }),
  ]);
  revalidatePath("/shipments");
}
