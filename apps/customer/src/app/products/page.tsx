import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertCircle, ChevronLeft, ChevronRight, PackageSearch, X } from "lucide-react";
import type { CatalogSearchOutcome } from "@avenick/database";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FacetRail,
  FieldWell,
  NavItem,
  Num,
  PageHeader,
  Skeleton,
} from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/product-grid";
import { SortSelect } from "@/components/products/sort-select";
import { fetchBackendJson } from "@/lib/backend";
import { getServerB2BContext } from "@/lib/b2b-server";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { browseAllHref } from "@/lib/catalog-navigation";
import { categoryLabel } from "@/lib/catalog-categories";

// No platform-name suffix here. The root layout declares
// `title.template: "%s | <platform>"`, so appending it again rendered
// "Products — Avenick | Avenick" in the browser tab and in every share card.
//
// It is generateMetadata rather than a static object because the title was the
// English literal "Products" for every visitor. A document title is a
// user-visible string: it is what the browser tab, the history entry, the
// bookmark and every share card say, so an Arabic session read the whole page
// in Arabic under an English tab. It follows the same three cases the h1 does,
// out of the same message tree.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const t = await getTranslations("catalogue");
  return {
    title: searchParams.search
      ? t("title.search", { query: searchParams.search })
      : searchParams.category
      ? t("title.category")
      : t("title.all"),
  };
}

export const dynamic = "force-dynamic";

interface SearchParams {
  category?: string;
  /** Brand slug. Every tile on /brands links here with it. */
  brand?: string;
  search?: string;
  page?: string;
  sort?: string;
  inStock?: string;
  minPrice?: string;
  maxPrice?: string;
  b2b?: string;
  currency?: string;
}

/**
 * The published quantity breaks for one product, in the card's own currency.
 *
 * Read straight off the list DTO's `prices` rows — the same rows `priceTiered`
 * is derived from — so the ladder on a B2B tile is the supplier's published
 * bands and nothing else. Nothing is interpolated, extrapolated or rounded here.
 *
 * Products WITH variants are excluded deliberately: the DTO's `prices` are the
 * base product's rows, and a variant may carry its own. Showing base bands on a
 * variant-bearing product would be a table of numbers that do not apply to
 * whatever the buyer eventually selects, which is worse than no table.
 */
function publishedBands(p: any) {
  const currency = p?.cardPrice?.currency;
  if (!currency || p?.hasVariants === true || !Array.isArray(p?.prices)) return undefined;
  const byMinQty = new Map<number, { minQty: number; maxQty: number | null; amount: number }>();
  for (const row of p.prices) {
    if (row?.currency !== currency) continue;
    const minQty = Number(row.minQty);
    const amount = Number(row.price);
    if (!Number.isFinite(minQty) || !Number.isFinite(amount)) continue;
    const maxQty = row.maxQty == null ? null : Number(row.maxQty);
    const existing = byMinQty.get(minQty);
    // Two rows at the same break in the same currency should not exist; if one
    // does, show the lower figure rather than an arbitrary one.
    if (!existing || amount < existing.amount) byMinQty.set(minQty, { minQty, maxQty, amount });
  }
  const bands = [...byMinQty.values()].sort((a, b) => a.minQty - b.minQty);
  return bands.length > 1 ? bands : undefined;
}

