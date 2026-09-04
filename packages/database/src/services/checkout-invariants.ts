import { Prisma, type UserRole } from "@prisma/client";

type InventoryLockClient = Pick<Prisma.TransactionClient, "$executeRaw">;
type CommercialLockClient = Pick<Prisma.TransactionClient, "$executeRaw">;

/** Company governance is always acquired before user and catalog fences. */
export async function lockCompanyApprovalRows(
  tx: CommercialLockClient,
  companyIds: string[],
): Promise<void> {
  for (const companyId of [...new Set(companyIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`company-approval:${companyId}`}))`,
    );
  }
}

/** Tenant registry changes serialize with route resolution and activation. */
export async function lockIntegrationRegistry(
  tx: CommercialLockClient,
  tenantKey = "default",
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-registry:${tenantKey}`}))`,
  );
}

/** Company route changes serialize with order commit. */
export async function lockCompanyIntegrationRoutes(
  tx: CommercialLockClient,
  companyIds: string[],
): Promise<void> {
  for (const companyId of [...new Set(companyIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-route:${companyId}`}))`,
    );
  }
}

/** Connection activation and route consumers use the same deterministic fence. */
export async function lockIntegrationConnections(
  tx: CommercialLockClient,
  connectionIds: string[],
): Promise<void> {
  for (const connectionId of [...new Set(connectionIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`integration-connection:${connectionId}`}))`,
    );
  }
}

/** User activation/deletion decisions share this fence with order commit. */
export async function lockUserCommerceRows(
  tx: CommercialLockClient,
  userIds: string[],
): Promise<void> {
  for (const userId of [...new Set(userIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`user-commerce:${userId}`}))`,
    );
  }
}

/** Lock and resolve current platform-admin authority inside the mutation transaction. */
export async function requireCurrentAdminActor(
  tx: Pick<Prisma.TransactionClient, "$executeRaw" | "user">,
  actorId: string,
  requiredRole?: Extract<UserRole, "ADMIN" | "SUPER_ADMIN">,
  additionalUserIds: string[] = [],
) {
  await lockUserCommerceRows(tx, [actorId, ...additionalUserIds]);
  const actor = await tx.user.findUnique({
    where: { id: actorId }, select: { id: true, role: true, status: true, deletedAt: true },
  });
  if (!actor || actor.status !== "ACTIVE" || actor.deletedAt || !["ADMIN", "SUPER_ADMIN"].includes(actor.role)
    || (requiredRole && actor.role !== requiredRole)) {
    throw new Error(requiredRole === "SUPER_ADMIN" ? "Current super admin authority is required" : "Current admin authority is required");
  }
  return actor;
}

/** Resolve current seller organization and capability after locking the actor. */
export async function requireCurrentSellerActor(
  tx: Pick<Prisma.TransactionClient, "$executeRaw" | "user">,
  actorId: string,
  sellerId: string,
  required: string | readonly string[],
) {
  await lockUserCommerceRows(tx, [actorId]);
  await lockSellerCommercialRows(tx, [sellerId]);
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    include: {
      sellerProfile: { select: { id: true, status: true, deletedAt: true } },
      sellerMemberships: { include: { seller: { select: { status: true, deletedAt: true } } } },
    },
  });
  if (!actor || actor.status !== "ACTIVE" || actor.deletedAt) throw new Error("Current seller authority is required");
  if (actor.role === "SELLER_OWNER" && actor.sellerProfile?.id === sellerId
    && actor.sellerProfile.status === "ACTIVE" && !actor.sellerProfile.deletedAt) return actor;
  const membership = actor.sellerMemberships.find((row) => row.sellerId === sellerId);
  const permissions = typeof required === "string" ? [required] : [...new Set(required)];
  const hasRequired = membership?.permissions.includes("*")
    || permissions.every((permission) => membership?.permissions.includes(permission));
  if (actor.role !== "SELLER_STAFF" || !membership?.isActive || membership.seller.status !== "ACTIVE"
    || membership.seller.deletedAt || !hasRequired) {
    throw new Error(`Current seller permission required: ${permissions.join(" and ")}`);
  }
  return actor;
}

/**
 * Product publication, channel, variant, MOQ, and price writers share this
 * transaction-scoped lock with checkout. Sorting prevents multi-product carts
 * and bulk seller mutations from acquiring the same locks in opposite orders.
 */
export async function lockProductCommercialRows(
  tx: CommercialLockClient,
  productIds: string[],
): Promise<void> {
  for (const productId of [...new Set(productIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`product-commercial:${productId}`}))`,
    );
  }
}

/** Seller activation/deletion decisions participate in the same checkout fence. */
export async function lockSellerCommercialRows(
  tx: CommercialLockClient,
  sellerIds: string[],
): Promise<void> {
  for (const sellerId of [...new Set(sellerIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`seller-commercial:${sellerId}`}))`,
    );
  }
}

/** Stable pilot keys serialize concurrent imports before database IDs exist. */
export async function lockPilotSellerKeys(
  tx: CommercialLockClient,
  sellerKeys: string[],
): Promise<void> {
  for (const sellerKey of [...new Set(sellerKeys)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`pilot-seller-key:${sellerKey}`}))`,
    );
  }
}

