import { Prisma } from "@prisma/client";

type InventoryLockClient = Pick<Prisma.TransactionClient, "$executeRaw">;
type CommercialLockClient = Pick<Prisma.TransactionClient, "$executeRaw">;

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
