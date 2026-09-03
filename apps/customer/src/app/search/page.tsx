import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AlertCircle, PackageSearch } from "lucide-react";
import type { CatalogSearchOutcome } from "@avenick/database";
import { Button, Dateline, EmptyState, Eyebrow, Num, PageHeader, Surface } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { categoryIcon } from "@/components/products/category-icon";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel, getPublicCategories } from "@/lib/catalog-categories";

// No platform-name suffix. The root layout declares
// `title.template: "%s | <platform>"`, so appending it here rendered
// "Search — Avenick | Avenick" in the tab and in every share card.
export const metadata: Metadata = { title: "Search" };
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
  const categoryPills = () =>
    categories.map((cat) => (
      <Link
        key={cat.slug}
        href={`/products?category=${encodeURIComponent(cat.slug)}`}
        className="u-focus u-meta rounded-pill bg-neutral-soft px-3 py-1 font-medium text-ink-2 ring-1 ring-neutral-rule transition-colors duration-hover ease-standard hover:text-ink-1"
      >
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
      <div className="mx-auto max-w-7xl px-4 py-block">
        <PageHeader
          eyebrow="Catalogue search"
          // The heading may not say "Results for" when no search was executed —
          // a refused term returns no rows because the service declined to run
          // it, not because the catalogue holds nothing.
          title={!query ? "Search products" : refused ? `Search: “${query}”` : `Results for “${query}”`}
          description={!query ? "Enter a keyword in the search field above." : undefined}
          linkComponent={Link}
        />

        {/* ── No query: discovery ─────────────────────────── */}
        {!query && (
          categories.length > 0 ? (
            <section>
              <Eyebrow as="h2" className="mb-3">Browse by category</Eyebrow>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((cat) => {
                  const Icon = categoryIcon(cat.iconName);
                  return (
                    <Surface key={cat.slug} rung={2} interactive className="group">
                      <Link
                        href={`/products?category=${encodeURIComponent(cat.slug)}`}
                        className="u-focus flex items-center gap-3 rounded-[inherit] p-4"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-surface-1 text-ink-2 transition-colors duration-hover ease-standard group-hover:bg-accent-soft group-hover:text-accent-ink">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="u-ui min-w-0 truncate font-medium text-ink-1">
                          {categoryLabel(cat, locale)}
                        </span>
                      </Link>
                    </Surface>
                  );
                })}
              </div>
            </section>
          ) : (
            <EmptyState
              eyebrow="Nothing to search yet"
              headline="Enter a keyword above to search the catalogue."
              body="The catalogue currently reports no categories to browse, so there is nothing to suggest here."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/products">Browse all products</Link>
                </Button>
              }
            />
          )
        )}

        {/* ── Query refused as too short: no search ran, so show no grid ─── */}
        {query && refused && (
          <EmptyState
            eyebrow="Search not run"
            headline={`“${query}” is shorter than the ${refused.minLength}-character floor for name search.`}
            body="Product names and descriptions were not searched at all, so this is not a statement about what the catalogue carries. Part numbers, SKUs and brand codes work at any length — try one of those, or add a character."
            icon={<AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <div className="flex flex-col items-center gap-4">
                <p dir="rtl" lang="ar" className="u-meta text-ink-3">
                  أدخل {refused.minLength} أحرف على الأقل للبحث
                </p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">{categoryPills()}</div>
                )}
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/products">Browse all products</Link>
                </Button>
              </div>
            }
          />
        )}

        {/* ── Query ran but matched nothing ────────────────── */}
        {query && !refused && products.length === 0 && (
          <EmptyState
            eyebrow="No matches"
            headline={`Nothing in the catalogue matches “${query}”.`}
            body={
              identifierOnly
                ? `Only SKUs, part numbers and brand codes were searched — “${query}” is too short to match product names. Add a character to search names as well.`
                : "Try a different keyword, or browse the catalogue by category."
            }
            icon={<PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <div className="flex flex-col items-center gap-4">
                <p dir="rtl" lang="ar" className="u-meta text-ink-3">
                  لم يتم العثور على منتجات
                </p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">{categoryPills()}</div>
                )}
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/products">Browse all products</Link>
                </Button>
              </div>
            }
          />
        )}

        {/* ── Results — ordered by the service: exact identifier matches first ── */}
        {query && !refused && products.length > 0 && (
          <>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-border-strong pb-3">
              <p className="u-ui flex items-baseline gap-1.5 text-ink-2">
                {/* `total` is the database count across the whole result set. This
                    line used to read products.length, which is capped at the page
                    size and so under-reported every search wider than one page. */}
                <Num value={total} rank="inline" />
                <span>{total === 1 ? "product found" : "products found"}</span>
              </p>
              <Dateline>
                {total > products.length
                  ? `Showing the first ${products.length} matches, ranked by the catalogue service`
                  : "Ranked by the catalogue service · identifier matches first"}
              </Dateline>
            </div>

            <ProductGrid>
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
            </ProductGrid>

            {/* More matched than one page holds. This page has no pagination, so
                say so and hand the visitor a surface that does, rather than
                letting 24 rows imply the whole result set. */}
            {total > products.length && (
              <p className="u-ui mt-block text-ink-2">
                {total - products.length} more match{total - products.length !== 1 ? "es" : ""} not shown on this page.{" "}
                <Link
                  href={`/products?search=${encodeURIComponent(query)}`}
                  className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
                >
                  See all results
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
