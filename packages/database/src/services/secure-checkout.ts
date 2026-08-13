import type { Currency, PaymentMethod, UserRole } from "@prisma/client";
import { db } from "../index";
import { createOrder } from "./orders";
import { assertRequiredVariantSelection } from "./checkout-invariants";

const CUSTOMER_ROLES = new Set<UserRole>([
  "CONSUMER",
  "COMPANY_ADMIN",
  "COMPANY_BUYER",
  "COMPANY_APPROVER",
]);

export interface SecureCheckoutItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface SecureCheckoutInput {
  userId: string;
  type: "B2C" | "B2B";
  currency: Currency;
  items: SecureCheckoutItemInput[];
  shippingAddress: Record<string, string>;
  paymentMethod?: PaymentMethod;
  notes?: string;
  purchaseOrderId?: string;
  couponCode?: string;
  idempotencyKey?: string;
}

/**
 * Security boundary for customer checkout.
 *
 * Browser/cart state is intentionally treated as untrusted. In particular:
 *  - sellerId is derived from Product.sellerId, never accepted from the caller;
 *  - product publication/channel eligibility is re-checked at checkout;
 *  - products with active variants require an explicit active selection;
 *  - sellers must still be active;
 *  - B2B company identity is derived from the authenticated user's membership;
 *  - a B2B PO, when supplied, must belong to that same company and be approved;
 *  - duplicate cart lines are normalized before stock/pricing evaluation;
 *  - coupon text may be supplied, but every discount amount is server-derived.
 */
export async function secureCreateOrder(input: SecureCheckoutInput) {
  if (input.items.length === 0) throw new Error("Order must contain at least one item");

  const user = await db.user.findUnique({
    where: { id: input.userId },
    include: {
      companyMember: {
        include: { company: true },
      },
    },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") {
    throw new Error("Customer account is not active");
  }
  if (!CUSTOMER_ROLES.has(user.role)) {
    throw new Error("This account is not permitted to place customer orders");
  }

  let companyId: string | undefined;
  if (input.type === "B2B") {
    const member = user.companyMember;
    if (!member || !member.isActive || member.company.status !== "ACTIVE" || member.company.deletedAt) {
      throw new Error("An active verified company membership is required for B2B checkout");
    }
    companyId = member.companyId;

    if (input.purchaseOrderId) {
      const po = await db.purchaseOrder.findFirst({
        where: {
          id: input.purchaseOrderId,
          companyId,
          status: { in: ["APPROVED", "ORDERED"] },
        },
        select: { id: true },
      });
      if (!po) throw new Error("Purchase order is not approved for this company");
    }
  } else if (input.purchaseOrderId) {
    throw new Error("Purchase orders can only be used for B2B checkout");
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds }, deletedAt: null },
    select: {
      id: true,
      nameEn: true,
      sellerId: true,
      status: true,
      isB2CEnabled: true,
      isB2BEnabled: true,
      seller: { select: { status: true, deletedAt: true } },
      variants: { select: { id: true, isActive: true } },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const trustedByLine = new Map<string, { productId: string; variantId?: string; quantity: number; sellerId: string }>();

  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product || product.status !== "ACTIVE") {
      throw new Error(`Product ${item.productId} is unavailable`);
    }
    if (product.seller.status !== "ACTIVE" || product.seller.deletedAt) {
      throw new Error(`Seller for "${product.nameEn}" is unavailable`);
    }
    if (input.type === "B2B" && !product.isB2BEnabled) {
      throw new Error(`"${product.nameEn}" is not available for B2B ordering`);
    }
    if (input.type === "B2C" && !product.isB2CEnabled) {
      throw new Error(`"${product.nameEn}" is not available for B2C ordering`);
    }

    assertRequiredVariantSelection(product.nameEn, product.variants, item.variantId);
    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant || !variant.isActive) {
        throw new Error(`Selected variant is unavailable for "${product.nameEn}"`);
      }
    }

    const key = `${item.productId}::${item.variantId ?? ""}`;
    const existing = trustedByLine.get(key);
    const quantity = (existing?.quantity ?? 0) + item.quantity;
    if (quantity > 100000) throw new Error(`Requested quantity for "${product.nameEn}" exceeds checkout limit`);
    trustedByLine.set(key, {
      productId: item.productId,
      variantId: item.variantId,
      quantity,
      sellerId: product.sellerId,
    });
  }

  return createOrder({
    userId: input.userId,
    companyId,
    type: input.type,
    currency: input.currency,
    items: [...trustedByLine.values()],
    shippingAddress: input.shippingAddress,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    purchaseOrderId: input.purchaseOrderId,
    couponCode: input.couponCode?.trim() || undefined,
    idempotencyKey: input.idempotencyKey,
  });
}
