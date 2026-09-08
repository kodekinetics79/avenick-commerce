import type { Channel, Currency, ProductCard, ProductDetail } from "@avenick/contracts";
import type { ProductListRow, ProductRating } from "@avenick/database";
import { shapeProductRating } from "@avenick/database";

import { toCatalogDetailDto, type CatalogDetailSource } from "@/lib/catalog-detail-dto";
import { toCatalogListDto, type CatalogListSource } from "@/lib/catalog-list-dto";

import { toImage, toMoney, toNumber, toVatRatePercent } from "../_lib/dto";

/**
 * The catalogue row as the two mobile DTOs.
 *
 * Neither the price nor the availability is re-derived here. `toCatalogListDto`
 * and `toCatalogDetailDto` are the projections the web storefront already
 * renders from, and they own three decisions that are easy to get subtly
 * different: which price band applies at the product's MOQ, which currency a
 * card prints when the caller names none, and whether "no inventory row at all"
 * is out of stock or merely unconfirmed. A second implementation of any of
 * those would show one price on the phone and another on the web for the same
 * product — so this file projects their output into the contract's shape and
 * computes no money of its own.
 */

/** A product's tags, bounded the way the contract bounds them. */
const MAX_TAGS = 20;
/** The gallery's cap. Images are already ordered by `sortOrder`. */
const MAX_IMAGES = 50;

/**
 * Can this product be ORDERED in this channel?
 *
 * The same expression three write paths already evaluate — `services/orders.ts`
 * (~line 285), `services/secure-checkout.ts` and the checkout quote's
 * `quote-lines.ts` — so `false` here is not advice, it is what those guards
 * will do. It is deliberately NOT the channel the price came from: the pilot
 * catalogue is priced in B2C and carries `isB2CEnabled: false` on every row, so
 * the two answers disagree for the entire production catalogue.
 */
export function sellableInChannel(
  product: { isB2CEnabled: boolean; isB2BEnabled: boolean },
  channel: Channel,
): boolean {
  return channel === "B2B" ? product.isB2BEnabled : product.isB2CEnabled;
}

export function toProductCard(
  row: ProductListRow,
  channel: Channel,
  currency: Currency | undefined,
  origin: string,
): ProductCard {
  const projected = toCatalogListDto(row satisfies CatalogListSource, channel, currency);
  // PRODUCT_LIST_INCLUDE loads `images: { where: { isPrimary: true }, take: 1 }`,
  // so this is the primary image or nothing — the gallery lives on the detail.
  const primary = row.images[0];

  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    image: primary ? toImage({ url: primary.url, alt: primary.altEn }, origin) : null,
    price: projected.cardPrice
      ? {
          amount: toMoney(projected.cardPrice.amount),
          currency: projected.cardPrice.currency as Currency,
          vatRatePercent: toVatRatePercent(projected.cardPrice.vatRate),
          isFrom: projected.cardPrice.isFrom,
        }
      : null,
    moq: row.moq,
    availability: projected.inventory[0]!.status,
    priceTiered: projected.priceTiered,
    rating: row.rating,
    brandName: row.brand?.nameEn ?? null,
    // Add to Cart or Request a Quote — the app branches on this and on nothing
    // else. The listing no longer filters by it (see `product-page.ts`), so a
    // page genuinely carries both kinds.
    sellableInChannel: sellableInChannel(row, channel),
  };
}

/**
 * A variant's free-form attributes, reduced to the scalars the contract carries.
 *
 * `ProductVariant.attributes` is an unconstrained `Json` column, so it can hold
 * a nested object or an array — which `z.record(z.string(), scalar)` refuses,
 * and a refusal here would fail the whole product detail rather than one badly
 * imported attribute. Non-scalar entries are dropped; nothing is stringified,
 * because `{"depth":{"mm":40}}` rendered as `[object Object]` on a spec sheet
 * is worse than the row being absent.
 */
function toAttributes(value: unknown): Record<string, string | number | boolean> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const attributes: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" || typeof raw === "boolean") attributes[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) attributes[key] = raw;
  }
  return attributes;
}

type PricedBand = {
  type: string;
  currency: string;
  minQty: number;
  maxQty: number | null;
  price: unknown;
  vatRate: unknown;
};

function toPriceBands(prices: PricedBand[]) {
  return prices.map((band) => ({
    channel: band.type as Channel,
    currency: band.currency as Currency,
    minQty: band.minQty,
    maxQty: band.maxQty,
    price: toMoney(band.price as number),
    vatRatePercent: toVatRatePercent(band.vatRate as number),
  }));
}

/** What `getProductBySlug` returns, once its null case is excluded. */
export type ProductDetailSource = CatalogDetailSource & {
  id: string;
  sku: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  tags: string[];
  moq: number;
  origin: string | null;
  brand: { id: string; nameEn: string; nameAr: string | null } | null;
  category: { id: string; slug: string; nameEn: string; nameAr: string };
  seller: CatalogDetailSource["seller"] & { tier: string };
};

export function toProductDetail(
  product: ProductDetailSource,
  rating: ProductRating | null,
  channel: Channel,
  origin: string,
): ProductDetail {
  const projected = toCatalogDetailDto(product, channel);
  const base = projected.inventory[0]!;

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    nameEn: product.nameEn,
    nameAr: product.nameAr,
    descriptionEn: product.descriptionEn,
    descriptionAr: product.descriptionAr,
    images: product.images
      .slice(0, MAX_IMAGES)
      .map((image) => toImage({ url: image.url, alt: image.altEn }, origin))
      .filter((image): image is NonNullable<typeof image> => image !== null),
    prices: toPriceBands(product.prices),
    variants: projected.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      nameEn: variant.nameEn,
      nameAr: variant.nameAr,
      attributes: toAttributes(variant.attributes),
      prices: toPriceBands(variant.prices),
      availability: variant.availabilityStatus,
      availableQty: variant.availableQty,
    })),
    moq: product.moq,
    availability: base.status,
    availableQty: base.availableQty,
    origin: product.origin,
    /**
     * `Product.weight` is `Decimal(10, 3)` in KILOGRAMS — the unit `quoteShipping`
     * bills freight from — so the name changes and the number does not. A stored
     * zero or a negative is NOT a weight; the contract says `.positive()`, and
     * "not declared" is the honest reading of a zero on a column with no default.
     */
    weightKg: weightOrNull(product.weight),
    tags: product.tags.slice(0, MAX_TAGS),
    channel,
    brand: product.brand
      ? { id: product.brand.id, nameEn: product.brand.nameEn, nameAr: product.brand.nameAr }
      : null,
    category: {
      id: product.category.id,
      slug: product.category.slug,
      nameEn: product.category.nameEn,
      nameAr: product.category.nameAr,
    },
    seller: {
      id: product.seller.id,
      businessNameEn: product.seller.businessNameEn,
      businessNameAr: product.seller.businessNameAr,
      tier: product.seller.tier as "STANDARD" | "VERIFIED" | "GOLD" | "PLATINUM",
      city: product.seller.city,
      country: product.seller.country,
      // Averaged over the seller's product reviews by the service, through the
      // service's own shaping function: no reviews means NO rating, never a
      // zero-star seller.
      rating: shapeProductRating(
        product.seller.reviewSummary.averageRating,
        product.seller.reviewSummary.reviewCount,
      ),
    },
    rating,
    sellableInChannel: sellableInChannel(product, channel),
  };
}

function weightOrNull(value: unknown): number | null {
  if (value == null) return null;
  const weight = toNumber(value as number);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}
