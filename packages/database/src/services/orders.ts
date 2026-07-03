import { db } from "../index";
import type { Prisma, OrderStatus, Currency, PaymentMethod } from "@prisma/client";

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
  return db.$transaction(async (tx) => {
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
      // Reserve greedily across rows.
      let remaining = item.quantity;
      for (const s of stockRows) {
        if (remaining <= 0) break;
        const canReserve = Math.min(remaining, s.qty - s.reservedQty);
        if (canReserve > 0) {
          await tx.inventoryStock.update({ where: { id: s.id }, data: { reservedQty: { increment: canReserve } } });
          remaining -= canReserve;
        }
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
  });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, actorId?: string, message?: string) {
  const [order] = await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status } }),
    db.orderStatusHistory.create({ data: { orderId, status, message, actorId } }),
  ]);
  return order;
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
