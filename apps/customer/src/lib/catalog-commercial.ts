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
  availableQty: number;
  availabilityStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED";
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  sellerId: string;
  sku: string;
  nameEn: string;
  nameAr: string;
  prices: StorefrontPrice[];
  inventory: Array<{ inStock: boolean; availableQty: number; status?: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED" }>;
  variants: StorefrontVariant[];
  moq?: number;
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
  const availableQty = variant?.availableQty ?? product.inventory[0]?.availableQty ?? 0;
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
    availableQty,
    inStock: quantity <= availableQty,
  };
}

export function toStorefrontCartLine(
  product: StorefrontProduct,
  selection: NonNullable<ReturnType<typeof resolveStorefrontSelection>>,
  quantity: number,
  channel: "B2C" | "B2B" = "B2C",
  imageUrl?: string,
) {
  return {
    productId: product.id,
    slug: product.slug,
    channel,
    variantId: selection.variantId,
    nameEn: selection.nameEn,
    nameAr: selection.nameAr,
    imageUrl,
    sku: selection.sku,
    qty: quantity,
    moq: product.moq ?? 1,
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
  channel: "B2C" | "B2B" = "B2C",
  imageUrl?: string,
) {
  return {
    id: product.id,
    slug,
    channel,
    variantId: selection.variantId,
    nameEn: selection.nameEn,
    nameAr: selection.nameAr,
    imageUrl,
    price: selection.unitPrice,
    quantity,
    moq: product.moq ?? 1,
    vatRate: selection.vatRate,
    currency: selection.currency,
    sku: selection.sku,
    sellerId: product.sellerId,
    inStock: selection.inStock,
  };
}
