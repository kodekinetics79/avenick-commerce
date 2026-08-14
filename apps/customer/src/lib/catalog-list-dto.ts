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
    && price.minQty <= source.moq
    && (price.maxQty == null || source.moq <= price.maxQty);
  const allBasePrices = source.prices.filter(applicableAtMoq);
  const allVariantPrices = source.variants.flatMap((variant) => variant.prices.filter(applicableAtMoq));
  const availableCurrencies = [...new Set([...allBasePrices, ...allVariantPrices].map((price) => price.currency))].sort();
  const cardCurrency = currency ?? (availableCurrencies.includes("AED") ? "AED" : availableCurrencies[0]);
  const basePrices = allBasePrices.filter((price) => price.currency === cardCurrency);
  const availableByIdentity = new Map<string | null, number>();
  for (const stock of source.inventory) {
    availableByIdentity.set(stock.variantId, (availableByIdentity.get(stock.variantId) ?? 0) + stock.qty - stock.reservedQty);
  }
  const availableVariantIds = new Set(source.variants
    .filter((variant) => (availableByIdentity.get(variant.id) ?? 0) >= source.moq)
    .map((variant) => variant.id));
  const variantPrices = source.variants
    .filter((variant) => availableVariantIds.has(variant.id))
    .flatMap((variant) => {
      const own = variant.prices.filter((price) => applicableAtMoq(price) && price.currency === cardCurrency);
      return own.length > 0 ? own : basePrices;
    });
  const hasVariants = source.variants.length > 0;
  const baseInStock = (availableByIdentity.get(null) ?? 0) >= source.moq;
  const cardCandidates = hasVariants ? variantPrices : baseInStock ? basePrices : [];
  const cardPrice = cardCandidates
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
