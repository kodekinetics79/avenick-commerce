import { z } from "zod";

/**
 * An entity identifier as the existing routes already bound one.
 *
 * `/api/orders` accepts `z.string().min(1).max(128)` for a product id rather
 * than `.cuid()`, and imported catalogue rows do not all carry cuids, so this
 * matches what the server really admits. It is bounded because an unbounded
 * identifier is a query the index cannot serve.
 */
export const IdSchema = z.string().min(1).max(128);

/** A URL slug, as the catalogue mints them. */
export const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric words joined by single hyphens");

/** ISO-8601 instant, always UTC, always with an offset. Dart parses this. */
export const TimestampSchema = z.string().datetime({ offset: true });

/**
 * International phone number, the same rule `@avenick/types/schemas` enforces
 * at registration. Diverging here would let the app collect a number the web
 * registration would reject.
 */
export const PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter the phone in international format, e.g. +9715xxxxxxx");

export const EmailSchema = z.string().email().max(320);

/**
 * The largest value an `@db.Decimal(12, 2)` money column can hold. Every money
 * field on this surface lands in such a column (Order.total, OrderItem.total,
 * CartItem.priceAED), so a contract that accepts more accepts a number the
 * write will refuse.
 */
const MAX_MONEY = 9_999_999_999.99;

/**
 * A money amount, in major units, rounded exactly the way the server rounds.
 *
 * `composeOrderTotals` rounds through `money = (v) => Number(v.toFixed(2))`,
 * so two decimal places is not a style choice — it is the arithmetic the
 * invoice is built from. A third decimal reaching a client would be a figure
 * the server never produced and cannot reproduce.
 *
 * KNOWN LIMITATION, stated rather than hidden: KWD, BHD and OMR are
 * three-minor-digit currencies, and this platform stores and rounds them to
 * two. That is a property of the Decimal(12,2) columns, not of this contract;
 * mirroring it here keeps the app and the ledger in agreement instead of
 * letting the app display a precision the ledger does not keep.
 */
export const MoneySchema = z
  .number()
  .finite()
  .min(0)
  .max(MAX_MONEY)
  .refine((value) => Number(value.toFixed(2)) === value, {
    message: "Money is carried in major units with at most 2 decimal places, matching the server's rounding",
  });

/** A signed money amount, for adjustments that may reduce a figure. */
export const SignedMoneySchema = z
  .number()
  .finite()
  .min(-MAX_MONEY)
  .max(MAX_MONEY)
  .refine((value) => Number(value.toFixed(2)) === value, {
    message: "Money is carried in major units with at most 2 decimal places, matching the server's rounding",
  });

/**
 * A VAT rate as a PERCENTAGE, the unit `composeOrderTotals` takes
 * (`vatRatePercent`, where 5 means 5%). The GCC rates in `VAT_RATES` are 0, 5,
 * 10 and 15; the bound is generous so a statutory change does not need a
 * contract release, but a fraction such as 0.05 is rejected because it would
 * silently under-tax by a factor of a hundred.
 */
export const VatRatePercentSchema = z.number().finite().min(0).max(100);

/**
 * An image, described rather than named.
 *
 * A bare URL forces the app to guess an aspect ratio, which is what makes a
 * list reflow as thumbnails arrive on a slow connection. Intrinsic dimensions
 * let Flutter reserve the box before the bytes land, and the blurhash gives it
 * something to draw meanwhile.
 *
 * ⚠ `width` and `height` ARE OPTIONAL, AND ONLY TEMPORARILY SO.
 *
 * They were required, and that was the right shape for the data this contract
 * describes — but not for the data the database holds. `ProductImage` stores
 * `url`, `altEn`, `altAr`, `isPrimary` and `sortOrder` and nothing else;
 * `Category.imageUrl`, `Brand.logoUrl` and `User.avatar` are bare URL strings.
 * With the fields required there were exactly two things a server could do:
 * invent a size, or report no image. Inventing one is the worse of the two —
 * Flutter reserves the box from it, so every tile whose real ratio differs
 * re-lays out when the bytes land, and a guessed number is indistinguishable
 * from a measured one to everyone who reads it afterwards. So the server
 * reported nothing, and the entire pilot catalogue and every brand logo
 * serialised as `image: null`: a storefront with no pictures.
 *
 * Optional is the honest middle. The server sends the dimensions wherever the
 * stored URL genuinely states them (a `WxH` path segment, or `w`/`h` query
 * parameters) and omits them otherwise; the client reserves the box when they
 * are present and lays out on load when they are not. They are written
 * TOGETHER or not at all — a width without a height is not an aspect ratio and
 * reserves nothing — which the server guarantees at its single projection
 * point rather than the schema enforcing it, because a cross-field refinement
 * here would make `Image` a ZodEffects and this is the one component eleven
 * other schemas embed by reference.
 *
 * THEY GO BACK TO REQUIRED once `ProductImage` has real `width`/`height`
 * columns, populated at upload and backfilled over the asset bucket. That
 * migration is the actual fix; this is the shape that stops the app shipping
 * without images until it lands.
 */
export const ImageSchema = z
  .object({
    url: z.string().url().max(2048),
    width: z.number().int().positive().max(20000).optional(),
    height: z.number().int().positive().max(20000).optional(),
    /** BlurHash, as produced by the reference encoder. Optional: older rows have none. */
    blurhash: z.string().min(6).max(128).optional(),
    /** Alt text in the caller's requested language. Null when the seller supplied none. */
    alt: z.string().max(300).nullable().optional(),
  })
  .strict();

export type Image = z.infer<typeof ImageSchema>;

/**
 * A localized pair. The app requests a language and gets the resolved string,
 * but the catalogue genuinely holds both and a product page shows both, so the
 * pair is named once instead of being spelled out per DTO.
 *
 * `ProductCard` deliberately does NOT use this — see catalogue.ts.
 */
export const LocalizedTextSchema = z
  .object({
    en: z.string(),
    ar: z.string().nullable(),
  })
  .strict();

/**
 * A boolean carried in a query string.
 *
 * `z.coerce.boolean()` is a trap here: it is `Boolean(value)`, and
 * `Boolean("false")` is `true`, so `?inStock=false` would filter the catalogue
 * to in-stock items — a filter that means the opposite of what it says. The
 * existing routes compare against the literal `"true"`; this accepts the usual
 * spellings on both sides and refuses anything else rather than guessing.
 */
export const QueryBooleanSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) => value === true || value === "true" || value === "1");
