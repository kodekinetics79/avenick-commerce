export type ProductCardPurchaseAction = "ADD_TO_CART" | "SELECT_VARIANT";

/** Variant-bearing list cards cannot create an authoritative cart line before selection. */
export function productCardPurchaseAction(hasVariants: boolean): ProductCardPurchaseAction {
  return hasVariants ? "SELECT_VARIANT" : "ADD_TO_CART";
}
