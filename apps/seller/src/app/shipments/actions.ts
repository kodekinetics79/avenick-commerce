"use server";

import { revalidatePath } from "next/cache";
import { requireSellerPermission } from "@/lib/auth";
import { AuditAction, db, Prisma } from "@avenick/database";

const NEXT: Record<string, string> = {
  PENDING: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function advanceShipment(id: string) {
  const { seller, userId } = await requireSellerPermission("shipments.manage");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`shipment-transition:${id}`}))`);
    const sh = await tx.shipment.findFirst({ where: { id, sellerId: seller.id } });
    if (!sh) return;
    const next = NEXT[sh.status] as "PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | undefined;
    if (!next) return;
    await tx.shipment.update({
      where: { id },
      data: {
        status: next,
        ...(sh.status === "PENDING" ? { shippedAt: new Date() } : {}),
        ...(next === "DELIVERED" ? { deliveredAt: new Date() } : {}),
      },
    });
    await tx.shipmentEvent.create({
      data: { shipmentId: id, status: next, note: `Marked ${next.replace(/_/g, " ").toLowerCase()} by seller user ${userId}` },
    });
    await tx.auditLog.create({
      data: {
        actorId: userId,
        sellerId: seller.id,
        entityType: "Shipment",
        entityId: id,
        action: AuditAction.STATUS_CHANGE,
        before: { status: sh.status },
        after: { status: next },
      },
    });
  });
  revalidatePath("/shipments");
}
