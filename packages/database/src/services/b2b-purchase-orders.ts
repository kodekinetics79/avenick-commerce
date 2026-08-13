import type { Currency, Prisma } from "@prisma/client";
import { db } from "../index";
import { secureCreateOrder } from "./secure-checkout";

export interface PurchaseOrderLineInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

const money = (value: number) => Number(value.toFixed(2));

function selectPrice(
  prices: { id: string; type: string; currency: string; minQty: number; maxQty: number | null; price: Prisma.Decimal; vatRate: Prisma.Decimal; isActive: boolean }[],
  currency: Currency,
  quantity: number,
) {
  return prices
    .filter((price) =>
      price.isActive &&
      price.type === "B2B" &&
      price.currency === currency &&
      price.minQty <= quantity &&
      (price.maxQty == null || quantity <= price.maxQty),
    )
    .sort((a, b) => b.minQty - a.minQty)[0] ?? null;
}

async function pricePOLines(currency: Currency, requested: PurchaseOrderLineInput[]) {
  if (requested.length === 0) throw new Error("Purchase order must contain at least one product line");

  const normalized = new Map<string, PurchaseOrderLineInput>();
  for (const input of requested) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 100000) {
      throw new Error("Purchase-order quantity must be a positive whole number within the checkout limit");
    }
    const key = `${input.productId}::${input.variantId ?? ""}`;
    const current = normalized.get(key);
    const quantity = (current?.quantity ?? 0) + input.quantity;
    if (quantity > 100000) throw new Error("Combined purchase-order quantity exceeds the checkout limit");
    normalized.set(key, { productId: input.productId, variantId: input.variantId, quantity });
  }

  const inputs = [...normalized.values()];
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(inputs.map((item) => item.productId))] }, deletedAt: null },
    include: {
      prices: true,
      seller: { select: { id: true, status: true, deletedAt: true } },
      variants: { select: { id: true, isActive: true } },
    },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  let net = 0;
  let vat = 0;
  const lines = inputs.map((input) => {
    const product = productMap.get(input.productId);
    if (!product || product.status !== "ACTIVE" || !product.isB2BEnabled) {
      throw new Error(`Product ${input.productId} is not available for B2B purchasing`);
    }
    if (product.seller.status !== "ACTIVE" || product.seller.deletedAt) {
      throw new Error(`Seller for "${product.nameEn}" is unavailable`);
    }
    if (input.variantId) {
      const variant = product.variants.find((row) => row.id === input.variantId);
      if (!variant?.isActive) throw new Error(`Selected variant is unavailable for "${product.nameEn}"`);
    }

    const price = selectPrice(product.prices, currency, input.quantity);
    if (!price) throw new Error(`No active B2B ${currency} price for "${product.nameEn}"`);
    const unitPrice = Number(price.price);
    const lineSubtotal = money(unitPrice * input.quantity);
    const vatRate = Number(price.vatRate);
    const lineVat = money(lineSubtotal * vatRate / 100);
    net += lineSubtotal;
    vat += lineVat;

    return {
      productId: product.id,
      variantId: input.variantId,
      sellerId: product.sellerId,
      sku: product.sku,
      nameEn: product.nameEn,
      quantity: input.quantity,
      unitPrice,
      vatRate,
      lineSubtotal,
      priceSourceId: price.id,
      priceExplanation: {
        source: "LOCAL_CATALOG",
        channel: "B2B",
        currency,
        priceId: price.id,
        minQty: price.minQty,
        maxQty: price.maxQty,
      },
    };
  });

  return { lines, net: money(net), vat: money(vat), gross: money(net + vat) };
}

export async function createGovernedPurchaseOrder(input: {
  companyId: string;
  requesterId: string;
  requesterSpendLimit?: number | null;
  currency: Currency;
  items: PurchaseOrderLineInput[];
  notes?: string;
  requiredDate?: Date;
}) {
  const company = await db.company.findUnique({ where: { id: input.companyId } });
  if (!company || company.deletedAt || company.status !== "ACTIVE") {
    throw new Error("An active company account is required to create a purchase order");
  }

  const priced = await pricePOLines(input.currency, input.items);
  const policies = await db.approvalPolicy.findMany({
    where: { companyId: input.companyId, isActive: true, currency: input.currency },
    orderBy: { thresholdAmount: "asc" },
  });
  const matchingPolicy = policies.find((policy) => priced.gross >= Number(policy.thresholdAmount));
  const overRequesterLimit = input.requesterSpendLimit != null && priced.gross > input.requesterSpendLimit;
  const needsApproval = Boolean(matchingPolicy || overRequesterLimit);

  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  const poNumber = `PO-${new Date().getFullYear()}-${stamp}${random}`;

  return db.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        poNumber,
        companyId: input.companyId,
        requesterId: input.requesterId,
        status: needsApproval ? "PENDING_APPROVAL" : "APPROVED",
        currency: input.currency,
        total: priced.gross,
        requiredDate: input.requiredDate,
        notes: input.notes,
        items: {
          create: priced.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            sellerId: line.sellerId,
            sku: line.sku,
            nameEn: line.nameEn,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            vatRate: line.vatRate,
            lineSubtotal: line.lineSubtotal,
            priceSourceId: line.priceSourceId,
            priceExplanation: line.priceExplanation,
          })),
        },
      },
      include: { items: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.requesterId,
        entityType: "PurchaseOrder",
        entityId: purchaseOrder.id,
        action: "CREATE",
        after: {
          poNumber: purchaseOrder.poNumber,
          status: purchaseOrder.status,
          currency: purchaseOrder.currency,
          total: Number(purchaseOrder.total),
          lineCount: purchaseOrder.items.length,
          approvalReason: matchingPolicy
            ? `Policy ${matchingPolicy.name} threshold ${matchingPolicy.thresholdAmount}`
            : overRequesterLimit
              ? `Requester spend limit ${input.requesterSpendLimit}`
              : "AUTO_APPROVED",
        },
      },
    });
    return purchaseOrder;
  });
}

