import { z } from "zod";

import { AvailabilitySchema, ChannelSchema, CurrencySchema } from "./enums";
import { IdSchema, ImageSchema, MoneySchema, QueryBooleanSchema, SlugSchema, VatRatePercentSchema } from "./primitives";
import { CursorQuerySchema, pageEnvelope, successEnvelope } from "./envelope";

/**
 * The review aggregate. Null means NOT YET REVIEWED, which a tile must render
 * differently from a zero score — five empty stars and "nobody has said
 * anything yet" are different claims.
 */
export const RatingSummarySchema = z
  .object({
    average: z.number().min(1).max(5),
    count: z.number().int().positive(),
  })
  .strict();

/**
 * A resolved price for a specific quantity, in a specific currency.
 * `isFrom` marks a "from X" price, i.e. the cheapest of several variants.
 */
export const CardPriceSchema = z
  .object({
    amount: MoneySchema,
    currency: CurrencySchema,
    vatRatePercent: VatRatePercentSchema,
    isFrom: z.boolean(),
  })
  .strict();

/**
 * A published price band. Only `ProductDetail` carries these.
 */
export const PriceBandSchema = z
  .object({
    channel: ChannelSchema,
    currency: CurrencySchema,
    minQty: z.number().int().positive(),
    maxQty: z.number().int().positive().nullable(),
    price: MoneySchema,
    vatRatePercent: VatRatePercentSchema,
  })
  .strict();

/**
 * THE LEAN LIST DTO.
 *
 * `toCatalogListDto` ships, on every card: `descriptionEn` AND `descriptionAr`
 * (5000 characters each by the create schema's own cap), the full `prices`
 * array of every band in the channel, every image, the tags array, the whole
 * seller block and three channel booleans. A 24-item page of that is tens of
 * kilobytes of payload to render a picture, a name and a price — dead weight
 * on a 3G connection in a warehouse.
 *
 * A card renders: an image, a name, a price, a stock badge, stars, and the
 * brand. So that is what a card carries. Anything a card does not draw is a
 * request away at `GET /v1/products/{slug}`, and the contract makes the two
 * genuinely different types rather than one type used in two places — which is
 * what lets the fat one grow.
 *
 * Names come as `nameEn`/`nameAr` rather than a resolved single string because
 * the app renders both scripts and switches language without refetching.
 * Descriptions do NOT, because a card never shows one.
 */
export const ProductCardSchema = z
  .object({
    id: IdSchema,
    slug: SlugSchema,
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().min(1).max(200),
    /** The primary image only. The gallery lives on the detail. */
    image: ImageSchema.nullable(),
    /** The one price the tile prints, already resolved for the card's currency. */
    price: CardPriceSchema.nullable(),
    /** Minimum order quantity: a B2B tile shows it, and the cart stepper needs it. */
    moq: z.number().int().positive(),
    availability: AvailabilitySchema,
    /** More than one band in this currency: quantity changes must be repriced server-side. */
    priceTiered: z.boolean(),
    rating: RatingSummarySchema.nullable(),
    brandName: z.string().max(120).nullable(),
    /**
     * CAN THIS BE ORDERED, IN THE CHANNEL THIS DTO WAS BUILT FOR?
     *
     * This is NOT the same question as `channel`, and conflating the two is the
     * defect this field exists to make impossible. `channel` — here, on `PriceBand`
     * and on `CartLine` — says which price list the figures came FROM. Sellability
     * is a property of the PRODUCT: `Product.isB2CEnabled` / `isB2BEnabled`, two
     * independent booleans that have nothing to do with which prices were
     * published.
     *
     * The pilot catalogue is the proof. Every one of its ~1,172 rows is priced in
     * B2C *and* carries `isB2CEnabled: false` — priced for consumers, sellable to
     * none of them. So `channel === "B2C"` read as "sellable" is true for every
     * production row and correct for none, which is the worst shape a bug can
     * take: it passes every test anyone would naturally write.
     *
     * WHAT IT MIRRORS. Three write paths already compute exactly this, identically:
     * `services/orders.ts` (~line 285), `services/secure-checkout.ts` and the v1
     * checkout quote's `quote-lines.ts` each refuse a line with
     * `channel === "B2B" ? !isB2BEnabled : !isB2CEnabled`. So `false` here is a
     * promise with teeth: an order for this product in this channel WILL be
     * refused, by three separate guards, whatever the app does next.
     *
     * WHY NOT `isB2CEnabled`. The whole surface is channel-parameterised — the same
     * product is fetched as B2C or B2B — so a field named for one column would be
     * either absent or dishonest on the other channel's DTO. This name asks the
     * question the app actually has ("can I put this in a basket?") and answers it
     * for whichever channel was requested.
     *
     * REQUIRED, NEVER OPTIONAL. An absent flag is the ambiguity that forced the
     * Flutter client to model a third `unstated` state and branch defensively. A
     * required boolean lets the app be correct by construction: `true` shows Add to
     * Cart, `false` shows Request a Quote, and there is no third case to invent.
     */
    sellableInChannel: z.boolean(),
  })
  .strict();

