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
  isPubliclyDiscoverable: boolean;
  origin: string | null;
  weight: unknown;
  moq: number;
  images: Array<{ url: string; altEn: string | null; altAr: string | null; isPrimary: boolean; sortOrder: number }>;
  prices: DetailPrice[];
  inventory: Array<{ variantId: string | null; available: number }>;
  variants: DetailVariant[];
  brand?: { nameEn: string; nameAr: string | null } | null;
  seller: {
    id: string;
    businessNameEn: string;
    businessNameAr: string | null;
    tier: string;
    /**
     * Averaged over this seller's product reviews by the service, not read from
     * the SellerProfile.rating column — nothing writes that column, so the star
     * it used to print stood for no one's opinion. `averageRating` is null when
     * there is nothing to average, which the page renders as no rating at all.
     */
    reviewSummary: { averageRating: number | null; reviewCount: number };
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
  /**
   * Total review count from the service's `_count`, independent of the
   * loaded `reviews` window (the newest 20). Optional so an older service
   * shape still projects; the page falls back to `reviews.length` and says
   * "recent" when it has to.
   */
  reviewTotal?: number;
};

/** Explicit anonymous/B2B storefront detail projection. */
export function toCatalogDetailDto(source: CatalogDetailSource, channel: "B2C" | "B2B" = "B2C") {
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
    isPubliclyDiscoverable: source.isPubliclyDiscoverable,
    origin: source.origin,
    weight: source.weight,
    moq: source.moq,
    images: source.images.map(({ url, altEn, altAr, isPrimary, sortOrder }) => ({
      url, altEn, altAr, isPrimary, sortOrder,
    })),
    prices: source.prices.filter((price) => price.type === channel).map(({ type, currency, minQty, maxQty, price, vatRate }) => ({
      type, currency, minQty, maxQty, price, vatRate,
    })),
    inventory: [{
      inStock: availableFor(null) >= source.moq,
      availableQty: availableFor(null),
      status: source.inventory.length === 0 ? "UNCONFIRMED" as const
        : availableFor(null) >= source.moq ? "IN_STOCK" as const : "OUT_OF_STOCK" as const,
    }],
    variants: source.variants
      .filter((variant) => variant.isActive)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        nameEn: variant.nameEn,
        nameAr: variant.nameAr,
        attributes: variant.attributes,
        prices: variant.prices.filter((price) => price.type === channel).map(({ type, currency, minQty, maxQty, price, vatRate }) => ({
          type, currency, minQty, maxQty, price, vatRate,
        })),
        inStock: availableFor(variant.id) >= source.moq,
        availableQty: availableFor(variant.id),
        availabilityStatus: source.inventory.some((stock) => stock.variantId === variant.id)
          ? availableFor(variant.id) >= source.moq ? "IN_STOCK" as const : "OUT_OF_STOCK" as const
          : "UNCONFIRMED" as const,
      })),
    brand: source.brand ? { nameEn: source.brand.nameEn, nameAr: source.brand.nameAr } : null,
    seller: source.seller,
    reviews: source.reviews.map(({ id, rating, title, body, isVerified, createdAt, user }) => ({
      id, rating, title, body, isVerified, createdAt, user,
    })),
    ...(typeof source.reviewTotal === "number" ? { reviewTotal: source.reviewTotal } : {}),
  };
}
