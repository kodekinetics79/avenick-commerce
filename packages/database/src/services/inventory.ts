import { AuditAction, db } from "../index";

export async function getSellerInventory(sellerId: string, params: { page?: number; limit?: number; lowStock?: boolean }) {
  const { page = 1, limit = 50, lowStock } = params;
  const skip = (page - 1) * limit;

  const stocks = await db.inventoryStock.findMany({
    where: {
      product: { sellerId, deletedAt: null },
      // lowStock filter is applied post-query below when needed
    },
    skip,
    take: limit,
    include: {
      product: {
        select: { id: true, sku: true, nameEn: true, nameAr: true, status: true, images: { where: { isPrimary: true }, take: 1 } },
      },
      location: { include: { warehouse: { select: { nameEn: true, nameAr: true, type: true } } } },
    },
    orderBy: { qty: "asc" },
  });

  const mapped = stocks.map((s) => ({
    ...s,
    available: s.qty - s.reservedQty,
    isLow: s.qty - s.reservedQty <= s.reorderPoint,
    isOut: s.qty - s.reservedQty <= 0,
  }));

  return lowStock ? mapped.filter((s) => s.isLow) : mapped;
}

export async function adjustInventory(
  stockId: string,
  qty: number,
  type: "IN" | "OUT" | "ADJUSTMENT",
  actorId: string,
  reference?: string,
  notes?: string
) {
  if (!actorId) throw new Error("Inventory adjustment actor is required");
  const stock = await db.inventoryStock.findUnique({
    where: { id: stockId },
    include: { product: { select: { sellerId: true } } },
  });
  if (!stock) throw new Error("Stock record not found");

  const newQty = type === "OUT" ? stock.qty - qty : type === "IN" ? stock.qty + qty : qty;
  if (newQty < 0) throw new Error("Insufficient stock");

  await db.$transaction([
    db.inventoryStock.update({ where: { id: stockId }, data: { qty: newQty } }),
    db.inventoryMovement.create({ data: { stockId, type, qty, reference, notes, createdBy: actorId } }),
    db.auditLog.create({
      data: {
        actorId,
        sellerId: stock.product?.sellerId,
        entityType: "InventoryStock",
        entityId: stockId,
        action: AuditAction.UPDATE,
        before: { qty: stock.qty },
        after: { qty: newQty, movementType: type, quantity: qty, reference },
      },
    }),
  ]);

  return newQty;
}