/**
 * Converts an approved line-based PO through the same hardened checkout service
 * used by direct orders. Header-only legacy POs are deliberately refused.
 */
export async function placeGovernedPurchaseOrder(input: {
  purchaseOrderId: string;
  companyId: string;
  actorId: string;
}) {
  const po = await db.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, companyId: input.companyId },
    include: { items: true, company: true },
  });
  if (!po) throw new Error("Purchase order not found");
  if (po.status === "ORDERED") {
    const existing = await db.order.findFirst({ where: { purchaseOrderId: po.id }, orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    throw new Error("Purchase order is marked ordered but has no linked order");
  }
  if (po.status !== "APPROVED") throw new Error("Only an approved purchase order can be placed");
  if (po.items.length === 0) {
    throw new Error("Legacy header-only purchase orders cannot be placed; recreate the PO with product lines");
  }

  // Re-read current B2B tiers before any stock reservation. If the approved
  // commercial snapshot changed, the PO returns to approval instead of silently
  // committing a different price.
  const current = await pricePOLines(
    po.currency,
    po.items.map((line) => ({ productId: line.productId, variantId: line.variantId ?? undefined, quantity: line.quantity })),
  );
  const currentByKey = new Map(current.lines.map((line) => [`${line.productId}::${line.variantId ?? ""}`, line]));
  const changed = po.items.find((approved) => {
    const now = currentByKey.get(`${approved.productId}::${approved.variantId ?? ""}`);
    return !now ||
      now.priceSourceId !== approved.priceSourceId ||
      Math.abs(now.unitPrice - Number(approved.unitPrice)) > 0.0001 ||
      Math.abs(now.vatRate - Number(approved.vatRate)) > 0.0001;
  });
  if (changed) {
    await db.$transaction([
      db.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: "PENDING_APPROVAL",
          approverId: null,
          rejectionReason: `Commercial terms changed for ${changed.sku}; reapproval required before placement`,
        },
      }),
      db.auditLog.create({
        data: {
          actorId: input.actorId,
          entityType: "PurchaseOrder",
          entityId: po.id,
          action: "STATUS_CHANGE",
          before: { status: "APPROVED", total: Number(po.total) },
          after: { status: "PENDING_APPROVAL", reason: "PRICE_CHANGED", sku: changed.sku, currentTotal: current.gross },
        },
      }),
    ]);
    throw new Error(`Price changed for ${changed.sku}; the purchase order has been returned for approval`);
  }

  const order = await secureCreateOrder({
    userId: po.requesterId,
    type: "B2B",
    currency: po.currency,
    items: po.items.map((line) => ({
      productId: line.productId,
      variantId: line.variantId ?? undefined,
      quantity: line.quantity,
    })),
    shippingAddress: {
      label: po.company.nameEn,
      line1: po.company.nameEn,
      city: po.company.city,
      country: po.company.country,
    },
    paymentMethod: "BANK_TRANSFER",
    notes: po.notes ?? undefined,
    purchaseOrderId: po.id,
    idempotencyKey: `po:${po.id}`,
  });

  await db.$transaction(async (tx) => {
    await tx.purchaseOrder.updateMany({
      where: { id: po.id, status: "APPROVED" },
      data: { status: "ORDERED" },
    });
    const paymentExists = await tx.payment.findFirst({ where: { orderId: order.id, method: "BANK_TRANSFER" } });
    if (!paymentExists) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: "BANK_TRANSFER",
          status: "UNPAID",
          amount: order.total,
          currency: order.currency,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        entityType: "PurchaseOrder",
        entityId: po.id,
        action: "STATUS_CHANGE",
        before: { status: "APPROVED" },
        after: {
          status: "ORDERED",
          orderId: order.id,
          orderNumber: order.orderNumber,
          approvedTotal: Number(po.total),
          placedTotal: Number(order.total),
        },
      },
    });
  });

  return order;
}
