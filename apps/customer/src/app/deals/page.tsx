import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { cookies } from "next/headers";
import { Button, EmptyState, Eyebrow, PageHeader } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel, getPublicCategories } from "@/lib/catalog-categories";

// The page is titled "Featured Products" rather than "Deals" because the
// catalog computes no promotion, no campaign and no discount — the old title
// and its struck-through prices were removed during hardening and must not
// come back. The Dateline below says exactly what the selection is, which is
// the only remaining imprecision in the word "featured".
export const metadata = { title: "Featured Products" };
// Live catalog data — must not prerender at build time (no DB on build machines).
export const dynamic = "force-dynamic";

const FEED_LIMIT = 12;

export default async function DealsPage() {
  const locale = (cookies().get("AVENICK_LOCALE")?.value ?? "en") as "en" | "ar";
  // Filter chips are the catalog's own top-level categories (those with
  // products to show), not a list typed into this page.
  const [{ products }, categories] = await Promise.all([
    fetchBackendJson<{ products: any[] }>(`/api/products?limit=${FEED_LIMIT}`),
    getPublicCategories(),
  ]);

  const deals = products
    .map((p) => {
      if (!p.cardPrice) return null;
      const stock = p.inventory?.[0];
      const available = stock?.inStock ? 1 : 0;
      return {
        id: p.id,
        slug: p.slug,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        imageUrl: p.images?.[0]?.url,
        price: p.cardPrice.amount,
        currency: p.cardPrice.currency,
        vatRate: p.cardPrice.vatRate,
        priceIsFrom: p.cardPrice.isFrom === true,
        sku: p.sku,
        sellerId: p.sellerId,
        sellerName: p.seller?.businessNameEn,
        inStock: available > 0,
        availabilityStatus: stock?.status,
        hasVariants: p.hasVariants === true,
        priceTiered: p.priceTiered === true,
        moq: p.moq,
        // Locale-aware, and no fallback label — an unknown category is shown as
        // none, not guessed.
        category: (locale === "ar" ? p.category?.nameAr || p.category?.nameEn : p.category?.nameEn) ?? undefined,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <MainLayout>
      <div className="mx-auto max-w-shell px-gutter py-block">
        {/* The old hero was a rose→red→verdigris gradient band with a white blur
            orb, white text and a 48px/800 heading. It had no dark value, it made
            a discovery page shout louder than the checkout, and the red read as
            a sale the catalog cannot support. The heading now sits on the same
            underrule as every other page in the storefront. */}
        <PageHeader
          eyebrow="Discovery"
          title="Featured products"
          description="Current catalogue listings and their published prices."
          // LAW E. "Featured" is the honest limit of what this page is: it is a
          // slice of the catalog feed, in the order the catalog returned it.
          //
          // "The first 12" was still one claim too strong. The feed is asked for
          // 12 and may return fewer, and the map above then drops every listing
          // with no published cardPrice — so the grid is frequently shorter than
          // 12 while the line underneath asserted 12. Both limits are stated.
          dateline={`At most ${FEED_LIMIT} listings from the catalogue feed, in the order it returned them, and only those carrying a published price · no ranking, promotion or discount is applied`}
          linkComponent={Link}
        />

        {/* Category entry points — omitted entirely when the catalog reports
            none. These navigate to the filtered catalogue rather than filtering
            this page, so they are labelled as somewhere to go rather than
            dressed as filter chips that would appear to act on the grid below. */}
        {categories.length > 0 && (
          <nav aria-label="Browse by category" className="mb-block">
            <Eyebrow as="h2" className="mb-2">Browse a category</Eyebrow>
            <div className="-mx-4 flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2">
              <Link
                href="/deals"
                aria-current="page"
                className="u-focus u-meta shrink-0 whitespace-nowrap rounded-pill border border-border-strong px-3 py-1 font-medium text-ink-1"
              >
                {locale === "ar" ? "الكل" : "All"}
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/products?category=${encodeURIComponent(cat.slug)}`}
                  className="u-focus u-meta shrink-0 whitespace-nowrap rounded-pill bg-neutral-soft px-3 py-1 font-medium text-ink-2 ring-1 ring-neutral-rule transition-colors duration-hover ease-standard hover:text-ink-1"
                >
                  {categoryLabel(cat, locale)}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {deals.length === 0 ? (
          <EmptyState
            eyebrow="Nothing published"
            headline="The catalogue returned no priced listings."
            body="A product appears here once a seller publishes it with a price in a currency this storefront serves."
            icon={<PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products">Browse all products</Link>
              </Button>
            }
          />
        ) : (
          <ProductGrid>
            {deals.map((p) => (
              <ProductCard key={p.id} {...p} locale={locale} />
            ))}
          </ProductGrid>
        )}
      </div>
    </MainLayout>
  );
}
