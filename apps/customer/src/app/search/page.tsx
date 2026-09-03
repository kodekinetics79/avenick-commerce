import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Search, PackageSearch, AlertCircle } from "lucide-react";
import type { CatalogSearchOutcome } from "@avenick/database";
import { platformName } from "@avenick/utils/portal-config";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel, getPublicCategories } from "@/lib/catalog-categories";

export const metadata: Metadata = { title: `Search — ${platformName()}` };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

// No typed "suggested searches": the catalog computes no search-frequency
// data, and a fixed list kept pointing at products the catalog may not carry.
// Discovery is offered through the catalog's own categories instead.

interface SearchResponse {
  products: any[];
  total: number;
  search: CatalogSearchOutcome;
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; sort?: string } }) {
  const query = (searchParams.q ?? "").trim();
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";

  const [{ products, total, search }, categories] = await Promise.all([
    query
      ? fetchBackendJson<SearchResponse>(`/api/products?limit=${PAGE_SIZE}&search=${encodeURIComponent(query)}&b2c=true`)
      : Promise.resolve({ products: [] as any[], total: 0, search: { status: "none" } as CatalogSearchOutcome }),
    getPublicCategories(),
  ]);

  // Category links for the discovery and empty states; omitted when the
  // catalog reports none rather than replaced with a typed list.
  const categoryLinks = (className: string) =>
    categories.map((cat) => (
      <Link key={cat.slug} href={`/products?category=${encodeURIComponent(cat.slug)}`} className={className}>
        {categoryLabel(cat, locale)}
      </Link>
    ));

  // The service refused this term rather than running it — see
  // MIN_CATALOG_SEARCH_LENGTH. It returns no rows, so there is nothing to grid,
  // and reporting "0 products found" would blame the catalog for a query that
  // was never executed.
  const refused = search.status === "too_short" ? search : null;

  // A short term that is identifier-shaped ("3M", "M6") IS run, but only against
  // SKUs, part numbers and brand codes — the name/description search is still
  // below the trigram floor and did not execute. An empty grid here must not be
  // read as "the catalog has nothing like this", which is the same wrong answer
  // as the listing bug, only inverted.
  const identifierOnly = search.status === "ran" && search.strategy === "identifier";

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">
              {query ? <>Results for <em className="not-italic text-primary">&ldquo;{query}&rdquo;</em></> : "Search Products"}
            </h1>
          </div>
          {/* `total` is the database count across the whole result set. This line
              used to read products.length, which is capped at the page size and
              so under-reported every search wider than one page. */}
          <p className="text-sm text-muted-foreground mb-6">
            {!query && "Enter a keyword above to search"}
            {query && refused && <>Search not run — enter at least {refused.minLength} characters</>}
            {query && !refused && (
              <>
                <span className="font-semibold text-foreground">{total}</span> product{total !== 1 ? "s" : ""} found
                {total > products.length && <> · showing the first {products.length}</>}
              </>
            )}
          </p>

          {/* No query — show discovery */}
          {!query && (
            <div className="space-y-8">
              {categories.length > 0 ? (
                <div>
                  <h2 className="font-semibold mb-3">Browse by Category</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {categoryLinks("bg-white rounded-2xl border border-border p-4 text-sm font-medium text-center hover:border-primary hover:shadow-sm transition-all")}
                  </div>
                </div>
              ) : (
                <Link href="/products" className="text-sm text-primary hover:underline">Browse all products →</Link>
              )}
            </div>
          )}

          {/* Query refused as too short — no search ran, so show no grid */}
          {query && refused && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-border text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Enter at least {refused.minLength} characters</h3>
              <p className="text-sm text-muted-foreground mb-1">أدخل {refused.minLength} أحرف على الأقل للبحث</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                &ldquo;{query}&rdquo; is too short to search product names and descriptions, so no search was
                run. Part numbers, SKUs and brand codes work at any length — try one of those, or add
                a character.
              </p>
              {categories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {categoryLinks("px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-full text-sm hover:bg-primary/20 transition-colors")}
                </div>
              )}
              <Link href="/products" className="text-sm text-primary hover:underline">Browse all products →</Link>
            </div>
          )}

          {/* Query ran but matched nothing */}
          {query && !refused && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-border text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <PackageSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No results for &ldquo;{query}&rdquo;</h3>
              <p className="text-sm text-muted-foreground mb-1">لم يتم العثور على منتجات</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                {identifierOnly ? (
                  <>
                    Only SKUs, part numbers and brand codes were searched — &ldquo;{query}&rdquo; is
                    too short to match product names. Add a character to search names as well.
                  </>
                ) : (
                  "Try a different keyword or browse by category."
                )}
              </p>
              {categories.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {categoryLinks("px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-full text-sm hover:bg-primary/20 transition-colors")}
                </div>
              )}
              <Link href="/products" className="text-sm text-primary hover:underline">Browse all products →</Link>
            </div>
          )}

          {/* Results — ordered by the service: exact identifier matches first */}
          {query && !refused && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => {
                const stock = p.inventory?.[0];
                return (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    slug={p.slug}
                    nameEn={p.nameEn}
                    nameAr={p.nameAr}
                    imageUrl={p.images?.[0]?.url}
                    price={p.cardPrice?.amount}
                    currency={p.cardPrice?.currency}
                    vatRate={p.cardPrice?.vatRate}
                    priceIsFrom={p.cardPrice?.isFrom === true}
                    sku={p.sku}
                    sellerId={p.sellerId}
                    sellerName={p.seller?.businessNameEn}
                    inStock={stock?.inStock === true}
                    availabilityStatus={stock?.status}
                    hasVariants={p.hasVariants === true} priceTiered={p.priceTiered === true}
                    moq={p.moq}
                  />
                );
              })}
            </div>
          )}

          {/* More matched than one page holds. This page has no pagination, so
              say so and hand the visitor a surface that does, rather than
              letting 24 rows imply the whole result set. */}
          {query && !refused && total > products.length && (
            <p className="text-sm text-muted-foreground mt-6">
              {total - products.length} more match{total - products.length !== 1 ? "es" : ""} not shown.{" "}
              <Link href={`/products?search=${encodeURIComponent(query)}`} className="text-primary hover:underline">
                See all results →
              </Link>
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
