import { AuditAction, Prisma, type OrderStatus } from "@prisma/client";
import { db } from "../index";
import { inventoryStockIdentityWhere } from "./checkout-invariants";

const SELLER_FULFILLMENT: OrderStatus[] = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
const RANK = new Map(SELLER_FULFILLMENT.map((status, index) => [status, index]));

function rank(status: OrderStatus) {
  return RANK.get(status) ?? -1;
}

/**
 * Advance only one seller's lines inside a marketplace order. The parent order
 * is derived from the least-advanced seller line, so a single seller can never
 * declare another seller's items shipped/delivered.
 */
export async function advanceSellerOrderItems(input: {
  orderId: string;
  sellerId: string;
  status: Extract<OrderStatus, "CONFIRMED" | "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED">;
  actorId: string;
  message?: string;
}) {
  if (!SELLER_FULFILLMENT.includes(input.status)) throw new Error("Unsupported seller fulfillment status");

  return db.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-fulfillment:${input.orderId}`}))`,
    );

    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });
    if (!order) throw new Error("Order not found");
    if (!SELLER_FULFILLMENT.includes(order.status)) {
      throw new Error(`Order is not released for seller fulfillment (${order.status})`);
    }

    const sellerItems = order.items.filter((item) => item.sellerId === input.sellerId);
    if (sellerItems.length === 0) throw new Error("Order does not contain items for this seller");

    const targetRank = rank(input.status);
    for (const item of sellerItems) {
      const currentRank = rank(item.status);
      if (currentRank < 0) throw new Error(`Line ${item.sku} is not in a seller-fulfillment state`);
      if (targetRank < currentRank) {
        throw new Error(`Cannot move ${item.sku} backward from ${item.status} to ${input.status}`);
      }
    }

    // Reservation is consumed once, when each seller line first crosses from a
    // pre-shipment state into SHIPPED or beyond. The advisory lock prevents two
    // seller requests from consuming the same reservation concurrently.
    for (const item of sellerItems) {
      if (rank(item.status) < rank("SHIPPED") && targetRank >= rank("SHIPPED")) {
        let remaining = item.quantity;
        const rows = await tx.inventoryStock.findMany({
          where: inventoryStockIdentityWhere(item.productId, item.variantId),
          orderBy: { updatedAt: "asc" },
        });
        for (const stock of rows) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, stock.reservedQty);
          if (take <= 0) continue;
          await tx.inventoryStock.update({
            where: { id: stock.id },
            data: { reservedQty: { decrement: take }, qty: { decrement: take } },
          });
          await tx.inventoryMovement.create({
            data: {
              stockId: stock.id,
              type: "OUT",
              qty: take,
              reference: order.orderNumber,
              notes: `Seller line ${item.sku} shipped — reservation consumed`,
              createdBy: input.actorId,
            },
          });
          remaining -= take;
        }
        if (remaining > 0) {
          throw new Error(`Reserved inventory is incomplete for ${item.sku}; fulfillment was not applied`);
        }
      }
    }

    await tx.orderItem.updateMany({
      where: { orderId: order.id, sellerId: input.sellerId },
      data: { status: input.status },
    });

    const refreshed = await tx.orderItem.findMany({
      where: { orderId: order.id },
      select: { status: true },
    });
    const fulfillmentRanks = refreshed.map((item) => rank(item.status));
    const allFulfillmentStates = fulfillmentRanks.every((value) => value >= 0);
    const aggregateStatus = allFulfillmentStates
      ? SELLER_FULFILLMENT[Math.min(...fulfillmentRanks)]!
      : order.status;

    let updatedOrder = order;
    if (aggregateStatus !== order.status) {
      updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: aggregateStatus },
        include: { items: true },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: aggregateStatus,
          message: input.message ?? `Seller fulfillment aggregate advanced to ${aggregateStatus}`,
          actorId: input.actorId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        sellerId: input.sellerId,
        entityType: "OrderSellerFulfillment",
        entityId: order.id,
        action: AuditAction.STATUS_CHANGE,
        before: { sellerId: input.sellerId, lineStatuses: sellerItems.map((item) => ({ id: item.id, sku: item.sku, status: item.status })) },
        after: { sellerId: input.sellerId, lineStatus: input.status, aggregateOrderStatus: aggregateStatus },
      },
    });

    return updatedOrder;
  });
}
