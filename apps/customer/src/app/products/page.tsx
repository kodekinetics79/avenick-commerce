import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AlertCircle, Check, ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import type { CatalogSearchOutcome } from "@avenick/database";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
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
export const metadata: Metadata = { title: "Products" };

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

async function ProductGridSection({ searchParams }: { searchParams: SearchParams }) {
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
    // An empty category shows an honest zero-result state that keeps the
    // selection visible. Silently redirecting to the full catalog answered a
    // question the visitor did not ask and hid the fact that the category is
    // empty.
    //
    // The refused branch is a different fact and gets different words: nothing
    // was searched, so nothing may be claimed about what the catalogue carries.
    return (
      <EmptyState
        eyebrow={refused ? "Search not run" : "Nothing published"}
        headline={
          refused
            ? `“${searchParams.search}” is shorter than the ${refused.minLength}-character floor for name search.`
            : searchParams.category
            ? "This category has no published products yet."
            : "No product matches these filters."
        }
        body={
          refused
            ? "Product names and descriptions were not searched at all, so this is not a statement about what the catalogue carries. Part numbers, SKUs and brand codes work at any length — try one of those, or add a character."
            : searchParams.category
            ? "The category exists in the catalogue, but no seller has a published, discoverable listing in it right now."
            : "Try removing a filter or searching for a different term."
        }
        icon={
          refused
            ? <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            : <PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />
        }
        action={
          <div className="flex flex-col items-center gap-4">
            {/* The Arabic line this state has carried since it was written. It
                gets an explicit dir and lang so the browser resolves its bidi
                context from the markup rather than from the English page it
                happens to sit on. */}
            <p dir="rtl" lang="ar" className="u-meta text-ink-3">
              {refused ? `أدخل ${refused.minLength} أحرف على الأقل للبحث` : "لم يتم العثور على منتجات"}
            </p>
            <Button variant="secondary" size="sm" asChild>
              <Link href={browseAllHref(searchParams)}>Browse all products</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-border-strong pb-3">
        <div className="min-w-0">
          <p className="u-ui flex items-baseline gap-1.5 text-ink-2">
            <Num value={total} rank="inline" />
            <span>{total === 1 ? "product" : "products"}</span>
            {searchParams.search && (
              <span className="truncate">
                for <em>&ldquo;{searchParams.search}&rdquo;</em>
              </span>
            )}
          </p>
          {/* The count is the database count across the whole result set; the
              grid below holds one page of it. Saying so is what stops 24 cards
              reading as the entire catalogue. */}
          <Dateline className="mt-0.5">
            {total > sortedProducts.length
              ? `Showing ${sortedProducts.length} of ${total} · page ${page} of ${totalPages}`
              : "Showing every match"}
          </Dateline>
        </div>
        <SortSelect />
      </div>

      <ProductGrid>
        {sortedProducts.map((p) => {
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
function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => `?${new URLSearchParams({ ...searchParams, page: String(p) })}`;
  const span = Math.min(7, totalPages);
  const start = Math.max(1, Math.min(page - Math.floor(span / 2), totalPages - span + 1));
  const pages = Array.from({ length: span }, (_, i) => start + i);

  return (
    <nav aria-label="Pagination" className="mt-block flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={href(page - 1)} rel="prev">
            {/* A direction-implying icon has to flip in Arabic, or "previous"
                points at the next page. */}
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            Previous
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
            <Link href={href(p)} aria-label={`Page ${p}`}>
              {p}
            </Link>
          </Button>
        ),
      )}

      {page < totalPages && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={href(page + 1)} rel="next">
            Next
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Button>
      )}
    </nav>
  );
}

async function FilterSidebar({ searchParams }: { searchParams: SearchParams }) {
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

  return (
    <aside className="w-full shrink-0 space-y-4 lg:w-60" aria-label="Filters">
      {/* Recessed, because law A says recessed is context or input, and a filter
          panel is both. It was a rung-2 card, i.e. the same object as a product,
          which is why the page read as boxes beside boxes. */}
      <FieldWell padded>
        <Eyebrow as="h2" className="mb-2">Categories</Eyebrow>
        <ul className="-mx-1 space-y-0.5">
          {/* NavItem, not a hand-rolled indigo wash: the selected filter is the
              one RAISED element in the sidebar and carries the brass rule, which
              is the same "you are here" mark the seller and admin sidebars use. */}
          {/* linkComponent={Link}: NavItem defaults to a bare <a>, and a filter
              sidebar built from full-page loads blanks the grid and throws away
              scroll position on every click. The rest of this page already
              navigates through next/link. */}
          <li>
            <NavItem href="/products" label="All products" active={!searchParams.category} linkComponent={Link} />
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <NavItem
                href={buildUrl({ category: cat.slug })}
                label={categoryLabel(cat, locale)}
                active={searchParams.category === cat.slug}
                linkComponent={Link}
              />
            </li>
          ))}
        </ul>
      </FieldWell>

      <FieldWell padded>
        <Eyebrow as="h2" className="mb-2">Availability</Eyebrow>
        <Link
          href={inStockOnly ? buildUrl({ inStock: undefined }) : buildUrl({ inStock: "1" })}
          // This is a link that changes the query, not a checkbox, so it is
          // labelled by what following it does rather than by a state a link
          // cannot legally announce. The box beside it is decoration and is
          // hidden from assistive technology.
          aria-label={inStockOnly ? "Show all products, including out of stock" : "Show in-stock products only"}
          className="u-focus u-ui flex items-center gap-2.5 rounded-nested px-2 py-1.5 text-ink-2 transition-colors duration-hover ease-standard hover:text-ink-1"
        >
          <span
            aria-hidden="true"
            className={`grid h-4 w-4 shrink-0 place-items-center rounded-nested border transition-colors duration-hover ease-standard ${
              inStockOnly ? "border-accent bg-accent text-accent-foreground" : "border-border-strong"
            }`}
          >
            {inStockOnly && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          In stock only
        </Link>
      </FieldWell>

      {(searchParams.category || searchParams.inStock || searchParams.minPrice) && (
        <Link href="/products" className="u-focus u-meta block rounded-nested py-1 text-center text-primary-ink hover:underline">
          Clear all filters
        </Link>
      )}
    </aside>
  );
}

