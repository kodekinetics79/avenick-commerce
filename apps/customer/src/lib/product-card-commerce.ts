export type ProductCardPurchaseAction = "ADD_TO_CART" | "SELECT_VARIANT";

/** Variant-bearing list cards cannot create an authoritative cart line before selection. */
export function productCardPurchaseAction(hasVariants: boolean): ProductCardPurchaseAction {
  return hasVariants ? "SELECT_VARIANT" : "ADD_TO_CART";
}

export function productCardPricePresentation(price: number | undefined, hasVariants: boolean) {
  if (price == null) return "SEE_OPTIONS" as const;
  return hasVariants ? "FROM" as const : "EXACT" as const;
}

export function productCardReviewState(rating: number | undefined, reviewCount: number) {
  return rating != null && Number.isFinite(rating) && reviewCount > 0
    ? { kind: "RATED" as const, rating, reviewCount }
    : { kind: "UNRATED" as const };
}

export function storefrontProductHref(slug: string, context: { currency?: string; b2b?: boolean; variantId?: string; quantity?: number } = {}) {
  const params = new URLSearchParams();
  if (context.currency) params.set("currency", context.currency);
  if (context.b2b) params.set("b2b", "true");
  if (context.variantId) params.set("variantId", context.variantId);
  if (context.quantity && context.quantity > 0) params.set("qty", String(context.quantity));
  const query = params.toString();
  return `/products/${slug}${query ? `?${query}` : ""}`;
}
