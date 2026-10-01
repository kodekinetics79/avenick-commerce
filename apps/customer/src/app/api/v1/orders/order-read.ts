import type { z } from "zod";

import type { OrderDetailSchema } from "@avenick/contracts";
import { db } from "@avenick/database";

import { toOrderDetail } from "./order-projection";

/**
 * ONE read of a placed order, used by `GET /v1/orders/{id}` and by the
 * confirmation `POST /v1/orders` returns.
 *
 * Shared rather than written twice on purpose: the two would otherwise drift,
 * and the screen a buyer lands on after paying would show a different order
 * from the one they open a day later. It also means the owner scoping —
 * `userId` inside the `where`, never a comparison afterwards — has exactly one
 * implementation to get right.
 */

/** The status history is capped by the contract; the newest are the useful ones. */
const MAX_STATUS_EVENTS = 200;

export const ORDER_DETAIL_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  type: true,
  currency: true,
  subtotal: true,
  discountAmount: true,
  shippingAmount: true,
  vatAmount: true,
  // Nullable and unwritten today. Read, never derived — see `order-projection.ts`.
  goodsVatAmount: true,
  shippingVatAmount: true,
  total: true,
  shippingAddress: true,
  notes: true,
  vatInvoiceUrl: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productId: true,
      variantId: true,
      sellerId: true,
      sku: true,
      nameEn: true,
      nameAr: true,
      quantity: true,
      unitPrice: true,
      vatRate: true,
      vatAmount: true,
      total: true,
      status: true,
      product: {
        select: {
          slug: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true, altEn: true } },
        },
      },
    },
  },
  shipments: {
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, status: true, carrier: true, trackingNumber: true, promisedBy: true },
  },
  statusHistory: {
    // Newest first for the cap, so a long-running order keeps its RECENT
    // history rather than only its first two hundred events...
    orderBy: { createdAt: "desc" },
    take: MAX_STATUS_EVENTS,
    select: { status: true, message: true, createdAt: true },
  },
} as const;

export async function readOrderDetail(input: {
  orderId: string;
  userId: string;
  origin: string;
}): Promise<z.infer<typeof OrderDetailSchema> | null> {
  const order = await db.order.findFirst({
    // Owner scoping is the PREDICATE. An order that is not this caller's is
    // never read, so there is no ownership branch that could be reordered away.
    where: { id: input.orderId, userId: input.userId },
    select: ORDER_DETAIL_SELECT,
  });
  if (!order) return null;

  // ...and reversed here, because a history is read forwards.
  return toOrderDetail({ ...order, statusHistory: [...order.statusHistory].reverse() }, input.origin);
}
