import { db, Prisma } from "../index";

/** Overview KPIs for the warehouse module. */
export async function getWarehouseOverview() {
  const [warehouses, stockAgg, lowStockCount, movements24h, openShipments, processingOrders] =
    await Promise.all([
      db.warehouse.findMany({
        where: { isActive: true },
        include: {
          seller: { select: { businessNameEn: true } },
          locations: { select: { id: true, _count: { select: { stock: true } } } },
        },
        orderBy: { nameEn: "asc" },
      }),
      db.inventoryStock.aggregate({ _sum: { qty: true, reservedQty: true }, _count: { _all: true } }),
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM "InventoryStock" WHERE (qty - "reservedQty") <= "reorderPoint"`,
      db.inventoryMovement.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
      db.shipment.count({ where: { status: { in: ["PENDING", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] } } }),
      db.order.count({ where: { status: { in: ["CONFIRMED", "PROCESSING"] } } }),
    ]);

  return {
    warehouses,
    totalUnits: stockAgg._sum.qty ?? 0,
    reservedUnits: stockAgg._sum.reservedQty ?? 0,
    stockLines: stockAgg._count._all,
    lowStockCount: Number(lowStockCount[0]?.count ?? 0),
    movements24h,
    openShipments,
    processingOrders,
  };
}

/** Stock lines with product/location context; `lowOnly` filters to at/below reorder point. */
export async function getStockLines(filters: { page: number; limit: number; lowOnly?: boolean; search?: string }) {
  const where: Prisma.InventoryStockWhereInput = {
    ...(filters.search
      ? {
          OR: [
            { product: { nameEn: { contains: filters.search, mode: "insensitive" } } },
            { product: { sku: { contains: filters.search, mode: "insensitive" } } },
            { location: { code: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // Prisma can't compare two columns in a where clause; resolve low-stock ids first.
  if (filters.lowOnly) {
    const lowIds = await db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "InventoryStock" WHERE (qty - "reservedQty") <= "reorderPoint"`;
    where.id = { in: lowIds.map((r) => r.id) };
  }

  const [lines, total] = await Promise.all([
    db.inventoryStock.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        product: { select: { id: true, nameEn: true, sku: true, seller: { select: { businessNameEn: true } } } },
        variant: { select: { nameEn: true } },
        location: { select: { code: true, warehouse: { select: { nameEn: true, city: true } } } },
      },
    }),
    db.inventoryStock.count({ where }),
  ]);

  return { lines, total };
}

/** Inbound view: recent IN/ADJUSTMENT movements. */
export async function getInboundMovements(filters: { page: number; limit: number }) {
  const where: Prisma.InventoryMovementWhereInput = { type: { in: ["IN", "ADJUSTMENT"] } };
  const [movements, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        stock: {
          include: {
            product: { select: { nameEn: true, sku: true } },
            location: { select: { code: true, warehouse: { select: { nameEn: true } } } },
          },
        },
      },
    }),
    db.inventoryMovement.count({ where }),
  ]);
  return { movements, total };
}

/** Pick & pack queue: paid orders awaiting fulfilment, plus active shipments. */
export async function getPickPackQueue() {
  const [queue, shipments] = await Promise.all([
    db.order.findMany({
      where: { status: { in: ["CONFIRMED", "PROCESSING"] }, paymentStatus: "PAID" },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        items: { select: { id: true, nameEn: true, sku: true, quantity: true } },
        user: { select: { firstName: true, lastName: true } },
        shipments: { select: { id: true, status: true } },
      },
    }),
    db.shipment.findMany({
      where: { status: { in: ["PENDING", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] } },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        order: { select: { orderNumber: true } },
        seller: { select: { businessNameEn: true } },
      },
    }),
  ]);
  return { queue, shipments };
}
