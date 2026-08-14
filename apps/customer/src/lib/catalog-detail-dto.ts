type DetailPrice = {
  type: string;
  currency: string;
  minQty: number;
  maxQty: number | null;
  price: unknown;
  vatRate: unknown;
};

type DetailVariant = {
  id: string;
  sku: string;
  nameEn: string;
  nameAr: string | null;
  attributes: unknown;
  isActive: boolean;
  prices: DetailPrice[];
};

export type CatalogDetailSource = {
  id: string;
  sellerId: string;
  sku: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  isB2CEnabled: boolean;
  isB2BEnabled: boolean;
  origin: string | null;
  weight: unknown;
  moq: number;
  images: Array<{ url: string; altEn: string | null; altAr: string | null; isPrimary: boolean; sortOrder: number }>;
  prices: DetailPrice[];
  inventory: Array<{ variantId: string | null; available: number }>;
  variants: DetailVariant[];
  seller: {
    businessNameEn: string;
    businessNameAr: string | null;
    tier: string;
    rating: unknown;
    reviewCount: number;
    city: string;
    country: string;
  };
  reviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    isVerified: boolean;
    createdAt: Date;
    user: { firstName: string; lastName: string };
  }>;
};

/** Explicit anonymous/B2B storefront detail projection. */
export function toCatalogDetailDto(source: CatalogDetailSource) {
  const availableFor = (variantId: string | null) => Math.max(0, source.inventory
    .filter((stock) => stock.variantId === variantId)
    .reduce((sum, stock) => sum + stock.available, 0));
  return {
    id: source.id,
    sellerId: source.sellerId,
    sku: source.sku,
    slug: source.slug,
    nameEn: source.nameEn,
    nameAr: source.nameAr,
    descriptionEn: source.descriptionEn,
    descriptionAr: source.descriptionAr,
    isB2CEnabled: source.isB2CEnabled,
    isB2BEnabled: source.isB2BEnabled,
    origin: source.origin,
    weight: source.weight,
    moq: source.moq,
    images: source.images.map(({ url, altEn, altAr, isPrimary, sortOrder }) => ({
      url, altEn, altAr, isPrimary, sortOrder,
    })),
    prices: source.prices.map(({ type, currency, minQty, maxQty, price, vatRate }) => ({
      type, currency, minQty, maxQty, price, vatRate,
    })),
    inventory: [{ inStock: availableFor(null) >= source.moq, availableQty: availableFor(null) }],
    variants: source.variants
      .filter((variant) => variant.isActive)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        nameEn: variant.nameEn,
        nameAr: variant.nameAr,
        attributes: variant.attributes,
        prices: variant.prices.map(({ type, currency, minQty, maxQty, price, vatRate }) => ({
          type, currency, minQty, maxQty, price, vatRate,
        })),
        inStock: availableFor(variant.id) >= source.moq,
        availableQty: availableFor(variant.id),
      })),
    seller: source.seller,
    reviews: source.reviews.map(({ id, rating, title, body, isVerified, createdAt, user }) => ({
      id, rating, title, body, isVerified, createdAt, user,
    })),
  };
}
