type CatalogPrice = {
  type: string; currency: string; minQty: number; maxQty: number | null;
  price: unknown; vatRate: unknown;
};

export type CatalogListSource = {
  id: string; sellerId: string; sku: string; slug: string; nameEn: string; nameAr: string;
  descriptionEn: string | null; descriptionAr: string | null; origin: string | null;
  tags: string[]; moq: number; isB2CEnabled: boolean; isB2BEnabled: boolean;
  images: Array<{ url: string; altText?: string | null }>;
  prices: CatalogPrice[];
  inventory: Array<{ variantId: string | null; qty: number; reservedQty: number }>;
  variants: Array<{ id: string; prices: CatalogPrice[] }>;
  category: { nameEn: string; nameAr: string; slug: string };
  brand: { nameEn: string; nameAr: string | null } | null;
  seller: { businessNameEn: string; businessNameAr: string | null; tier: string; rating: unknown };
};

/** Explicit storefront projection: no operational inventory, issues, health, or internal timestamps. */
export function toCatalogListDto(source: CatalogListSource, channel: "B2C" | "B2B", currency?: string) {
  const applicableAtMoq = (price: CatalogPrice) => price.type === channel
    && (!currency || price.currency === currency)
    && price.minQty <= source.moq
    && (price.maxQty == null || source.moq <= price.maxQty);
  const basePrices = source.prices.filter(applicableAtMoq);
  const availableVariantIds = new Set(source.inventory
    .filter((stock) => stock.variantId != null && stock.qty - stock.reservedQty > 0)
    .map((stock) => stock.variantId));
  const variantPrices = source.variants
    .filter((variant) => availableVariantIds.has(variant.id))
    .flatMap((variant) => {
      const own = variant.prices.filter(applicableAtMoq);
      return own.length > 0 ? own : basePrices;
    });
  const hasVariants = source.variants.length > 0;
  const baseInStock = source.inventory.some((stock) => stock.variantId == null && stock.qty - stock.reservedQty > 0);
  const cardCandidates = hasVariants ? variantPrices : baseInStock ? basePrices : [];
  const cardCurrency = currency ?? cardCandidates[0]?.currency;
  const cardPrice = cardCandidates
    .filter((price) => price.currency === cardCurrency)
    .map((price) => ({ amount: Number(price.price), currency: price.currency, vatRate: Number(price.vatRate) }))
    .filter((price) => Number.isFinite(price.amount) && Number.isFinite(price.vatRate))
    .sort((a, b) => a.amount - b.amount)[0] ?? null;
  return {
    id: source.id,
    sellerId: source.sellerId,
    sku: source.sku,
    slug: source.slug,
    nameEn: source.nameEn,
    nameAr: source.nameAr,
    descriptionEn: source.descriptionEn,
    descriptionAr: source.descriptionAr,
    origin: source.origin,
    tags: source.tags,
    moq: source.moq,
    isB2CEnabled: source.isB2CEnabled,
    isB2BEnabled: source.isB2BEnabled,
    images: source.images.map(({ url, altText }) => ({ url, altText: altText ?? null })),
    prices: source.prices
      .filter((price) => price.type === channel && (!currency || price.currency === currency))
      .map(({ type, currency: priceCurrency, minQty, maxQty, price, vatRate }) => ({
        type, currency: priceCurrency, minQty, maxQty, price, vatRate,
      })),
    inventory: [{ inStock: hasVariants ? availableVariantIds.size > 0 : baseInStock }],
    hasVariants,
    cardPrice: cardPrice && { ...cardPrice, isFrom: hasVariants },
    category: source.category,
    brand: source.brand,
    seller: source.seller,
  };
}