export type ProductCard = z.infer<typeof ProductCardSchema>;

export const ProductVariantSchema = z
  .object({
    id: IdSchema,
    sku: z.string().min(1).max(64),
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().max(200).nullable(),
    /** Free-form seller attributes (size, colour). Opaque map of scalars. */
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    prices: z.array(PriceBandSchema),
    availability: AvailabilitySchema,
    availableQty: z.number().int().min(0),
  })
  .strict();

export const SellerSummarySchema = z
  .object({
    id: IdSchema,
    businessNameEn: z.string().min(1).max(200),
    businessNameAr: z.string().max(200).nullable(),
    tier: z.enum(["STANDARD", "VERIFIED", "GOLD", "PLATINUM"]),
    city: z.string().max(120),
    country: z.string().length(2),
    /**
     * Averaged over this seller's product reviews, not read from the
     * `SellerProfile.rating` column — nothing writes that column, so the star
     * it used to print stood for no one's opinion. Null when there is nothing
     * to average.
     */
    rating: RatingSummarySchema.nullable(),
  })
  .strict();

/**
 * THE FAT DETAIL DTO. Everything a product page draws, in one request.
 *
 * Reviews are NOT inlined. `/api/products/[slug]` returns the newest 20 review
 * bodies inside the detail payload, which is a page of user-generated text
 * nobody has scrolled to yet; the summary is here and the bodies belong behind
 * their own cursor-paginated endpoint.
 */
export const ProductDetailSchema = z
  .object({
    id: IdSchema,
    slug: SlugSchema,
    sku: z.string().min(1).max(64),
    nameEn: z.string().min(1).max(200),
    nameAr: z.string().min(1).max(200),
    descriptionEn: z.string().max(5000).nullable(),
    descriptionAr: z.string().max(5000).nullable(),
    images: z.array(ImageSchema).max(50),
    /** Every band published in the requested channel. */
    prices: z.array(PriceBandSchema),
    variants: z.array(ProductVariantSchema).max(200),
    moq: z.number().int().positive(),
    availability: AvailabilitySchema,
    availableQty: z.number().int().min(0),
    /** ISO 3166-1 alpha-2 country of origin, when the seller declared one. */
    origin: z.string().length(2).nullable(),
    /** Unit weight in kilograms, which is what freight is quoted from. */
    weightKg: z.number().positive().max(100_000).nullable(),
    tags: z.array(z.string().max(60)).max(20),
    channel: ChannelSchema,
    brand: z.object({ id: IdSchema, nameEn: z.string().max(120), nameAr: z.string().max(120).nullable() }).strict().nullable(),
    category: z.object({ id: IdSchema, slug: SlugSchema, nameEn: z.string().max(120), nameAr: z.string().max(120) }).strict(),
    seller: SellerSummarySchema,
    rating: RatingSummarySchema.nullable(),
    /** See `ProductCard.sellableInChannel` — the same promise, for the detail. */
    sellableInChannel: z.boolean(),
  })
  .strict();

