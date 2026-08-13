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
