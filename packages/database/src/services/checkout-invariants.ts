import type { Prisma } from "@prisma/client";

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
