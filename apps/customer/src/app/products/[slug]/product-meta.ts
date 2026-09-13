import type { Metadata } from "next";
import { db, PUBLIC_CATALOG_SELLER } from "@avenick/database";
import { canonicalFor } from "@/lib/page-metadata";

/**
 * The product page's server-side facts: whether the URL names a product at
 * all, and what its document head says.
 *
 * WHY THIS EXISTS. The page is a client component that fetches its product on
 * mount (see page.tsx for why it stays one), and a client component can export
 * no metadata. So every product in the catalogue was titled with the bare
 * platform name, carried the site's description and share card, and had no
 * canonical; and a slug that names nothing answered HTTP 200, because the
 * page's `notFound()` ran in the browser long after the status was sent. The
 * product API already answered 404 for the same slug. A segment layout is the
 * sanctioned place for a client page's metadata (cart/, register/, wishlist/),
 * and it can also refuse the URL before anything streams.
 *
 * WHY A LEAN READ, NOT getProductBySlug. That service loads twenty reviews,
 * every price and inventory row, and runs a seller-wide review aggregate. The
 * head needs a name, a description, a SKU, a brand and one image, so this
 * selects exactly those — and selects NO price, stock or rating, so none can
 * leak into a search snippet or a share card. Prices are quote-only for most of
 * the catalogue and ratings are not a fact this head may assert (LAW F).
 *
 * THE SAME ROW RULE AS THE API, minus the part a layout cannot see. Slug, not
 * deleted, behind a live seller (PUBLIC_CATALOG_SELLER), and status ACTIVE —
 * otherwise 404. Public discoverability is deliberately NOT a 404 here: a
 * layout receives no searchParams, and `?b2b=true` legitimately serves
 * business-only listings to company members. Such a product gets a noindex head
 * with NO name in it, so a gated listing's name never reaches an anonymous
 * document, and the client page resolves the channel as it always has.
 */
export type ProductMeta = {
  slug: string;
  status: string;
  isPubliclyDiscoverable: boolean;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  sku: string;
  brand: { nameEn: string; nameAr: string | null } | null;
  images: Array<{ url: string; altEn: string | null; altAr: string | null }>;
};

export type ProductMetaRead =
  | { kind: "found"; product: ProductMeta }
  | { kind: "missing" }
  /** The read itself failed. Neither a 404 nor a title can be asserted. */
  | { kind: "unknown" };

export async function readProductMeta(slug: string): Promise<ProductMetaRead> {
  try {
    const product = await db.product.findFirst({
      where: { slug, deletedAt: null, seller: PUBLIC_CATALOG_SELLER },
      select: {
        slug: true,
        status: true,
        isPubliclyDiscoverable: true,
        nameEn: true,
        nameAr: true,
        descriptionEn: true,
        descriptionAr: true,
        sku: true,
        brand: { select: { nameEn: true, nameAr: true } },
        // The image a tile shows first, else the gallery's first frame.
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true, altEn: true, altAr: true } },
      },
    });
    return product ? { kind: "found", product } : { kind: "missing" };
  } catch (error) {
    // A failed read must not become a 404 for a product that exists, and must
    // not take the page down either: the head falls back to the site default
    // and the client page loads — or fails — exactly as it did before.
    console.error("Unable to read product metadata", error);
    return { kind: "unknown" };
  }
}

/** True when this URL names nothing the storefront serves: the API's own 404. */
export function isUnservable(read: ProductMetaRead): boolean {
  return read.kind === "missing" || (read.kind === "found" && read.product.status !== "ACTIVE");
}

/** The site's own share card, the one the root layout's file convention serves. */
export const SITE_SHARE_CARD = "/opengraph-image";

/** A search snippet's working length. Cut at a word, never through one. */
const DESCRIPTION_LIMIT = 155;

function summarise(text: string | null): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= DESCRIPTION_LIMIT) return flat;
  const cut = flat.slice(0, DESCRIPTION_LIMIT - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > DESCRIPTION_LIMIT / 2 ? cut.slice(0, atWord) : cut).replace(/[\s,;:.·–—-]+$/, "")}…`;
}

export function productMetadata(
  product: ProductMeta,
  {
    locale,
    siteName,
    describe,
  }: {
    locale: "en" | "ar";
    siteName: string;
    /** The message-tree sentence for a product that published no description. */
    describe: (facts: { name: string; brand: string; sku: string }) => string;
  },
): Metadata {
  if (!product.isPubliclyDiscoverable) return { robots: { index: false, follow: false } };

  const ar = locale === "ar";
  const name = (ar ? product.nameAr.trim() || product.nameEn : product.nameEn).trim();
  const brand = product.brand ? (ar ? product.brand.nameAr?.trim() || product.brand.nameEn : product.brand.nameEn).trim() : "";
  // The reader's own language only. The page body carries both descriptions,
  // but a snippet is one sentence, and an English paragraph under an Arabic
  // title is the same defect as an English headline over an Arabic page.
  const description = summarise(ar ? product.descriptionAr : product.descriptionEn)
    || describe({ name, brand, sku: product.sku });
  // Canonical drops ?b2b, ?currency, ?variantId and ?qty: they change what the
  // client page resolves, not which product the document is. It comes from
  // canonicalFor, as every other page's does: an absolute URL built from this
  // deployment's origin, and none at all when that origin is unknown.
  const canonicalValue = canonicalFor(`/products/${product.slug}`).alternates?.canonical;
  const canonical = typeof canonicalValue === "string" ? canonicalValue : undefined;
  const image = product.images.find((candidate) => candidate.url.trim());
  const alt = image ? ((ar ? image.altAr : image.altEn) || image.altEn || name) : name;

  return {
    // No platform suffix: the root layout's title template appends it.
    title: name,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    // Stated in full rather than inherited. A child openGraph object REPLACES
    // the parent's, so leaving images out would drop the site card entirely,
    // and the root pins og:title to the bare platform name.
    openGraph: {
      type: "website",
      siteName,
      title: name,
      description,
      ...(canonical ? { url: canonical } : {}),
      images: [image ? { url: image.url, alt } : { url: SITE_SHARE_CARD, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: [image ? image.url : SITE_SHARE_CARD],
    },
  };
}
