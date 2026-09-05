import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertCircle, ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
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
import { AppliedFilterChips } from "@/components/products/applied-filters";
import {
  MOQ_BULK_FLOOR,
  MOQ_CEILINGS,
  RATING_CHOICES,
  appliedCatalogFilters,
  catalogApiQuery,
  catalogHref,
  formatRatingFloor,
  parseCatalogFilters,
  sortNarrowsToReviewed,
  type CatalogSearchParams,
} from "@/components/products/catalog-filters";
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

/**
 * The whole state of this page.
 *
 * Defined once, in the filter module, because three things have to agree about
 * it: what the URL may carry, what is sent to the catalog API, and what the
 * panel reports as active. `minPrice`/`maxPrice` are gone — nothing has ever
 * read them, and a product in this catalogue has no single price to compare
 * against (see SORT_CHOICES), so they were a promise the query could not keep.
 */
type SearchParams = CatalogSearchParams;

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
  // Parsed once, from the URL, by the same function the panel uses — so a filter
  // the panel draws as active and a filter the query actually applies cannot
  // drift apart. Anything malformed is dropped here and therefore claimed
  // nowhere.
  const filters = parseCatalogFilters(searchParams);
  const applied = appliedCatalogFilters(filters);
  const qs = catalogApiQuery(filters, {
    page,
    limit,
    b2b: wantsB2B,
    currency,
    search: searchParams.search,
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
     * And when a CATEGORY is the ONLY thing applied, the one action is the RFQ
     * route. "No supplier lists this yet — request a quote" is completely true,
     * it is the thing a procurement buyer actually wants next, and it turns the
     * emptiest surface in the product into its most differentiated one. A
     * combination of filters that matched nothing is a different situation: an
     * RFQ for "everything rated 4.5+ with an MOQ under ten that is in stock" is
     * not a request any supplier can answer. That case gets the action that
     * actually helps — drop the filters, keep the search — plus the applied
     * filters themselves, named and individually removable, because "no products
     * match these filters" is only actionable if you can see which filters.
     */
    const narrowedByFilters = applied.length > (filters.category ? 1 : 0);
    // Removes every filter and keeps the search term, the sort and the governed
    // storefront context. The widest useful step, not a reset to the front page.
    const clearFiltersHref = catalogHref(searchParams, {
      category: undefined,
      brand: undefined,
      inStock: undefined,
      minRating: undefined,
      moqMin: undefined,
      moqMax: undefined,
    });
    return (
      <div className="space-y-4">
        <EmptyState
          variant="certificate"
          glyph={refused ? <AlertCircle /> : <PackageSearch />}
          eyebrow={refused ? t("refused.eyebrow") : t("empty.eyebrow")}
          headline={
            refused
              ? t("refused.headline", { query: searchParams.search ?? "", min: String(refused.minLength) })
              : narrowedByFilters
              ? t("empty.filters.headline")
              : searchParams.category
              ? t("empty.category.headline")
              : t("empty.filters.headline")
          }
          body={
            refused
              ? t("refused.body")
              : narrowedByFilters
              ? sortNarrowsToReviewed(filters)
                ? t("empty.filters.reviewedOnly")
                : t("empty.filters.body")
              : searchParams.category
              ? t("empty.category.body")
              : sortNarrowsToReviewed(filters)
              ? t("empty.filters.reviewedOnly")
              : t("empty.filters.body")
          }
          action={
            !refused && narrowedByFilters ? (
              <Button variant="secondary" size="md" asChild>
                <Link href={clearFiltersHref}>{t("empty.clearFilters")}</Link>
              </Button>
            ) : !refused && searchParams.category ? (
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

        {!refused && applied.length > 0 && (
          <FieldWell padded>
            <Eyebrow as="h2" className="mb-2">{t("empty.relax")}</Eyebrow>
            <AppliedFilterChips searchParams={searchParams} filters={filters} />
          </FieldWell>
        )}
      </div>
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
              : applied.length > 0
              ? // "Showing every published listing" is false the moment a filter
                // is on: it is every listing that SURVIVED the filters, and a
                // buyer reading the first sentence would conclude the catalogue
                // is this small.
                t("showingAllFiltered")
              : t("showingAll")}
          </Dateline>
          {/* Choosing "Highest rated" restricts the catalogue to products that
              carry an average — an unreviewed product has none and cannot be
              ranked. That is a narrowing the buyer did not ask for, so it is
              stated here rather than left to be discovered as a smaller count. */}
          {sortNarrowsToReviewed(filters) && (
            <Dateline className="mt-0.5">{t("sortOptions.ratingNote")}</Dateline>
          )}
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

/** Brands offered in the panel. The rest are one link away, on /brands. */
const BRAND_FACET_LIMIT = 20;

async function FilterSidebar({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("catalogue");
  // Two independent public reads with no dependency between them — issued
  // together rather than one after the other, because this component sits behind
  // its own Suspense boundary and serialising them would double the time the
  // panel spends as a skeleton.
  const [categories, brands] = await Promise.all([
    fetchBackendJson<any[]>("/api/categories"),
    fetchBackendJson<any[]>("/api/brands"),
  ]);
  // The filter list rendered `cat.nameEn` for every visitor, so the one portal
  // that ships Arabic put an English-only column of category names beside an
  // Arabic page. categoryLabel is the same helper the home strip, the search
  // grid and the deals chips already use, and it falls back to English when a
  // category has no Arabic name rather than rendering an empty label.
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";

  const filters = parseCatalogFilters(searchParams);
  const buildUrl = (updates: Record<string, string | undefined>) => catalogHref(searchParams, updates);

  const inStockOnly = filters.inStock;
  const activeCategory = categories.find((cat) => cat.slug === filters.category);

  /*
   * BRANDS THAT ACTUALLY HAVE SOMETHING TO SELL.
   *
   * A brand with no listing is a facet that leads to an empty grid, so it is not
   * offered at all. The rest are ordered by how much they list — the top of this
   * list is where a buyer's brand most likely is — and truncated, with the real
   * numbers stated below the rail and a link to the full directory. The
   * currently selected brand is always present even if it falls outside the cut,
   * or the panel would show a filter as unset while it is in force.
   *
   * NO COUNT IS PRINTED beside any facet, here or below. `_count.products` on
   * /api/brands counts ACTIVE, non-deleted products with no discoverability or
   * seller predicate, so it is a real number about a DIFFERENT set than the one
   * clicking the facet returns — which is the kind of count FacetRail exists to
   * refuse. It is used to rank and to exclude, never to display.
   */
  const stocked = brands
    .filter((brand) => (brand?._count?.products ?? 0) > 0)
    .sort(
      (a, b) =>
        (b._count.products ?? 0) - (a._count.products ?? 0) ||
        String(a.nameEn).localeCompare(String(b.nameEn)),
    );
  const shownBrands = stocked.slice(0, BRAND_FACET_LIMIT);
  const selectedBrand = stocked.find((brand) => brand.slug === filters.brand);
  if (selectedBrand && !shownBrands.some((brand) => brand.slug === selectedBrand.slug)) {
    shownBrands.push(selectedBrand);
  }

  const applied = appliedCatalogFilters(filters);

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
            <AppliedFilterChips
              searchParams={searchParams}
              filters={filters}
              names={{
                category: activeCategory ? categoryLabel(activeCategory, locale) : undefined,
                brand: selectedBrand?.nameEn,
              }}
            />
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
            { id: "all", label: t("filters.allProducts"), href: buildUrl({ category: undefined }), selected: !filters.category },
            ...categories.map((cat) => ({
              id: cat.id,
              label: categoryLabel(cat, locale),
              href: buildUrl({ category: cat.slug }),
              selected: filters.category === cat.slug,
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

        {/* Brands. Closed by default — it is the longest rail here and the two
            facets above it are the ones most buyers reach for first. */}
        {shownBrands.length > 0 && (
          <FacetRail
            label={t("filters.brands")}
            options={[
              { id: "any-brand", label: t("filters.anyBrand"), href: buildUrl({ brand: undefined }), selected: !filters.brand },
              ...shownBrands.map((brand) => ({
                id: brand.id,
                label: brand.nameEn,
                href: buildUrl({ brand: brand.slug }),
                selected: filters.brand === brand.slug,
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
        )}

        {/* What the rail above is a slice of, in real numbers, with the route to
            the rest. A truncated list that does not say it is truncated reads as
            "this marketplace carries twenty brands". */}
        {stocked.length > shownBrands.length && (
          <div className="border-b border-hairline pb-tight">
            <Dateline>{t("filters.brandsShown", { shown: shownBrands.length, total: stocked.length })}</Dateline>
            <Link href="/brands" className="u-focus u-meta mt-1 inline-block rounded-nested text-primary-ink hover:underline">
              {t("filters.allBrands")}
            </Link>
          </div>
        )}

        {/* Two links that set a query, not a checkbox: a link cannot legally
            announce a checked state, and the previous version faked one with a
            decorative box that assistive technology had to be told to ignore. */}
        <FacetRail
          label={t("filters.availability")}
          defaultOpen
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

        {/*
         * BUYER RATING — an average over ProductReview, the only rating this
         * schema records. There is no rating column on Product and nothing
         * writes SellerProfile.rating, so this is the one star figure in the
         * catalogue that is answerable.
         *
         * The note is not decoration. A product nobody has reviewed has no
         * average and therefore cannot clear any floor, so this control removes
         * every unreviewed listing as a side effect. A buyer who is not told
         * that reads the smaller count as "the catalogue is thin", which is the
         * wrong conclusion about the right number.
         */}
        <FacetRail
          label={t("filters.rating")}
          defaultOpen
          options={[
            { id: "any-rating", label: t("filters.anyRating"), href: buildUrl({ minRating: undefined }), selected: filters.minRating == null },
            ...RATING_CHOICES.map((value) => ({
              id: `rating-${value}`,
              label: t("filters.ratingAtLeast", { rating: formatRatingFloor(value) }),
              href: buildUrl({ minRating: String(value) }),
              selected: filters.minRating === value,
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
        <p className="u-meta pb-tight text-ink-3">{t("filters.ratingNote")}</p>

        {/*
         * MINIMUM ORDER QUANTITY. Product.moq is a non-nullable Int, so this is
         * a plain column comparison over the whole catalogue — no aggregate, no
         * null case, and the only filter here that a procurement buyer will
         * reach for on literally every visit.
         *
         * The buckets partition the column rather than sampling it: a buyer can
         * see that nothing hides between "up to 100" and "more than 100".
         */}
        <FacetRail
          label={t("filters.moq")}
          defaultOpen
          className="border-b-0"
          options={[
            {
              id: "any-moq",
              label: t("filters.anyMoq"),
              href: buildUrl({ moqMin: undefined, moqMax: undefined }),
              selected: filters.moqMin == null && filters.moqMax == null,
            },
            ...MOQ_CEILINGS.map((value) => ({
              id: `moq-max-${value}`,
              label: value === 1 ? t("filters.moqSingle") : t("filters.moqUpTo", { count: value }),
              href: buildUrl({ moqMin: undefined, moqMax: String(value) }),
              selected: filters.moqMax === value && filters.moqMin == null,
            })),
            {
              id: "moq-bulk",
              label: t("filters.moqOver", { count: MOQ_BULK_FLOOR - 1 }),
              href: buildUrl({ moqMin: String(MOQ_BULK_FLOOR), moqMax: undefined }),
              selected: filters.moqMin === MOQ_BULK_FLOOR && filters.moqMax == null,
            },
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
          // Clears the FILTERS, not the page. It used to point at bare
          // `/products`, which also threw away the search term the buyer had
          // typed and the B2B/currency context governing what they were being
          // shown — so "clear all" quietly moved a company buyer back to
          // consumer pricing.
          <Link
            href={catalogHref(searchParams, {
              category: undefined,
              brand: undefined,
              inStock: undefined,
              minRating: undefined,
              moqMin: undefined,
              moqMax: undefined,
            })}
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
