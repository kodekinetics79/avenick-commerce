import { db } from "../index";
import { write } from "../resilient-ops";
import type { Prisma, OrderStatus, Currency, PaymentMethod } from "@prisma/client";

// Prisma interactive-transaction client — the subset of the client available
// inside db.$transaction(async (tx) => ...). Lets commission accrual join an
// existing payment-confirmation transaction so money and its ledger commit as one.
type Tx = Prisma.TransactionClient;

/**
 * Accrue the platform's commission for every seller on a paid order, in the
 * same transaction that confirms payment. commission = lineTotal × the seller's
 * commissionRate, snapshotting the rate so later rate changes don't rewrite
 * history. Idempotent: if commissions already exist for this order (a webhook
 * replay, a MOCK re-confirm), it does nothing. Before this existed, the platform
 * never billed its take rate — the finance dashboard read an empty table.
 */
export async function accrueCommissions(tx: Tx, orderId: string): Promise<void> {
  const existing = await tx.commission.count({ where: { orderId } });
  if (existing > 0) return; // already accrued — replay-safe

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  // Sum line totals per seller (a marketplace order can span multiple sellers).
  const perSeller = new Map<string, Prisma.Decimal>();
  for (const item of order.items) {
    const prev = perSeller.get(item.sellerId);
    perSeller.set(item.sellerId, prev ? prev.add(item.total) : item.total);
  }

  for (const [sellerId, sellerTotal] of perSeller) {
    const profile = await tx.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { id: true, commissionRate: true },
    });
    if (!profile) continue; // seller row may key off userId in some paths; skip if unresolved
    const rate = profile.commissionRate; // Decimal, e.g. 5.00 (percent)
    const amount = sellerTotal.mul(rate).div(100);
    await tx.commission.create({
      data: {
        sellerId: profile.id,
        orderId: order.id,
        amount,
        rate,
        currency: order.currency,
      },
    });
  }
}

// Collision-resistant, human-readable order number.
// Time component (base36) guarantees monotonic uniqueness; random suffix
// avoids clashes within the same millisecond. Backed by a @unique column.
export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const time = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `AVN-${year}-${time}${rand}`;
}

export interface CreateOrderInput {
  userId: string;
  companyId?: string;
  type: "B2C" | "B2B";
  currency: Currency;
  // unitPrice is intentionally NOT accepted from the caller — prices are
  // resolved server-side from the catalog to prevent price tampering.
  items: { productId: string; variantId?: string; quantity: number; sellerId: string }[];
  shippingAddress: Record<string, string>;
  paymentMethod?: PaymentMethod;
  notes?: string;
  purchaseOrderId?: string;
  /** Client-supplied key: safe retries return the original order. */
  idempotencyKey?: string;
}

// VAT rate by jurisdiction (KSA 15%, rest of GCC 5%).
function vatRateForCurrency(currency: Currency): number {
  return currency === "SAR" ? 15 : 5;
}

// Pick the authoritative unit price for a product/quantity from active price
// tiers matching the order channel + currency. Highest applicable minQty wins
// (best volume tier the quantity qualifies for).
function resolveUnitPrice(
  prices: { type: string; currency: string; minQty: number; maxQty: number | null; price: Prisma.Decimal; isActive: boolean; vatRate: Prisma.Decimal }[],
  channel: "B2C" | "B2B",
  currency: Currency,
  quantity: number
) {
  const applicable = prices
    .filter((p) => p.isActive && p.type === channel && p.currency === currency && p.minQty <= quantity && (p.maxQty == null || quantity <= p.maxQty))
    .sort((a, b) => b.minQty - a.minQty);
  return applicable[0] ?? null;
}

