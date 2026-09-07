/**
 * One mapping from a catalogue DTO row to ProductCard props.
 *
 * This used to live inline in the home page as `toCard`, which was fine while
 * the home page was the only surface rendering catalogue rows. It is not any
 * more: the product page renders related / bought-together / trending rails,
 * the cart renders completions, and each of those would otherwise carry its
 * own copy of the same twenty lines — and the first time one copy learned a
 * new fact (a rating, a MOQ band) the others would quietly not.
 *
 * The input is the shape `toCatalogListDto` produces (cardPrice, inventory,
 * seller, category), with `rating` re-attached by the caller. `locale` picks
 * the category label; there is deliberately NO fallback label, because a
 * product whose category is unknown is shown without one rather than filed
 * under a category it may not belong to.
 */
export interface CardRow {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  vatRate?: number;
  priceIsFrom?: boolean;
  sku: string;
  sellerId: string;
  sellerName?: string;
  sellerNameAr?: string;
  inStock: boolean;
  availabilityStatus?: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED";
  hasVariants: boolean;
  priceTiered: boolean;
  moq?: number;
  rating: { average: number; count: number } | null;
  category?: string;
}

export function toCardRow(p: any, locale: "en" | "ar"): CardRow {
  const stock = p?.inventory?.[0];
  return {
    id: p.id,
    slug: p.slug,
    nameEn: p.nameEn,
    nameAr: p.nameAr,
    imageUrl: p.images?.[0]?.url,
    price: p.cardPrice?.amount,
    currency: p.cardPrice?.currency,
    vatRate: p.cardPrice?.vatRate,
    priceIsFrom: p.cardPrice?.isFrom === true,
    sku: p.sku,
    sellerId: p.sellerId,
    sellerName: p.seller?.businessNameEn,
    sellerNameAr: p.seller?.businessNameAr ?? undefined,
    inStock: stock?.inStock === true,
    availabilityStatus: stock?.status,
    hasVariants: p.hasVariants === true,
    priceTiered: p.priceTiered === true,
    moq: p.moq,
    rating: p.rating ?? null,
    category: (locale === "ar" ? p.category?.nameAr || p.category?.nameEn : p.category?.nameEn) ?? undefined,
  };
}
