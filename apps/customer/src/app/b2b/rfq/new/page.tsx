import { cookies } from "next/headers";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { getServerB2BContext } from "@/lib/b2b-server";
import { categoryLabel, getPublicCategories } from "@/lib/catalog-categories";
import { NewRFQForm } from "./new-rfq-form";

export const metadata = { title: "New RFQ" };
// Live catalog and company data — must not prerender at build time.
export const dynamic = "force-dynamic";

/**
 * Server shell for the RFQ form: loads the catalog's categories (so the form
 * never types its own list) and the buyer's company currency (so the target
 * price is labelled with the currency the company actually trades in). The
 * form itself, with its per-item state, stays a client component.
 */
export default async function NewRFQPage() {
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  const [categories, ctx] = await Promise.all([getPublicCategories(), getServerB2BContext()]);

  return (
    <NewRFQForm
      categories={categories.map((c) => ({ slug: c.slug, label: categoryLabel(c, locale) }))}
      currency={ctx ? companyCurrencyForCountry(ctx.company.country) : null}
    />
  );
}