async function ProductGridSection({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("catalogue");
  // The card eyebrow follows the visitor, and both halves of every name are on
  // the DTO. Reading the locale here rather than inside the card keeps the card
  // free of a second source of truth for it.
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  const wantsB2B = searchParams.b2b === "true";
  const context = wantsB2B ? await getServerB2BContext() : null;
  const currency = searchParams.currency?.toUpperCase() ?? (context ? companyCurrencyForCountry(context.company.country) : undefined);
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit = 24;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(wantsB2B ? { b2b: "true" } : { b2c: "true" }),
    ...(currency ? { currency } : {}),
    ...(searchParams.search ? { search: searchParams.search } : {}),
    ...(searchParams.category ? { categorySlug: searchParams.category } : {}),
    ...(searchParams.brand ? { brand: searchParams.brand } : {}),
    ...(searchParams.inStock === "1" ? { inStock: "true" } : {}),
    ...(searchParams.sort ? { sort: searchParams.sort } : {}),
  });
  const { products, totalPages, total, search } = await fetchBackendJson<{
    products: any[];
    total: number;
    totalPages: number;
    search: CatalogSearchOutcome;
  }>(`/api/products?${qs.toString()}`);

  // The catalog service REFUSES a term below the name-search floor rather than
  // running it — see MIN_CATALOG_SEARCH_LENGTH. It returns zero rows, and
  // reporting that as "no product matches these filters" blames the catalogue
  // for a query that was never executed. /search already says so; this surface
  // takes the same search parameter and has to say the same thing.
  const refused = search?.status === "too_short" ? search : null;

  // Ordering is done by the database across the full result set. A previous
  // version re-sorted by price here — but only across the 24 rows already on
  // the page, so "Price: Low → High" produced a false ordering that restarted
  // on every page. It also read the B2C tier while in B2B mode.
  const sortedProducts = products;

  if (sortedProducts.length === 0) {
    /*
     * THE CERTIFICATE.
     *
     * An empty category shows an honest zero-result state that keeps the
     * selection visible. Silently redirecting to the full catalog answered a
     * question the visitor did not ask and hid the fact that the category is
     * empty.
     *
     * The refused branch is a different fact and gets different words: nothing
     * was searched, so nothing may be claimed about what the catalogue carries.
     *
     * And when a CATEGORY is empty, the one action is the RFQ route. "No
     * supplier lists this yet — request a quote" is completely true, it is the
     * thing a procurement buyer actually wants next, and it turns the emptiest
     * surface in the product into its most differentiated one. A filter
     * combination that matched nothing gets the plain browse action instead:
     * an RFQ for "everything under 400 AED that is in stock" is not a request
     * any supplier can answer.
     */
    return (
      <EmptyState
        variant="certificate"
        glyph={refused ? <AlertCircle /> : <PackageSearch />}
        eyebrow={refused ? t("refused.eyebrow") : t("empty.eyebrow")}
        headline={
          refused
            ? t("refused.headline", { query: searchParams.search ?? "", min: String(refused.minLength) })
            : searchParams.category
            ? t("empty.category.headline")
            : t("empty.filters.headline")
        }
        body={
          refused
            ? t("refused.body")
            : searchParams.category
            ? t("empty.category.body")
            : t("empty.filters.body")
        }
        action={
          !refused && searchParams.category ? (
            <Button variant="secondary" size="md" asChild>
              <Link href="/b2b/rfq/new">{t("empty.requestQuote")}</Link>
            </Button>
          ) : (
            <Button variant="secondary" size="md" asChild>
              <Link href={browseAllHref(searchParams)}>{t("empty.browseAll")}</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <>
      {/* The result head. A figure, the noun it counts, and a provenance line
          saying exactly what the twenty-four cards below are a slice of. */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-border-strong pb-3">
        <div className="min-w-0">
          <p className="u-ui flex flex-wrap items-baseline gap-x-1.5 text-ink-2">
            <Num value={total} rank="inline" />
            <span>{t("productsCount", { count: total })}</span>
            {searchParams.search && (
              <span className="truncate">{t("forQuery", { query: searchParams.search })}</span>
            )}
          </p>
          {/* The count is the database count across the whole result set; the
              grid below holds one page of it. Saying so is what stops 24 cards
              reading as the entire catalogue. */}
          <Dateline className="mt-0.5">
            {total > sortedProducts.length
              ? t("showingPage", {
                  shown: String(sortedProducts.length),
                  total: String(total),
                  page: String(page),
                  pages: String(totalPages),
                })
              : t("showingAll")}
          </Dateline>
        </div>
        <SortSelect />
      </div>

      <ProductGrid>
        {sortedProducts.map((p, index) => {
          const stock = p.inventory?.[0];
          return (
            <ProductCard
              key={p.id}
              index={index}
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
              sellerNameAr={p.seller?.businessNameAr ?? undefined}
              /*
               * What it is filed under, in the visitor's language — but only on
               * a grid that is not ALREADY one category. On /products?category=X
               * the same word under all twenty-four tiles is noise, and the
               * eyebrow falls through to the supplier, which is the more useful
               * fact there. The card takes a resolved string rather than the
               * DTO's category object so packages/ui and the card stay free of
               * locale logic.
               */
              category={
                !searchParams.category && p.category
                  ? categoryLabel(p.category, locale)
                  : undefined
              }
              inStock={stock?.inStock === true}
              availabilityStatus={stock?.status}
              hasVariants={p.hasVariants === true} priceTiered={p.priceTiered === true}
              // Only ever read on a B2B tile; the card gates the render itself
              // so a caller cannot leak wholesale breaks to a consumer.
              priceBands={wantsB2B ? publishedBands(p) : undefined}
              isB2B={wantsB2B}
              moq={p.moq}
            />
          );
        })}
      </ProductGrid>

      <Pagination page={page} totalPages={totalPages} searchParams={searchParams} />
    </>
  );
}

/**
 * Pagination.
 *
 * The previous version always rendered pages 1–7, so on a catalogue with twelve
 * pages there was no control anywhere on the screen that reached page 8 — the
 * only way past seven was to edit the query string. The window now travels with
 * the current page and is bracketed by explicit previous/next controls.
 */
async function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  if (totalPages <= 1) return null;
  const t = await getTranslations("catalogue");

  const href = (p: number) => `?${new URLSearchParams({ ...searchParams, page: String(p) })}`;
  const span = Math.min(7, totalPages);
  const start = Math.max(1, Math.min(page - Math.floor(span / 2), totalPages - span + 1));
  const pages = Array.from({ length: span }, (_, i) => start + i);

  return (
    <nav aria-label={t("pagination.label")} className="mt-block flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={href(page - 1)} rel="prev">
            {/* A direction-implying icon has to flip in Arabic, or "previous"
                points at the next page. */}
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("pagination.previous")}
          </Link>
        </Button>
      )}

      {pages.map((p) =>
        p === page ? (
          // The current page is not a link to itself. It is the one element in
          // this row that is a statement rather than an action.
          <span
            key={p}
            aria-current="page"
            className="u-ui grid h-control-sm min-w-[var(--control-h-sm)] place-items-center rounded-nested border border-border-strong px-2 font-medium text-ink-1"
          >
            {p}
          </span>
        ) : (
          <Button key={p} variant="ghost" size="sm" asChild>
            <Link href={href(p)} aria-label={t("pagination.page", { page: String(p) })}>
              {p}
            </Link>
          </Button>
        ),
      )}

      {page < totalPages && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={href(page + 1)} rel="next">
            {t("pagination.next")}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </nav>
  );
}