/** Occupies the sidebar's box while the category query resolves. */
function FilterSidebarSkeleton() {
  // FieldWell rather than a hand-written data-rung div: the loading state has to
  // be the same recessed object as the panel it stands in for, or the sidebar
  // visibly changes shape when the categories land.
  return (
    <FieldWell padded className="w-full shrink-0 lg:w-60" aria-hidden="true">
      <Skeleton className="h-3 w-20" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </FieldWell>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  // The bilingual title this page has always carried. It is one string rather
  // than an English title with an Arabic subtitle, because the two halves are
  // the same statement, not a heading and its explanation.
  //
  // The search heading says "Search:", not "Results for". This component runs
  // outside the Suspense boundary that fetches, so it cannot know whether the
  // catalog service RAN the term or refused it as too short — and "Results for
  // ab" over a refusal is the same false confidence the /search heading was
  // corrected for.
  const title = searchParams.search
    ? `Search: “${searchParams.search}”`
    : searchParams.category
    ? "Category products"
    : "All products — جميع المنتجات";

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-block">
        <PageHeader
          eyebrow="Catalogue"
          title={title}
          linkComponent={Link}
        />
        <div className="flex flex-col gap-6 lg:flex-row">
          <Suspense fallback={<FilterSidebarSkeleton />}>
            <FilterSidebar searchParams={searchParams} />
          </Suspense>
          <div className="min-w-0 flex-1">
            <Suspense fallback={<ProductGridSkeleton count={12} />}>
              <ProductGridSection searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
