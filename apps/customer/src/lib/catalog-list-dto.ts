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
  inventory: Array<{ qty: number; reservedQty: number }>;
  category: { nameEn: string; nameAr: string; slug: string };
  brand: { nameEn: string; nameAr: string | null } | null;
  seller: { businessNameEn: string; businessNameAr: string | null; tier: string; rating: unknown };
};

/** Explicit storefront projection: no operational inventory, issues, health, or internal timestamps. */
export function toCatalogListDto(source: CatalogListSource, channel: "B2C" | "B2B", currency?: string) {
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
    inventory: [{ inStock: source.inventory.some((stock) => stock.qty - stock.reservedQty > 0) }],
    category: source.category,
    brand: source.brand,
    seller: source.seller,
  };
}
