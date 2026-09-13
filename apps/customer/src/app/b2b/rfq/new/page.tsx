import { cookies } from "next/headers";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { getServerB2BContext } from "@/lib/b2b-server";
import { categoryLabel, getPublicCategories } from "@/lib/catalog-categories";
import { b2bMetadata } from "@/components/b2b/i18n";
import { NewRFQForm } from "./new-rfq-form";
import { readRfqProductSeed } from "./product-seed";

export async function generateMetadata() {
  return b2bMetadata("newRfq.title");
}
// Live catalog and company data — must not prerender at build time.
export const dynamic = "force-dynamic";

/**
 * Server shell for the RFQ form: loads the catalog's categories (so the form
 * never types its own list) and the buyer's company currency (so the target
 * price is labelled with the currency the company actually trades in). The
 * form itself, with its per-item state, stays a client component.
 */
/**
 * Two hand-offs seed the first line.
 *
 * `?product=` (with optional `variant` and `qty`) is every request control in
 * the storefront — the product page, the catalogue tile, the cart drawer. The
 * product is resolved here, on the server, under the product API's visibility
 * rule, and the line opens with its name, SKU and quantity. See product-seed.ts
 * for why the link carries ids rather than text.
 *
 * `?query=` is the search page's hand-off: when a part number or term found
 * no listing, the zero-result state offers "request a quote for it" and lands
 * here with the term. It seeds the first line's description — the buyer
 * arrives with the thing they typed already on the form rather than retyping
 * it into an empty field. Bounded, because it is a URL and URLs are typed by
 * anyone. A resolved product wins over it.
 */
export default async function NewRFQPage({
  searchParams,
}: {
  searchParams?: { query?: string; product?: string; variant?: string; qty?: string };
}) {
  const typedQuery =
    typeof searchParams?.query === "string" && searchParams.query.trim() ? searchParams.query.trim().slice(0, 200) : undefined;
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  const [categories, ctx] = await Promise.all([getPublicCategories(), getServerB2BContext()]);
  // After the context, not beside it: which products this viewer may name
  // depends on whether they hold a live company membership.
  const productSeed = await readRfqProductSeed(searchParams ?? {}, { locale, isCompanyMember: !!ctx });

  return (
    <NewRFQForm
      initialDescription={productSeed?.description ?? typedQuery}
      initialQuantity={productSeed?.quantity}
      categories={categories.map((c) => ({ slug: c.slug, label: categoryLabel(c, locale) }))}
      currency={ctx ? companyCurrencyForCountry(ctx.company.country) : null}
    />
  );
}
