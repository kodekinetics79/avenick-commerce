import { AuditAction, db } from "../index";
import { lockInventoryStockRows } from "./checkout-invariants";

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
  if (!Number.isInteger(qty) || qty < 0) throw new Error("Inventory quantity must be a non-negative whole number");

  return db.$transaction(async (tx) => {
    await lockInventoryStockRows(tx, [stockId]);
    const stock = await tx.inventoryStock.findUnique({
      where: { id: stockId },
      include: {
        product: { select: { sellerId: true } },
        variant: { select: { product: { select: { sellerId: true } } } },
      },
    });
    if (!stock) throw new Error("Stock record not found");

    const newQty = type === "OUT" ? stock.qty - qty : type === "IN" ? stock.qty + qty : qty;
    if (newQty < stock.reservedQty) {
      throw new Error("Inventory quantity cannot be below reserved quantity");
    }
    const changed = await tx.inventoryStock.updateMany({
      where: { id: stock.id, qty: stock.qty, reservedQty: stock.reservedQty },
      data: { qty: newQty },
    });
    if (changed.count !== 1) throw new Error("Inventory changed concurrently; reload and retry");
    await tx.inventoryMovement.create({ data: { stockId, type, qty, reference, notes, createdBy: actorId } });
    await tx.auditLog.create({
      data: {
        actorId,
        sellerId: stock.product?.sellerId ?? stock.variant?.product.sellerId,
        entityType: "InventoryStock",
        entityId: stockId,
        action: AuditAction.UPDATE,
        before: { qty: stock.qty },
        after: { qty: newQty, movementType: type, quantity: qty, reference },
      },
    });
    return newQty;
  });
}
