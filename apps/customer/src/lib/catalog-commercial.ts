export type StorefrontPrice = {
  type: string;
  currency: string;
  minQty: number;
  maxQty: number | null;
  price: unknown;
  vatRate: unknown;
};

export type StorefrontVariant = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  attributes: unknown;
  prices: StorefrontPrice[];
  inStock: boolean;
};

export type StorefrontProduct = {
  id: string;
  sellerId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  prices: StorefrontPrice[];
  inventory: Array<{ inStock: boolean }>;
  variants: StorefrontVariant[];
};

const money = (value: number) => Number(value.toFixed(2));

/** Resolve the exact selector identity and applicable server-published tier. */
export function resolveStorefrontSelection(
  product: StorefrontProduct,
  variantId: string | undefined,
  quantity: number,
  preferredCurrency = "AED",
) {
  const variant = variantId ? product.variants.find((candidate) => candidate.id === variantId) : undefined;
  if (product.variants.length > 0 && !variant) return null;
  const variantApplicable = (variant?.prices ?? []).filter((price) =>
    price.minQty <= quantity && (price.maxQty == null || quantity <= price.maxQty),
  );
  const productApplicable = product.prices.filter((price) =>
    price.minQty <= quantity && (price.maxQty == null || quantity <= price.maxQty),
  );
  const currency = [...variantApplicable, ...productApplicable].some((price) => price.currency === preferredCurrency)
    ? preferredCurrency
    : variantApplicable[0]?.currency ?? productApplicable[0]?.currency;
  // Match authoritative checkout: resolve the selected variant tier first for
  // the checkout currency/quantity, then deliberately fall back to base price.
  const bestTier = (prices: StorefrontPrice[]) => prices
    .filter((price) => price.currency === currency)
    .sort((a, b) => b.minQty - a.minQty)[0];
  const tier = bestTier(variantApplicable) ?? bestTier(productApplicable);
  if (!tier) return null;
  const unitPrice = Number(tier.price);
  const vatRate = Number(tier.vatRate);
  if (!Number.isFinite(unitPrice) || !Number.isFinite(vatRate) || vatRate < 0) return null;
  return {
    variantId: variant?.id,
    sku: variant?.sku ?? product.sku,
    nameEn: variant?.nameEn ?? product.nameEn,
    nameAr: variant?.nameAr ?? product.nameAr,
    attributes: variant?.attributes,
    currency: tier.currency,
    unitPrice,
    vatRate,
    vatPerUnit: money(unitPrice * vatRate / 100),
    grossTotal: money(unitPrice * quantity * (1 + vatRate / 100)),
    inStock: variant?.inStock ?? product.inventory[0]?.inStock === true,
  };
}

export function toStorefrontCartLine(
  product: StorefrontProduct,
  selection: NonNullable<ReturnType<typeof resolveStorefrontSelection>>,
  quantity: number,
  imageUrl?: string,
) {
  return {
    productId: product.id,
    variantId: selection.variantId,
    nameEn: selection.nameEn,
    nameAr: selection.nameAr,
    imageUrl,
    sku: selection.sku,
    qty: quantity,
    unitPrice: selection.unitPrice,
    vatRate: selection.vatRate,
    sellerId: product.sellerId,
    currency: selection.currency,
  };
}

export function toStorefrontWishlistItem(
  product: StorefrontProduct,
  slug: string,
  selection: NonNullable<ReturnType<typeof resolveStorefrontSelection>>,
  quantity: number,
  imageUrl?: string,
) {
  return {
    id: product.id,
    slug,
    variantId: selection.variantId,
    nameEn: selection.nameEn,
    nameAr: selection.nameAr,
    imageUrl,
    price: selection.unitPrice,
    quantity,
    vatRate: selection.vatRate,
    currency: selection.currency,
    sku: selection.sku,
    sellerId: product.sellerId,
    inStock: selection.inStock,
  };
}
