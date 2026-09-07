export type ProductCardPurchaseAction =
  | "ADD_TO_CART"
  | "SELECT_VARIANT"
  | "REQUEST_AVAILABILITY"
  | "REQUEST_QUOTE";

/**
 * What the one control on a product row does.
 *
 *   out of stock             → request availability (RFQ), never the cart
 *   variants                 → the product page, where a real selection is made
 *   no price in this channel → request a quote (RFQ)
 *   otherwise                → an authoritative cart line at MOQ
 *
 * WHY `canPrice` IS AN ARGUMENT AND NOT AN AFTERTHOUGHT. It used to be neither:
 * this function decided from stock and variants alone, so a quote-only product —
 * which is most of this catalogue — resolved to ADD_TO_CART. The tile then
 * printed "Price on request" above a cart button it had to disable, and the
 * buyer's only control on the tile was permanently dead while the RFQ route that
 * would have worked sat one branch away, reachable only when the product
 * happened to be out of stock.
 *
 * The cart drawer's completionAction already made the correct decision, and its
 * comment claimed to make "the SAME decision the product card makes, in the same
 * order". That was false — it applied its own price check afterwards, so the
 * drawer offered a quote for a product whose tile showed a disabled cart. The
 * check lives here now, once, and that comment is true.
 *
 * `canPrice` means a cart line can actually be built: a price, a currency and a
 * VAT rate. Not "a number exists somewhere".
 */
export function productCardPurchaseAction(
  hasVariants: boolean,
  inStock = true,
  canPrice = true,
): ProductCardPurchaseAction {
  if (!inStock) return "REQUEST_AVAILABILITY";
  if (hasVariants) return "SELECT_VARIANT";
  return canPrice ? "ADD_TO_CART" : "REQUEST_QUOTE";
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
