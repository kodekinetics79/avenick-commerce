import { db } from "../index";
import { write } from "../resilient-ops";
import { enforcePromotionRedemptionCapacity, evaluateCommercePromotions } from "./promotions";
import {
  assertMinimumOrderQuantity,
  inventoryStockIdentityWhere,
  lockInventoryStockRows,
  resolveConfiguredVatRate,
} from "./checkout-invariants";
import { assertMatchingIdempotencyFingerprint } from "./commerce-governance";
import type { Prisma, OrderStatus, Currency, PaymentMethod } from "@prisma/client";

// Prisma interactive-transaction client — the subset of the client available
// inside db.$transaction(async (tx) => ...). Lets commission accrual join an
// existing payment-confirmation transaction so money and its ledger commit as one.
type Tx = Prisma.TransactionClient;

/**
 * Accrue the platform's commission for every seller on a paid order in the same
 * transaction that confirms payment. Commission is based on merchandise value
 * EXCLUDING VAT; the previous implementation used OrderItem.total, which meant
 * the platform could collect commission on tax.
 */
export async function accrueCommissions(tx: Tx, orderId: string): Promise<void> {
  const existing = await tx.commission.count({ where: { orderId } });
  if (existing > 0) return; // already accrued — replay-safe

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  const perSeller = new Map<string, Prisma.Decimal>();
  for (const item of order.items) {
    const merchandiseNet = item.total.sub(item.vatAmount);
    const prev = perSeller.get(item.sellerId);
    perSeller.set(item.sellerId, prev ? prev.add(merchandiseNet) : merchandiseNet);
  }

  for (const [sellerId, sellerTotal] of perSeller) {
    const profile = await tx.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { id: true, commissionRate: true },
    });
    if (!profile) continue;
    const rate = profile.commissionRate;
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
  couponCode?: string;
  /** Client-supplied key: safe retries return the original order. */
  idempotencyKey?: string;
  /** Canonical server-derived representation bound to idempotencyKey. */
  requestFingerprint?: string;
  /** Internal PO-only terms proven under the governed placement lock. */
  governedCommercial?: {
    total: number;
    lines: Array<{
      productId: string;
      variantId?: string | null;
      sellerId: string;
      quantity: number;
      unitPrice: number;
      vatRate: number;
      sourcePriceId?: string | null;
      sku: string;
      nameEn: string;
    }>;
  };
}

// VAT rate by jurisdiction (KSA 15%, rest of GCC 5%).
function vatRateForCurrency(currency: Currency): number {
  return currency === "SAR" ? 15 : 5;
}

function resolveUnitPrice(
  prices: { id: string; type: string; currency: string; minQty: number; maxQty: number | null; price: Prisma.Decimal; isActive: boolean; vatRate: Prisma.Decimal }[],
  channel: "B2C" | "B2B",
  currency: Currency,
  quantity: number,
) {
  const applicable = prices
    .filter((p) => p.isActive && p.type === channel && p.currency === currency && p.minQty <= quantity && (p.maxQty == null || quantity <= p.maxQty))
    .sort((a, b) => b.minQty - a.minQty);
  return applicable[0] ?? null;
}

const money = (value: number) => Number(value.toFixed(2));
const identityKey = (value: { productId: string; variantId?: string | null; sellerId: string }) =>
  `${value.productId}::${value.variantId ?? ""}::${value.sellerId}`;