export type ProductDetail = z.infer<typeof ProductDetailSchema>;

/**
 * GET /v1/products — query.
 *
 * The filters are the ones `listProducts` can genuinely apply across the whole
 * result set. A malformed filter is REJECTED rather than dropped: silently
 * ignoring "rated 4 and up" answers a narrower question with the whole
 * catalogue under the caller's heading, which is how `?b2c=true` went unread
 * for the life of four screens.
 */
export const ProductListQueryFieldsSchema = CursorQuerySchema.extend({
  search: z.string().trim().min(1).max(160).optional(),
  categorySlug: SlugSchema.optional(),
  brandSlug: SlugSchema.optional(),
  channel: ChannelSchema.default("B2C"),
  currency: CurrencySchema.optional(),
  inStock: QueryBooleanSchema.optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  moqMin: z.coerce.number().int().min(1).max(1_000_000).optional(),
  moqMax: z.coerce.number().int().min(1).max(1_000_000).optional(),
  sort: z.enum(["newest", "name_asc", "moq_asc", "rating"]).default("newest"),
}).strict();

/**
 * The parsing schema: the fields above plus the cross-field rule. The plain
 * object is exported separately because OpenAPI query parameters must be an
 * object schema, and a `.refine()` wraps it in a ZodEffects — the document is
 * generated from the fields and the rule is enforced at parse time.
 */
export const ProductListQuerySchema = ProductListQueryFieldsSchema
  .refine((query) => query.moqMin == null || query.moqMax == null || query.moqMin <= query.moqMax, {
    path: ["moqMin"],
    message: "moqMin cannot exceed moqMax — an empty window returns zero rows under a filter that reads as reasonable",
  });

export const ProductListResponseSchema = pageEnvelope(ProductCardSchema);

export const ProductBySlugPathParamsSchema = z.object({ slug: SlugSchema }).strict();

export const ProductBySlugQuerySchema = z
  .object({
    channel: ChannelSchema.default("B2C"),
    currency: CurrencySchema.optional(),
  })
  .strict();

export const ProductDetailResponseSchema = successEnvelope(ProductDetailSchema);

/**
 * A category, FLAT, with a parent pointer.
 *
 * `/api/categories` returns a nested tree of unbounded depth. The mobile
 * contract flattens it: a self-referencing node type is a recursive schema,
 * which OpenAPI 3.1 can express but most Dart generators flatten badly or
 * refuse, and the app has to index the tree by id anyway to resolve a slug.
 * `parentId` plus `depth` is the same information, ordered depth-first, in a
 * shape every generator handles. The client rebuilds the tree in one pass.
 */
export const CategorySchema = z
  .object({
    id: IdSchema,
    slug: SlugSchema,
    nameEn: z.string().min(1).max(120),
    nameAr: z.string().min(1).max(120),
    parentId: IdSchema.nullable(),
    /** 0 for a root. Lets the app indent without walking parents. */
    depth: z.number().int().min(0).max(16),
    image: ImageSchema.nullable(),
    /**
     * Products discoverable anywhere beneath this node, not only on it —
     * imported catalogues put products on the leaf, so a direct count would
     * read zero for every branch.
     */
    productCount: z.number().int().min(0),
  })
  .strict();

/**
 * The category tree is small, bounded and cached hard at the edge, so it is
 * returned whole rather than cursored: paginating it would force the app to
 * make several round trips before it can draw a menu.
 */
export const CategoryListResponseSchema = successEnvelope(z.array(CategorySchema).max(2000));

export const BrandSchema = z
  .object({
    id: IdSchema,
    slug: SlugSchema,
    nameEn: z.string().min(1).max(120),
    nameAr: z.string().max(120).nullable(),
    logo: ImageSchema.nullable(),
    productCount: z.number().int().min(0),
  })
  .strict();

export const BrandListQuerySchema = CursorQuerySchema.strict();

export const BrandListResponseSchema = pageEnvelope(BrandSchema);