/**
 * All stock writers lock the same physical rows in deterministic order. The
 * identity includes product/variant/location through the immutable stock id.
 */
export async function lockInventoryStockRows(
  tx: InventoryLockClient,
  stockIds: string[],
): Promise<void> {
  for (const stockId of [...new Set(stockIds)].sort()) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`inventory-stock:${stockId}`}))`,
    );
  }
}

/**
 * Generic cart checkout must never consume a governed purchase order. Approved
 * POs are placed only by placeGovernedPurchaseOrder, which uses their immutable
 * approved lines and a PO-scoped idempotency key.
 */
export function assertGenericCheckoutHasNoPurchaseOrder(purchaseOrderId?: string): void {
  if (purchaseOrderId) {
    throw new Error("Purchase orders must be placed through the governed purchase-order workflow");
  }
}

/** B2B price access and order creation are exclusive to the governed PO path. */
export function assertGovernedB2BCheckout(
  type: "B2C" | "B2B",
  purchaseOrderId?: string,
  hasGovernedCommercialTerms = false,
): void {
  if (type === "B2B" && (!purchaseOrderId || !hasGovernedCommercialTerms)) {
    throw new Error("B2B orders must be created through the governed purchase-order workflow");
  }
}

/** Preserve an explicitly configured zero rate; only absent rates use fallback. */
export function resolveConfiguredVatRate(
  configuredRate: Prisma.Decimal | number | string | null | undefined,
  fallbackRate: number,
): number {
  if (configuredRate == null) return fallbackRate;
  const rate = Number(configuredRate);
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Configured VAT rate is invalid");
  return rate;
}

/**
 * Inventory identity is product + exact variant. Prisma omits undefined fields,
 * so base-SKU stock must be selected with an explicit SQL NULL predicate.
 */
export function inventoryStockIdentityWhere(
  productId: string,
  variantId?: string | null,
): Prisma.InventoryStockWhereInput {
  return { productId, variantId: variantId ?? null };
}

export function assertRequiredVariantSelection(
  productName: string,
  variants: Array<{ id: string; isActive: boolean }>,
  variantId?: string,
): void {
  if (!variantId && variants.some((variant) => variant.isActive)) {
    throw new Error(`Select a product variant for "${productName}"`);
  }
}

export function assertMinimumOrderQuantity(productName: string, quantity: number, moq: number): void {
  if (!Number.isInteger(quantity) || quantity < Math.max(1, moq)) {
    throw new Error(`Minimum order quantity for "${productName}" is ${Math.max(1, moq)}`);
  }
}

const money = (value: number) => Number(value.toFixed(2));

export interface OrderTotals {
  /** Goods, net of VAT, before discount. */
  subtotal: number;
  discountAmount: number;
  /** VAT on the goods, after discount. */
  goodsVatAmount: number;
  /** Delivery, net of VAT. */
  shippingAmount: number;
  /** VAT on the delivery, at the order's place-of-supply rate. */
  shippingVatAmount: number;
  /** What the invoice declares as tax: goods VAT plus delivery VAT. */
  vatAmount: number;
  total: number;
}

/**
 * Assemble the money on an order, in one place, as arithmetic that needs no
 * database to check.
 *
 * This lives here rather than inline in createOrder because it is the figure
 * the buyer is charged and the figure the VAT return is built from, and it was
 * wrong: the total was `goods + goodsVat + shipping`, which adds delivery AFTER
 * tax and so never taxes it. Delivery this platform prices and charges is part
 * of the consideration for the supply, so it carries the destination's VAT at
 * the same statutory rate the goods do.
 *
 * That was a silent wrong answer — every figure on the order agreed with every
 * other, the buyer was undercharged, and the understated vatAmount was
 * persisted for invoicing and settlement to read. Arithmetic with that
 * consequence should not be reachable only through a live checkout, so it is a
 * pure function with its own cases.
 *
 * A zero-rated jurisdiction needs no special case: the rate table carries 0 for
 * QA and KW, and 0% of the freight is 0.
 */
export function composeOrderTotals(input: {
  subtotal: number;
  discountAmount: number;
  goodsVatAmount: number;
  shippingAmount: number;
  /** The order's place-of-supply VAT rate, as a percentage (5 means 5%). */
  vatRatePercent: number;
}): OrderTotals {
  const subtotal = money(input.subtotal);
  const discountAmount = money(input.discountAmount);
  const goodsVatAmount = money(input.goodsVatAmount);
  const shippingAmount = money(input.shippingAmount);
  const shippingVatAmount = money(shippingAmount * (input.vatRatePercent / 100));
  const vatAmount = money(goodsVatAmount + shippingVatAmount);
  return {
    subtotal,
    discountAmount,
    goodsVatAmount,
    shippingAmount,
    shippingVatAmount,
    vatAmount,
    // Rounded once at the end from already-rounded parts, so the total always
    // equals the sum of the lines an invoice prints. Rounding the sum of
    // unrounded parts is how a receipt ends up a fil off from its own rows.
    total: money(subtotal - discountAmount + goodsVatAmount + shippingAmount + shippingVatAmount),
  };
}

/** The goods half of an order, which is what a governed PO snapshot approves. */
export function merchandiseTotalOf(totals: OrderTotals): number {
  return money(totals.subtotal - totals.discountAmount + totals.goodsVatAmount);
}