export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) throw new Error("Order must contain at least one item");
  if (input.governedCommercial && (input.type !== "B2B" || !input.purchaseOrderId || input.couponCode)) {
    throw new Error("Governed commercial terms require a B2B purchase-order placement without promotions");
  }

  const defaultVat = vatRateForCurrency(input.currency);
  const productIds = [...new Set(input.items.map((i) => i.productId))];

  // Single authoritative read of catalog + pricing + stock. ProductPrice is the
  // local commercial source until an ERP adapter returns a stronger price truth.
  const products = await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    include: {
      prices: true,
      inventory: true,
      variants: { include: { prices: true } },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const governedByIdentity = new Map(input.governedCommercial?.lines.map((line) => [
    identityKey(line), line,
  ]) ?? []);
  if (input.governedCommercial && governedByIdentity.size !== input.items.length) {
    throw new Error("Governed purchase-order lines do not match the checkout request");
  }

  const pricedLines = input.items.map((item, index) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} is unavailable`);
    assertMinimumOrderQuantity(product.nameEn, item.quantity, product.moq);
    const variant = item.variantId
      ? product.variants.find((candidate) => candidate.id === item.variantId)
      : undefined;
    const governed = governedByIdentity.get(identityKey(item));
    if (input.governedCommercial && (!governed || governed.quantity !== item.quantity)) {
      throw new Error("Governed purchase-order lines do not match the checkout request");
    }
    const variantTier = !governed && variant
      ? resolveUnitPrice(variant.prices, input.type, input.currency, item.quantity)
      : null;
    const tier = governed ? null : variantTier ?? resolveUnitPrice(product.prices, input.type, input.currency, item.quantity);
    if (!governed && !tier) throw new Error(`No active ${input.type} price for "${product.nameEn}" in ${input.currency}`);

    const unitPrice = governed?.unitPrice ?? Number(tier!.price);
    return {
      key: `line-${index}`,
      productId: item.productId,
      variantId: item.variantId,
      sellerId: item.sellerId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      sku: governed?.sku ?? variant?.sku ?? product.sku,
      nameEn: governed?.nameEn ?? variant?.nameEn ?? product.nameEn,
      nameAr: variant?.nameAr ?? product.nameAr,
      quantity: item.quantity,
      unitPrice,
      lineSubtotal: money(unitPrice * item.quantity),
      vatRate: governed?.vatRate ?? resolveConfiguredVatRate(tier!.vatRate, defaultVat),
      sourcePriceId: governed ? governed.sourcePriceId ?? undefined : tier!.id,
      priceScope: governed ? "GOVERNED_PO" : variantTier ? "VARIANT" : "PRODUCT",
    };
  });

  const promotion = input.governedCommercial ? {
    discountAmount: 0,
    lineDiscounts: {} as Record<string, number>,
    applied: [],
    explanation: [{ step: "GOVERNED_PO", purchaseOrderId: input.purchaseOrderId }],
  } : await evaluateCommercePromotions({
    tenantKey: "default",
    userId: input.userId,
    companyId: input.companyId,
    currency: input.currency,
    country: input.shippingAddress["country"],
    couponCode: input.couponCode,
    lines: pricedLines.map((line) => ({
      key: line.key,
      productId: line.productId,
      categoryId: line.categoryId,
      brandId: line.brandId,
      sellerId: line.sellerId,
      quantity: line.quantity,
      baseUnitPrice: line.unitPrice,
    })),
  });

  let subtotal = 0;
  let vatTotal = 0;
  const itemData = pricedLines.map((line) => {
    const lineDiscount = Math.min(promotion.lineDiscounts[line.key] ?? 0, line.lineSubtotal);
    const discountedSubtotal = money(line.lineSubtotal - lineDiscount);
    const vatAmount = money(discountedSubtotal * (line.vatRate / 100));
    subtotal += line.lineSubtotal;
    vatTotal += vatAmount;
    return {
      productId: line.productId,
      variantId: line.variantId,
      sellerId: line.sellerId,
      sku: line.sku,
      nameEn: line.nameEn,
      nameAr: line.nameAr,
      quantity: line.quantity,
      // Snapshot the pre-promotion commercial price; Order.discountAmount and
      // OrderLinePriceTrace preserve the governed adjustment separately.
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      vatAmount,
      total: money(discountedSubtotal + vatAmount),
    };
  });

  subtotal = money(subtotal);
  const discountAmount = money(promotion.discountAmount);
  const vatAmount = money(vatTotal);
  const total = money(subtotal - discountAmount + vatAmount);
  if (input.governedCommercial && Math.round(total * 100) !== Math.round(input.governedCommercial.total * 100)) {
    throw new Error("Governed purchase-order total does not match the approved commercial snapshot");
  }

  // If a live ERP connector exists, order creation records an explicit pending
  // integration state and durable outbox request. Local creation is never
  // mistaken for ERP acceptance.
  const erpConnection = input.type === "B2B"
    ? await db.integrationConnection.findFirst({
        where: { tenantKey: "default", status: "ACTIVE", system: { in: ["D365", "SAP", "ERP"] } },
        orderBy: { updatedAt: "desc" },
      })
    : null;

  return write(
    () =>
      db.$transaction(async (tx) => {
        const initialStockRows = await Promise.all(input.items.map((item) => tx.inventoryStock.findMany({
          where: inventoryStockIdentityWhere(item.productId, item.variantId),
          select: { id: true },
        })));
        await lockInventoryStockRows(tx, initialStockRows.flat().map((stock) => stock.id));

        for (const item of input.items) {
          // Re-read only after holding every involved row lock. CSV on-hand
          // changes and other checkouts therefore linearize before this read.
          const stockRows = await tx.inventoryStock.findMany({
            where: inventoryStockIdentityWhere(item.productId, item.variantId),
            orderBy: { updatedAt: "asc" },
          });
          const available = stockRows.reduce((sum, s) => sum + (s.qty - s.reservedQty), 0);
          if (available < item.quantity) {
            const product = productMap.get(item.productId);
            throw new Error(`Insufficient stock for "${product?.nameEn ?? item.productId}" (${available} available, ${item.quantity} requested)`);
          }

          let remaining = item.quantity;
          for (const s of stockRows) {
            if (remaining <= 0) break;
            const want = Math.min(remaining, s.qty - s.reservedQty);
            if (want <= 0) continue;
            const { count } = await tx.inventoryStock.updateMany({
              where: { id: s.id, qty: s.qty, reservedQty: s.reservedQty },
              data: { reservedQty: { increment: want } },
            });
            if (count === 1) remaining -= want;
          }
          if (remaining > 0) {
            const product = productMap.get(item.productId);
            throw new Error(`Insufficient stock for "${product?.nameEn ?? item.productId}" (reserved by a concurrent order)`);
          }
        }

        // Recheck promotion/coupon caps immediately before redemption evidence is
        // written. The calculation itself already validated eligibility; this
        // catches most stale usage-limit races without trusting browser state.
        if (promotion.applied.length > 0) {
          await enforcePromotionRedemptionCapacity(tx, {
            userId: input.userId,
            currency: input.currency,
            applied: promotion.applied,
          });
        }
        for (const applied of promotion.applied) {
          const rule = await tx.commercePromotion.findUnique({ where: { id: applied.promotionId } });
          if (!rule || rule.status !== "ACTIVE") throw new Error("Promotion changed while the order was being submitted");
          if (rule.usageLimit) {
            const usage = await tx.promotionRedemption.count({ where: { promotionId: rule.id } });
            if (usage >= rule.usageLimit) throw new Error("Promotion usage limit has been reached");
          }
          if (rule.perCustomerLimit) {
            const usage = await tx.promotionRedemption.count({ where: { promotionId: rule.id, userId: input.userId } });
            if (usage >= rule.perCustomerLimit) throw new Error("Promotion usage limit has been reached for this account");
          }
          if (applied.couponId) {
            const coupon = await tx.promotionCoupon.findUnique({ where: { id: applied.couponId } });
            if (!coupon || coupon.status !== "ACTIVE") throw new Error("Coupon changed while the order was being submitted");
            if (coupon.usageLimit) {
              const usage = await tx.promotionRedemption.count({ where: { couponId: coupon.id } });
              if (usage >= coupon.usageLimit) throw new Error("Coupon usage limit has been reached");
            }
            if (coupon.perCustomerLimit) {
              const usage = await tx.promotionRedemption.count({ where: { couponId: coupon.id, userId: input.userId } });
              if (usage >= coupon.perCustomerLimit) throw new Error("Coupon usage limit has been reached for this account");
            }
          }
        }

        const order = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: input.userId,
            companyId: input.companyId,
            purchaseOrderId: input.purchaseOrderId,
            type: input.type,
            currency: input.currency,
            subtotal,
            discountAmount,
            vatAmount,
            total,
            paymentMethod: input.paymentMethod,
            shippingAddress: input.shippingAddress,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.requestFingerprint,
            items: { create: itemData },
            statusHistory: {
              create: {
                status: "PENDING_PAYMENT",
                message: erpConnection
                  ? "Order created; payment and ERP validation are pending"
                  : "Order created, awaiting payment",
              },
            },
          },
          include: { items: true, statusHistory: true },
        });

        // Commercial price provenance. These snapshots make support/finance able
        // to reconstruct why the buyer saw a price even after price lists change.
        await tx.commercialPriceSnapshot.createMany({
          data: pricedLines.map((line) => ({
            tenantKey: "default",
            productId: line.productId,
            variantId: line.variantId,
            companyId: input.companyId,
            source: "LOCAL_CATALOG",
            sourceSystem: "AVENICK",
            sourceReference: line.sourcePriceId,
            currency: input.currency,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            explanation: {
              channel: input.type,
              priceId: line.sourcePriceId,
              quantity: line.quantity,
              promotions: promotion.applied,
            },
          })),
        });

        const createdByIdentity = new Map<string, typeof order.items>();
        for (const created of order.items) {
          const key = identityKey(created);
          const group = createdByIdentity.get(key) ?? [];
          group.push(created);
          createdByIdentity.set(key, group);
        }

        for (const line of pricedLines) {
          const key = identityKey(line);
          const created = createdByIdentity.get(key)?.shift();
          if (!created) throw new Error("Unable to correlate created order line for price trace");
          const lineDiscount = money(promotion.lineDiscounts[line.key] ?? 0);
          const finalUnitPrice = Number(((line.lineSubtotal - lineDiscount) / line.quantity).toFixed(4));
          await tx.orderLinePriceTrace.create({
            data: {
              orderItemId: created.id,
              currency: input.currency,
              contractPrice: line.unitPrice,
              promotionDiscount: lineDiscount,
              finalUnitPrice,
                sourceSystem: "AVENICK",
                explanation: {
                baseUnitPrice: line.unitPrice,
                lineSubtotal: line.lineSubtotal,
                discount: lineDiscount,
                  finalUnitPrice,
                  priceScope: line.priceScope,
                  variantId: line.variantId ?? null,
                applied: promotion.applied,
              },
            },
          });
        }

        for (const applied of promotion.applied) {
          await tx.promotionRedemption.create({
            data: {
              promotionId: applied.promotionId,
              couponId: applied.couponId,
              userId: input.userId,
              companyId: input.companyId,
              orderId: order.id,
              discountAmount: applied.discount,
              currency: input.currency,
            },
          });
        }

        if (erpConnection) {
          await tx.orderIntegrationState.create({
            data: {
              tenantKey: "default",
              orderId: order.id,
              system: erpConnection.system,
              state: "PENDING_VALIDATION",
            },
          });
          await tx.integrationOutbox.create({
            data: {
              tenantKey: "default",
              aggregateType: "ORDER",
              aggregateId: order.id,
              eventType: "ORDER_SUBMIT_REQUESTED",
              destination: erpConnection.system,
              connectionId: erpConnection.id,
              idempotencyKey: `order:${order.id}:${erpConnection.system}:submit`,
              payload: {
                orderId: order.id,
                orderNumber: order.orderNumber,
                companyId: input.companyId,
                currency: input.currency,
                subtotal,
                discountAmount,
                vatAmount,
                total,
                items: itemData.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  vatRate: item.vatRate,
                  total: item.total,
                })),
              },
            },
          });
        }

        return order;
      }).catch(async (e: unknown) => {
        if (
          input.idempotencyKey &&
          typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
        ) {
          const existing = await db.order.findUnique({
            where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
            include: { items: true, statusHistory: true },
          });
          if (existing) {
            if (!input.requestFingerprint) throw new Error("An idempotency request fingerprint is required");
            assertMatchingIdempotencyFingerprint(existing.requestFingerprint, input.requestFingerprint);
            return existing;
          }
        }
        throw e;
      }),
    { name: "orders.create", config: { maxAttempts: 1 } },
  );
}

// Statuses in which an order's units have been reserved but not yet consumed.
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
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus, actorId: string, message?: string) {
  if (!actorId) throw new Error("Order transition actor is required");
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

    if (wasReserved && (nowConsume || nowRelease)) {
      for (const item of current.items) {
        let remaining = item.quantity;
        const rows = await tx.inventoryStock.findMany({
          where: inventoryStockIdentityWhere(item.productId, item.variantId),
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
    if (wasConsumed || wasReserved) {
      await tx.orderItem.updateMany({ where: { orderId }, data: { status } });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        entityType: "Order",
        entityId: orderId,
        action: "STATUS_CHANGE",
        before: { status: current.status },
        after: { status, message },
      },
    });
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