async function FilterSidebar({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("catalogue");
  const categories = await fetchBackendJson<any[]>("/api/categories");
  // The filter list rendered `cat.nameEn` for every visitor, so the one portal
  // that ships Arabic put an English-only column of category names beside an
  // Arabic page. categoryLabel is the same helper the home strip, the search
  // grid and the deals chips already use, and it falls back to English when a
  // category has no Arabic name rather than rendering an empty label.
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";

  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...updates };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.delete("page");
    return `/products?${params.toString()}`;
  };

  const inStockOnly = searchParams.inStock === "1";
  const activeCategory = categories.find((cat) => cat.slug === searchParams.category);

  /*
   * WHAT IS CURRENTLY APPLIED, said out loud.
   *
   * A filter panel that only shows what is available, never what is in force,
   * makes a visitor scroll a list hunting for the one row that is highlighted.
   * Each chip removes exactly its own filter and nothing else, so undoing one
   * choice never costs the others — which is what the single "Clear all" link
   * used to force.
   *
   * No count is printed beside any facet. The catalogue query returns none, and
   * an approximate facet count is a lie any visitor can falsify by clicking it.
   */
  const applied: Array<{ id: string; label: string; href: string }> = [
    activeCategory
      ? { id: "category", label: categoryLabel(activeCategory, locale), href: buildUrl({ category: undefined }) }
      : null,
    searchParams.brand
      ? { id: "brand", label: searchParams.brand, href: buildUrl({ brand: undefined }) }
      : null,
    inStockOnly
      ? { id: "inStock", label: t("filters.inStockOnly"), href: buildUrl({ inStock: undefined }) }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; href: string }>;

  return (
    // Sticky on a wide viewport: the filters are an instrument, and an
    // instrument that scrolls away while you are reading the result it produced
    // makes you scroll back up to change one thing.
    //
    // On a phone this panel still sits ABOVE the grid, as it always has. What
    // is new is that both facets are <details> and can be folded away by tap,
    // and that the applied chips above them state what is in force — so a
    // collapsed facet costs the visitor no information. What is NOT solved here
    // is defaulting a facet open on desktop and closed on mobile: `open` is an
    // attribute, not a style, and nothing in CSS can set it per breakpoint. Doing
    // it properly needs one rule in globals.css (see the handover note), not a
    // client component on a page that is deliberately server-rendered.
    <aside
      className="w-full shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:w-64 lg:self-start lg:overflow-y-auto"
      aria-label={t("filters.label")}
    >
      {/* Recessed, because law A says recessed is context or input, and a filter
          panel is both. It was a rung-2 card, i.e. the same object as a product,
          which is why the page read as boxes beside boxes. */}
      <FieldWell padded>
        {applied.length > 0 && (
          <div className="mb-3 border-b border-hairline pb-3">
            <Eyebrow as="h2" className="mb-2">{t("filters.applied")}</Eyebrow>
            <ul className="flex flex-wrap gap-1.5">
              {applied.map((chip) => (
                <li key={chip.id}>
                  <Link
                    href={chip.href}
                    aria-label={t("filters.remove", { label: chip.label })}
                    className="u-focus u-state-wash u-meta flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 py-1 pe-1.5 ps-2.5 font-medium text-ink-1"
                  >
                    <span className="max-w-[10rem] truncate">{chip.label}</span>
                    <X className="h-3 w-3 shrink-0 text-ink-3" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/*
         * <details>/<summary>, so open and close cost no client component at
         * all, and the chevron is drawn from two rotated borders — nothing to
         * mirror in Arabic.
         *
         * NavItem, not a hand-rolled indigo wash: the selected filter is the one
         * RAISED element in the sidebar and carries the brass rule, which is the
         * same "you are here" mark the seller and admin sidebars use.
         *
         * linkComponent={Link}: NavItem defaults to a bare <a>, and a filter
         * sidebar built from full-page loads blanks the grid and throws away
         * scroll position on every click.
         */}
        <FacetRail
          label={t("filters.categories")}
          defaultOpen
          options={[
            { id: "all", label: t("filters.allProducts"), href: "/products", selected: !searchParams.category },
            ...categories.map((cat) => ({
              id: cat.id,
              label: categoryLabel(cat, locale),
              href: buildUrl({ category: cat.slug }),
              selected: searchParams.category === cat.slug,
            })),
          ]}
          renderOption={(option) => (
            <NavItem
              href={option.href ?? "/products"}
              label={option.label}
              active={option.selected === true}
              linkComponent={Link}
            />
          )}
        />

        {/* Two links that set a query, not a checkbox: a link cannot legally
            announce a checked state, and the previous version faked one with a
            decorative box that assistive technology had to be told to ignore. */}
        <FacetRail
          label={t("filters.availability")}
          defaultOpen
          className="border-b-0"
          options={[
            { id: "any", label: t("filters.anyAvailability"), href: buildUrl({ inStock: undefined }), selected: !inStockOnly },
            { id: "in", label: t("filters.inStockOnly"), href: buildUrl({ inStock: "1" }), selected: inStockOnly },
          ]}
          renderOption={(option) => (
            <NavItem
              href={option.href ?? "/products"}
              label={option.label}
              active={option.selected === true}
              linkComponent={Link}
            />
          )}
        />

        {applied.length > 0 && (
          <Link
            href="/products"
            className="u-focus u-meta mt-3 block rounded-nested py-1 text-center text-primary-ink hover:underline"
          >
            {t("filters.clear")}
          </Link>
        )}
      </FieldWell>
    </aside>
  );
}

/** Occupies the sidebar's box while the category query resolves. */
function FilterSidebarSkeleton() {
  // FieldWell rather than a hand-written data-rung div: the loading state has to
  // be the same recessed object as the panel it stands in for, or the sidebar
  // visibly changes shape when the categories land.
  return (
    <FieldWell padded className="w-full shrink-0 lg:w-64 lg:self-start" aria-hidden="true">
      <Skeleton className="h-3 w-20" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </FieldWell>
  );
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("catalogue");

  // The search heading says "Search:", not "Results for". This component runs
  // outside the Suspense boundary that fetches, so it cannot know whether the
  // catalog service RAN the term or refused it as too short — and "Results for
  // ab" over a refusal is the same false confidence the /search heading was
  // corrected for.
  //
  // It is also no longer an English string with an Arabic half bolted onto it.
  // "All products — جميع المنتجات" was a bilingual crutch written before this
  // page reached the message tree: on the Arabic build it printed the Arabic
  // twice, and on the English build it printed a language the reader had not
  // asked for. The tree carries both settings now.
  const title = searchParams.search
    ? t("title.search", { query: searchParams.search })
    : searchParams.category
    ? t("title.category")
    : t("title.all");

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-block">
        <PageHeader eyebrow={t("eyebrow")} title={title} linkComponent={Link} />
        <div className="flex flex-col gap-6 lg:flex-row">
          <Suspense fallback={<FilterSidebarSkeleton />}>
            <FilterSidebar searchParams={searchParams} />
          </Suspense>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<ProductGridSkeleton count={12} label={t("loadingProducts")} />}>
              <ProductGridSection searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
