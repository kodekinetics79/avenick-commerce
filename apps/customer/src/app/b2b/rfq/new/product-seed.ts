import { db, PUBLIC_CATALOG_SELLER } from "@avenick/database";

/**
 * The first RFQ line, seeded from the product the buyer came from.
 *
 * WHY. Every "Request a quote" and "Request availability" control in the
 * storefront — the product page's buy column and supplier card, the catalogue
 * tile, the cart drawer's completions — links here with `?supplier=&product=`.
 * Nothing read either parameter. They survived the sign-in redirect only to be
 * discarded, and the buyer arrived on a blank form to retype the name of the
 * thing they had pressed the button on. For a catalogue where 383 of 385
 * listings are quoted rather than carted, that blank form IS the purchase path.
 *
 * WHY ON THE SERVER, FROM IDS. The link could have carried the name and SKU as
 * text, but a URL is typed by anyone, and a seeded line would then say whatever
 * the URL said. Resolving the id here reads the catalogue's own name, SKU and
 * MOQ, and holds the read to the same visibility rule as /api/products/[slug]:
 * ACTIVE, not deleted, behind a live seller, and publicly discoverable — or,
 * for a viewer with a live company membership, enabled for business orders. A
 * product id that does not pass seeds nothing, so this cannot become a way to
 * read the name of a listing the storefront would not show this viewer.
 *
 * `supplier` is still carried by every link and still read by nothing: the RFQ
 * API accepts no supplier, and the form says so where that field would be.
 *
 * A failure seeds nothing rather than failing the page. The form works blank,
 * which is where it was before this existed.
 */
export type RfqProductSeed = { description: string; quantity: string };

/** Catalogue ids as the storefront issues them. Bounded, because it is a URL. */
const CATALOGUE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The RFQ API's own ceiling on a line's quantity (actions.ts). */
const MAX_QUANTITY = 1_000_000;

/** The form's own bound on a seeded description (page.tsx, for `?query=`). */
const MAX_DESCRIPTION = 200;

export async function readRfqProductSeed(
  params: { product?: unknown; variant?: unknown; qty?: unknown },
  viewer: { locale: string; isCompanyMember: boolean },
): Promise<RfqProductSeed | undefined> {
  const productId = typeof params.product === "string" ? params.product : "";
  if (!CATALOGUE_ID.test(productId)) return undefined;
  const variantId = typeof params.variant === "string" && CATALOGUE_ID.test(params.variant) ? params.variant : null;

  let product;
  try {
    product = await db.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
        status: "ACTIVE",
        seller: PUBLIC_CATALOG_SELLER,
        OR: viewer.isCompanyMember
          ? [{ isPubliclyDiscoverable: true }, { isB2BEnabled: true }]
          : [{ isPubliclyDiscoverable: true }],
      },
      select: {
        nameEn: true,
        nameAr: true,
        sku: true,
        moq: true,
        // `in: []` matches nothing, so a link without a variant reads no rows.
        variants: {
          where: { id: { in: variantId ? [variantId] : [] }, isActive: true },
          select: { nameEn: true, nameAr: true, sku: true },
          take: 1,
        },
      },
    });
  } catch (error) {
    console.error("Unable to seed the RFQ line from its product", error);
    return undefined;
  }
  if (!product) return undefined;

  const ar = viewer.locale === "ar";
  const localName = (en: string, arabic: string | null) => (ar ? arabic?.trim() || en : en).trim();
  const productName = localName(product.nameEn, product.nameAr);
  const variant = product.variants[0];
  const variantName = variant ? localName(variant.nameEn, variant.nameAr) : "";
  // A name, the variant when it says something the name does not, and the SKU
  // a supplier actually quotes against — joined by a middot, which is
  // punctuation rather than a word, so no language is imposed on the line.
  const description = [productName, variantName !== productName ? variantName : "", variant?.sku ?? product.sku]
    .filter(Boolean)
    .join(" · ")
    .slice(0, MAX_DESCRIPTION);

  // The buyer's own quantity from the product page when it is a quantity the
  // supplier would accept; otherwise the MOQ, because quoting below the minimum
  // order asks for a price nobody will give.
  const moq = Math.max(1, product.moq || 1);
  const requested = typeof params.qty === "string" ? Number(params.qty) : Number.NaN;
  const quantity = Number.isInteger(requested) && requested >= moq && requested <= MAX_QUANTITY ? requested : moq;

  return { description, quantity: String(Math.min(quantity, MAX_QUANTITY)) };
}
