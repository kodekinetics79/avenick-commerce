import type { Image } from "@avenick/contracts";

/**
 * The projection helpers every v1 DTO is built from.
 *
 * One place, rather than a copy per route, because these are the four points at
 * which the database and the published contract genuinely disagree, and a
 * second copy of any of them is a second answer to a question that must have
 * one.
 */

/** Prisma hands money and coordinates back as Decimal; fixtures hand them back as numbers. */
export type Decimalish = { toString(): string } | number;

export function toNumber(value: Decimalish): number {
  return typeof value === "number" ? value : Number(value.toString());
}

/**
 * Money, in the major units the contract carries and at the precision the
 * server rounds to.
 *
 * Never `parseFloat`: every money column here is `@db.Decimal(12, 2)`, which
 * Prisma returns as a Decimal whose `toString()` is exact. `Number(...)` of
 * that string is the same conversion `quote-lines.ts` makes, and the
 * `toFixed(2)` mirrors `composeOrderTotals`' own `money()` helper — so a figure
 * that reaches a phone is the figure the ledger holds, not a re-derivation of
 * it.
 */
export function toMoney(value: Decimalish): number {
  return Number(toNumber(value).toFixed(2));
}

/** A VAT rate as a percentage — the unit `composeOrderTotals` takes (5 means 5%). */
export function toVatRatePercent(value: Decimalish): number {
  return toNumber(value);
}

/** ISO-8601 with an offset, which is what `TimestampSchema` parses and Dart reads. */
export function toTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * A stored string as an absolute URL, or nothing.
 *
 * Half the image columns in this database hold a RELATIVE path —
 * `/brands/demo-3m.svg` from `scripts/demo-brand-logos.mjs`, `/images/...` from
 * the seed — and `z.string().url()` refuses those. They are served by this very
 * app, so they are resolved against the request's own origin rather than
 * dropped.
 *
 * Anything that is still not an http(s) URL comes back null. That is a
 * deliberate softening in ONE direction only: a malformed `vatInvoiceUrl` on
 * one order would otherwise fail response validation and take down the whole
 * order detail with a 500, and "no invoice link" is a smaller wrong answer than
 * "this order cannot be displayed".
 */
export function absoluteUrl(value: string | null | undefined, origin: string): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate, origin || undefined);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const href = url.toString();
    return href.length <= 2048 ? href : null;
  } catch {
    return null;
  }
}

/**
 * Intrinsic dimensions, ONLY where the stored URL genuinely carries them.
 *
 * Two forms are recognised, and both are real conventions this catalogue
 * already uses or would use:
 *
 *   · a `WxH` path segment — `https://placehold.co/600x600/FFD700/000`, which
 *     is what every seeded product image is;
 *   · explicit `w`/`h` (or `width`/`height`) query parameters, the resizing
 *     convention of every image CDN this platform could put in front of the
 *     asset bucket.
 *
 * Nothing else is guessed. See `toImage` for why that matters.
 */
const PATH_DIMENSIONS = /(?:^|\/)(\d{2,5})x(\d{2,5})(?=[/?#.]|$)/i;
const MAX_DIMENSION = 20_000;

function readDimension(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_DIMENSION) return null;
  return parsed;
}

function intrinsicDimensions(url: URL): { width: number; height: number } | null {
  const width = readDimension(url.searchParams.get("w") ?? url.searchParams.get("width"));
  const height = readDimension(url.searchParams.get("h") ?? url.searchParams.get("height"));
  if (width && height) return { width, height };

  const match = PATH_DIMENSIONS.exec(url.pathname);
  if (!match) return null;
  const pathWidth = readDimension(match[1]!);
  const pathHeight = readDimension(match[2]!);
  return pathWidth && pathHeight ? { width: pathWidth, height: pathHeight } : null;
}

const MAX_ALT_LENGTH = 300;

/**
 * A stored image URL as the contract's `Image`.
 *
 * ⚠ READ THIS BEFORE CHANGING IT. `ImageSchema.width`/`.height` are OPTIONAL,
 * and this is the single place that decides whether they are sent.
 *
 *   1. NEVER INVENT A SIZE. Not a square, not the grid's cell size, not 1x1.
 *      Flutter reserves the box from these numbers, so a wrong intrinsic size
 *      makes every tile re-lay out the moment the real bytes land — a grid that
 *      jumps on every scroll, on the connection this API exists to serve. A
 *      guessed number is also indistinguishable from a measured one to everyone
 *      who reads it afterwards.
 *   2. DERIVE WHERE THE URL GENUINELY STATES IT. `intrinsicDimensions` above
 *      reads a `WxH` path segment (every seeded product image) and `w`/`h`
 *      query parameters (the resizing convention of every image CDN). Both are
 *      sent, so the client can reserve the box and avoid the shift.
 *   3. OTHERWISE SEND THE IMAGE WITHOUT THEM. The picture is real even when its
 *      size is not recorded; the client lays it out on load. This is why the
 *      contract's fields became optional — with them required, the whole pilot
 *      catalogue and every brand logo serialised as `image: null` and the app
 *      shipped with no pictures at all.
 *
 * The two are emitted TOGETHER or not at all. A width without a height is not
 * an aspect ratio and reserves nothing, and `intrinsicDimensions` returns a
 * pair or null precisely so this cannot produce a half-answer. The contract
 * does not enforce that with a refinement (see the note on `ImageSchema`: it
 * would make the one component eleven schemas share by reference a ZodEffects),
 * so this function is where the guarantee lives — and the test beside it is
 * what keeps it living here.
 *
 * Null still means NO IMAGE, and only that: no stored URL, or one that is not
 * something a phone can fetch.
 *
 * THE REAL FIX IS STILL A MIGRATION. `ProductImage` needs `width`/`height`
 * columns, populated at upload and backfilled over the asset bucket; the
 * contract's fields go back to required after it, and branch 3 becomes dead.
 */
export function toImage(
  source: { url: string | null | undefined; alt?: string | null },
  origin: string,
): Image | null {
  const href = absoluteUrl(source.url, origin);
  if (!href) return null;

  const size = intrinsicDimensions(new URL(href));
  const alt = source.alt?.trim();
  return {
    url: href,
    // Spread rather than `width: size?.width`: an absent dimension is an absent
    // KEY, not an explicit undefined, so the JSON carries no claim either way.
    ...(size ?? {}),
    alt: alt ? alt.slice(0, MAX_ALT_LENGTH) : null,
  };
}

/**
 * A slug the contract can carry, or null.
 *
 * `SlugSchema` is `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and the pilot importer's
 * `slugify` truncates with `.slice(0, 90)` AFTER stripping edge hyphens — so a
 * cut that lands just past a hyphen produces a trailing one the contract
 * refuses. This is only used where the contract makes the slug nullable
 * (`OrderItem.slug`); where it does not, a non-conforming slug fails response
 * validation, which is the correct loud failure. See the report.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugOrNull(value: string | null | undefined): string | null {
  const candidate = value?.trim();
  return candidate && candidate.length <= 160 && SLUG_PATTERN.test(candidate) ? candidate : null;
}

/**
 * The origin relative asset paths are resolved against.
 *
 * The configured portal URL wins over the request's own origin: behind the
 * Vercel→Render hop the inbound URL can name an internal host, and an image
 * URL naming an internal host is one a phone cannot fetch.
 */
export function publicOrigin(req: { nextUrl: URL }): string {
  const configured = process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // A malformed env var is not worth failing a catalogue read over.
    }
  }
  return req.nextUrl.origin;
}