export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) throw new Error("Order must contain at least one item");

  const defaultVat = vatRateForCurrency(input.currency);
  const productIds = [...new Set(input.items.map((i) => i.productId))];

  // Single authoritative read of catalog + pricing + stock.
  const products = await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    include: { prices: true, inventory: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Build server-priced line items (ignoring any client-supplied price).
  let subtotal = 0;
  let vatTotal = 0;
  const itemData = input.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} is unavailable`);

    const tier = resolveUnitPrice(product.prices, input.type, input.currency, item.quantity);
    if (!tier) throw new Error(`No active ${input.type} price for "${product.nameEn}" in ${input.currency}`);

    const unitPrice = Number(tier.price);
    const lineSubtotal = parseFloat((unitPrice * item.quantity).toFixed(2));
    const effectiveVat = Number(tier.vatRate) || defaultVat;
    const vatAmount = parseFloat((lineSubtotal * (effectiveVat / 100)).toFixed(2));

    subtotal += lineSubtotal;
    vatTotal += vatAmount;

    return {
      productId: item.productId,
      variantId: item.variantId,
      sellerId: item.sellerId,
      sku: product.sku,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      quantity: item.quantity,
      unitPrice,
      vatRate: effectiveVat,
      vatAmount,
      total: parseFloat((lineSubtotal + vatAmount).toFixed(2)),
    };
  });

  subtotal = parseFloat(subtotal.toFixed(2));
  const vatAmount = parseFloat(vatTotal.toFixed(2));
  const total = parseFloat((subtotal + vatAmount).toFixed(2));

  // Order creation + inventory reservation must be atomic. An oversell guard
  // runs inside the transaction so concurrent orders can't both reserve the
  // last unit.
  //
  // Wrapped in write() for timeout + circuit-breaker protection so a downed DB
  // fails fast instead of hanging the checkout. maxAttempts:1 — we deliberately
  // do NOT auto-retry this money path; idempotency is handled explicitly below,
  // and a blind retry could interact with a partially-committed transaction.
  return write(
    () =>
      db.$transaction(async (tx) => {
    for (const item of input.items) {
      const stockRows = await tx.inventoryStock.findMany({
        where: { productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}) },
        orderBy: { updatedAt: "asc" },
      });
      const available = stockRows.reduce((sum, s) => sum + (s.qty - s.reservedQty), 0);
      if (available < item.quantity) {
        const product = productMap.get(item.productId);
        throw new Error(`Insufficient stock for "${product?.nameEn ?? item.productId}" (${available} available, ${item.quantity} requested)`);
      }
      // Reserve greedily across rows. Each reservation is a CONDITIONAL atomic
      // update: it only succeeds while the row still has free stock at write
      // time (qty - reservedQty >= n), so two concurrent orders competing for
      // the last unit can't both win — the loser's updateMany matches 0 rows
      // and we retry the next row (or fail if none are left). The findMany read
      // above is only a fast-path/ordering hint, never the source of truth.
      let remaining = item.quantity;
      for (const s of stockRows) {
        if (remaining <= 0) break;
        const want = Math.min(remaining, s.qty - s.reservedQty);
        if (want <= 0) continue;
        const { count } = await tx.inventoryStock.updateMany({
          // reservedQty + want <= qty  ⇔  free stock still covers the reservation
          where: { id: s.id, reservedQty: { lte: s.qty - want } },
          data: { reservedQty: { increment: want } },
        });
        if (count === 1) remaining -= want;
        // count === 0 → another txn took this row's headroom; move on.
      }
      if (remaining > 0) {
        // Lost the race for the last unit(s) after re-checking every row.
        const product = productMap.get(item.productId);
        throw new Error(`Insufficient stock for "${product?.nameEn ?? item.productId}" (reserved by a concurrent order)`);
      }
    }

    return tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: input.userId,
        companyId: input.companyId,
        purchaseOrderId: input.purchaseOrderId,
        type: input.type,
        currency: input.currency,
        subtotal,
        vatAmount,
        total,
        paymentMethod: input.paymentMethod,
        shippingAddress: input.shippingAddress,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        items: { create: itemData },
        statusHistory: { create: { status: "PENDING_PAYMENT", message: "Order created, awaiting payment" } },
      },
      include: { items: true, statusHistory: true },
    });
  }).catch(async (e: unknown) => {
    // Concurrent retry with the same idempotency key: the unique constraint
    // fired after our pre-check. Return the winner's order.
    if (
      input.idempotencyKey &&
      typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
    ) {
      const existing = await db.order.findUnique({
        where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
        include: { items: true, statusHistory: true },
      });
        if (existing) return existing;
      }
      throw e;
    }),
    { name: "orders.create", config: { maxAttempts: 1 } },
  );
}

// Statuses in which an order's units have been reserved but not yet consumed.
// Reservation happens at order creation (PENDING_PAYMENT) and persists through
// fulfillment prep; it is consumed on SHIPPED and released on cancel/refund.
const RESERVED_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_CONFIRMED",
  "CONFIRMED",
  "PROCESSING",
];
const CONSUME_STATUSES: OrderStatus[] = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const RELEASE_STATUSES: OrderStatus[] = ["CANCELLED", "REFUNDED", "RETURNED"];

/**
 * Transition an order's status and settle its inventory side-effects atomically.
 *
 * Inventory correctness rules:
 *   • On the first move into a shipped/consumed state, the reserved units are
 *     CONSUMED: decrement both qty and reservedQty and write an OUT movement.
 *   • On the first move into a cancelled/refunded/returned state, the reserved
 *     units are RELEASED: decrement reservedQty and write a RELEASE movement.
 * Both are guarded by the current status so they run exactly once per order —
 * re-issuing the same status (or moving between two consumed states) is a no-op
 * on inventory. Previously this function wrote status only, so reservedQty was
 * never released or consumed and real sellable stock leaked permanently.
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus, actorId?: string, message?: string) {
  return db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!current) throw new Error("Order not found");

    const wasReserved = RESERVED_STATUSES.includes(current.status);
    const wasConsumed = CONSUME_STATUSES.includes(current.status);
    const nowConsume = CONSUME_STATUSES.includes(status);
    const nowRelease = RELEASE_STATUSES.includes(status);

    // Only settle inventory when crossing OUT of the reserved phase for the
    // first time. If units were already consumed or already released, do nothing.
    if (wasReserved && (nowConsume || nowRelease)) {
      for (const item of current.items) {
        let remaining = item.quantity;
        const rows = await tx.inventoryStock.findMany({
          where: { productId: item.productId, ...(item.variantId ? { variantId: item.variantId } : {}) },
          orderBy: { updatedAt: "asc" },
        });
        for (const s of rows) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, s.reservedQty);
          if (take <= 0) continue;
          await tx.inventoryStock.update({
            where: { id: s.id },
            data: nowConsume
              ? { reservedQty: { decrement: take }, qty: { decrement: take } }
              : { reservedQty: { decrement: take } },
          });
          await tx.inventoryMovement.create({
            data: {
              stockId: s.id,
              type: nowConsume ? "OUT" : "RELEASE",
              qty: take,
              reference: current.orderNumber,
              notes: nowConsume ? "Shipped — reservation consumed" : "Order closed — reservation released",
              createdBy: actorId,
            },
          });
          remaining -= take;
        }
      }
    }

    const order = await tx.order.update({ where: { id: orderId }, data: { status } });
    await tx.orderStatusHistory.create({ data: { orderId, status, message, actorId } });
    // Keep line items consistent so per-seller/status queries stay accurate.
    if (wasConsumed || wasReserved) {
      await tx.orderItem.updateMany({ where: { orderId }, data: { status } });
    }
    return order;
  });
}

export async function getOrdersForSeller(sellerId: string, params: { page?: number; limit?: number; status?: OrderStatus }) {
  const { page = 1, limit = 20, status } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.OrderWhereInput = {
    items: { some: { sellerId } },
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: { where: { sellerId }, include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } } },
        user: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { nameEn: true, nameAr: true } },
        statusHistory: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.order.count({ where }),
  ]);

  return { orders, total, page, limit, totalPages: Math.ceil(total / limit) };
}
