import { Prisma } from "@prisma/client";
import { db } from "../client";

export type CustomerReturnSelection = { orderItemId: string; quantity: number };
const money = (value: number) => Number(value.toFixed(2));

function nextReturnNumber() {
  return `RET-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Create seller-isolated return requests for exactly the lines and quantities selected by the buyer. */
export async function createCustomerReturnRequests(input: {
  userId: string;
  orderId: string;
  reason: string;
  selections: CustomerReturnSelection[];
}) {
  if (input.selections.length === 0) throw new Error("RETURN_ITEMS_REQUIRED");
  const ids = input.selections.map((selection) => selection.orderItemId);
  if (new Set(ids).size !== ids.length) throw new Error("RETURN_ITEMS_DUPLICATE");

  return db.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`buyer-return:${input.orderId}`}))`);
    const order = await tx.order.findFirst({
      where: { id: input.orderId, userId: input.userId },
      include: {
        items: {
          where: { id: { in: ids } },
          select: { id: true, sellerId: true, quantity: true, total: true, vatAmount: true },
        },
        returnRequests: { where: { status: { not: "REJECTED" } }, select: { sellerId: true } },
      },
    });
    if (!order) throw new Error("RETURN_ORDER_NOT_FOUND");
    if (order.status !== "DELIVERED") throw new Error("RETURN_ORDER_NOT_DELIVERED");
    if (order.items.length !== ids.length) throw new Error("RETURN_ITEM_NOT_FOUND");

    const existingSellers = new Set(order.returnRequests.map((request) => request.sellerId));
    const selectedBySeller = new Map<string, Array<{
      orderItemId: string;
      quantity: number;
      netAmount: number;
      vatAmount: number;
      grossAmount: number;
    }>>();
    for (const selection of input.selections) {
      if (!Number.isInteger(selection.quantity) || selection.quantity <= 0) throw new Error("RETURN_QUANTITY_INVALID");
      const item = order.items.find((candidate) => candidate.id === selection.orderItemId)!;
      if (selection.quantity > item.quantity) throw new Error("RETURN_QUANTITY_EXCEEDS_PURCHASED");
      if (existingSellers.has(item.sellerId)) throw new Error("RETURN_ALREADY_OPEN");
      const grossAmount = money(Number(item.total) * selection.quantity / item.quantity);
      const vatAmount = money(Number(item.vatAmount) * selection.quantity / item.quantity);
      const netAmount = money(grossAmount - vatAmount);
      const entries = selectedBySeller.get(item.sellerId) ?? [];
      entries.push({ orderItemId: item.id, quantity: selection.quantity, netAmount, vatAmount, grossAmount });
      selectedBySeller.set(item.sellerId, entries);
    }

    const created = [];
    for (const [sellerId, selections] of selectedBySeller) {
      const refundAmount = money(selections.reduce((sum, selection) => sum + selection.grossAmount, 0));
      const request = await tx.returnRequest.create({
        data: {
          returnNumber: nextReturnNumber(),
          orderId: order.id,
          sellerId,
          reason: input.reason,
          status: "REQUESTED",
          refundAmount,
          items: { create: selections },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          sellerId,
          entityType: "ReturnRequest",
          entityId: request.id,
          action: "CREATE",
          after: { orderId: order.id, status: request.status, source: "CUSTOMER_REQUEST", selections, refundAmount },
        },
      });
      created.push(request);
    }
    return created;
  });
}
