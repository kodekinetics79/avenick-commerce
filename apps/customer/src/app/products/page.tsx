import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertCircle, ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import {
  MIN_TRENDING_PRODUCTS,
  TRENDING_WINDOW_DAYS,
  db,
  getTrendingProducts,
  publicProductWhere,
  read,
  type CatalogSearchOutcome,
  type Prisma,
} from "@avenick/database";
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
  SectionHeader,
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
import { categoryIcon } from "@/components/products/category-icon";
import { ProductCard, type ProductCardPriceBand } from "@/components/products/product-card";
import { ProductGrid, ProductGridSkeleton } from "@/components/products/product-grid";
import { SortSelect } from "@/components/products/sort-select";
import { fetchBackendJson } from "@/lib/backend";
import { getServerB2BContext } from "@/lib/b2b-server";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { browseAllHref } from "@/lib/catalog-navigation";
import { categoryLabel } from "@/lib/catalog-categories";
import { toCatalogListDto } from "@/lib/catalog-list-dto";
import { findCategory, type CategoryNode } from "@/lib/category-tree";
import { toCardRow, type CardRow } from "@/lib/product-card-row";

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

/** Tiles in the "Moving in" rail: one row of the grid beneath it. */
const MOVING_LIMIT = 4;

/** Roots offered in the "Top categories" strip. The sidebar carries the rest. */
const TOP_CATEGORY_LIMIT = 8;

/** A rail tile: the shared card row, plus the B2B ladder the grid's tiles carry. */
type RailTile = CardRow & { priceBands?: ProductCardPriceBand[] };

/**
 * WHAT SITS ABOVE THE GRID, decided by what the URL narrows.
 *
 *  · A category in force: its child categories as a strip, so one click
 *    narrows without opening the panel; and the view signal ranked INSIDE that
 *    category's subtree, on exactly the thresholds the home rail applies — a
 *    category in which two products are being looked at gets no rail rather
 *    than a two-tile one.
 *  · Nothing in force: the root categories with the most published listings,
 *    computed from the catalogue under the grid's own visibility rule. Never a
 *    list typed into this page.
 *  · Anything else — a brand, a stock or rating floor, a search term: nothing.
 *    The buyer asked a narrower question and the grid is the answer.
 */
interface CatalogueLead {
  /** The category in force, when the URL names one the catalogue can navigate to. */
  within?: CategoryNode;
  /** Roots ranked by published listings, most first. Only when nothing narrows. */
  topCategories: CategoryNode[];
  /** The scoped signal. Empty is its own answer, and the common one. */
  moving: RailTile[];
}

const EMPTY_LEAD: CatalogueLead = { topCategories: [], moving: [] };

interface LeadContext {
  locale: "en" | "ar";
  wantsB2B: boolean;
  currency?: string;
  page: number;
}

/**
 * Every failure here is an empty lead, never a failed page: these are selling
 * surfaces above a result, and a result must not 500 because its garnish did.
 * The tree is the same public read the sidebar makes; both sit behind the
 * same edge cache and neither waits for the other.
 */
async function loadCatalogueLead(
  filters: ReturnType<typeof parseCatalogFilters>,
  search: string | undefined,
  ctx: LeadContext,
): Promise<CatalogueLead> {
  try {
    if (filters.category) {
      const tree = await fetchBackendJson<CategoryNode[]>("/api/categories");
      const within = findCategory(tree, filters.category);
      // Unknown slug, or a category with nothing published beneath it: the
      // grid below is about to say so, and nothing here should say otherwise.
      if (!within) return EMPTY_LEAD;
      // The rail is a selling surface, not navigation: it opens the category
      // and is not repeated at the head of every page the buyer walks through.
      const moving = ctx.page === 1 ? await movingIn(within, ctx) : [];
      return { within, topCategories: [], moving };
    }
    if (appliedCatalogFilters(filters).length === 0 && !search) {
      const tree = await fetchBackendJson<CategoryNode[]>("/api/categories");
      return { topCategories: await topCategoriesByListings(tree, ctx.wantsB2B), moving: [] };
    }
    return EMPTY_LEAD;
  } catch (error) {
    console.error("Unable to load the catalogue lead", error);
    return EMPTY_LEAD;
  }
}

/**
 * The "Moving in <category>" rail: the view signal ranked inside this category
 * and every category beneath it — the same subtree the grid lists from.
 *
 * It is empty before any view has been recorded, on a quiet week, and in a
 * category where fewer than three products clear the view floor; each is the
 * signal's answer and the page draws no rail for it. There is no fallback
 * ordering, and nothing is labelled popular that nothing ranked.
 *
 * THE RAIL SHOWS ONLY WHAT THE GRID WOULD SHOW. In consumer mode the grid asks
 * the catalogue for the B2C channel, so the rail asks the signal for the same.
 * In B2B mode the signal has no B2B channel: the rail is ranked across the
 * discoverable catalogue and every tile the B2B grid would not list is dropped
 * — and the quorum is re-applied to what remains, because a ranking of three
 * with two removed is the one-tile anecdote the signal itself refuses.
 *
 * Rows go through toCatalogListDto exactly as /api/products does, because the
 * DTO is where price privacy lives, and through toCardRow so the rail cannot
 * drift from the tile every other rail draws.
 */
async function movingIn(within: CategoryNode, ctx: LeadContext): Promise<RailTile[]> {
  const rows = await getTrendingProducts({
    limit: MOVING_LIMIT,
    categoryId: within.id,
    b2c: ctx.wantsB2B ? undefined : true,
  });
  const channel = ctx.wantsB2B ? "B2B" : "B2C";
  const tiles = rows
    .map((row) => ({ ...toCatalogListDto(row as any, channel, ctx.currency), rating: row.rating ?? null }))
    .filter((dto) => !ctx.wantsB2B || dto.isB2BEnabled === true)
    .map((dto): RailTile => {
      const card = toCardRow(dto, ctx.locale);
      return {
        ...card,
        // The category eyebrow only where it says more than the filter chip
        // already does: a product filed under a child names the child; one
        // filed directly under the category falls through to its supplier.
        category: dto.category?.slug === within.slug ? undefined : card.category,
        priceBands: ctx.wantsB2B ? publishedBands(dto) : undefined,
      };
    });
  if (ctx.wantsB2B && tiles.length < MIN_TRENDING_PRODUCTS) return [];
  return tiles;
}

/**
 * The roots with the most listings the grid would show, most first.
 *
 * One grouped count over Product — bounded by the number of categories, not by
 * the catalogue — under the visibility rule the grid itself applies, rolled up
 * the tree in this process so a listing filed three levels down counts for
 * its root. Ties fall back to the tree's own order.
 *
 * NO COUNT IS PRINTED. In consumer mode the figure is exactly what clicking the
 * chip returns; in B2B mode it is the discoverable subset of it, because the
 * signal's visibility rule is the public one. A number that is "about right"
 * beside a facet is the kind of number FacetRail exists to refuse, so the count
 * ranks and excludes, and is never shown.
 */
async function topCategoriesByListings(tree: CategoryNode[], wantsB2B: boolean): Promise<CategoryNode[]> {
  const visible: Prisma.ProductWhereInput = wantsB2B
    ? { ...publicProductWhere(undefined), isB2BEnabled: true }
    : publicProductWhere(true);
  const { data: groups } = await read(
    () => db.product.groupBy({ by: ["categoryId"], where: visible, _count: { _all: true } }),
    {
      name: "catalogue.listingsByCategory",
      cache: { key: `catalogue:listingsByCategory:${wantsB2B ? "b2b" : "b2c"}`, ttlMs: 60_000 },
    },
  );
  const listings = new Map<string, number>();
  for (const group of groups) {
    if (group.categoryId) listings.set(group.categoryId, group._count._all);
  }
  return rankRootsByListings(tree, listings).slice(0, TOP_CATEGORY_LIMIT);
}

/** Roots by their subtree's listings, most first; a root with none is not offered. */
function rankRootsByListings(tree: CategoryNode[], listings: Map<string, number>): CategoryNode[] {
  const subtreeTotal = (node: CategoryNode): number =>
    (listings.get(node.id) ?? 0) + node.children.reduce((sum, child) => sum + subtreeTotal(child), 0);
  return tree
    .map((root, order) => ({ root, order, total: subtreeTotal(root) }))
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || a.order - b.order)
    .map((entry) => entry.root);
}

/** The chip every category strip on this page is built from. */
const CATEGORY_CHIP =
  "u-focus u-state-wash u-meta inline-flex items-center gap-1.5 rounded-pill bg-neutral-soft px-3 py-1 font-medium text-ink-2 ring-1 ring-neutral-rule";

/**
 * The lead, rendered. Each surface renders only when it has rows, and each
 * states its basis in a dateline the way the home page's rails do — the
 * trending window is the module's own constant, so the sentence cannot drift
 * from the measurement.
 */
async function CatalogueLeadView({
  lead,
  searchParams,
  locale,
  wantsB2B,
}: {
  lead: CatalogueLead;
  searchParams: SearchParams;
  locale: "en" | "ar";
  wantsB2B: boolean;
}) {
  const t = await getTranslations("catalogue");
  const within = lead.within;
  const withinLabel = within ? categoryLabel(within, locale) : "";

  return (
    <>
      {/* Chips keep every other filter in force: narrowing by category is one
          more filter, not a new search. */}
      {within && within.children.length > 0 && (
        <nav aria-label={t("context.browseWithin", { category: withinLabel })} className="mb-6">
          <Eyebrow as="h2" className="mb-2">
            {t("context.browseWithin", { category: withinLabel })}
          </Eyebrow>
          <ul className="flex flex-wrap gap-2">
            {within.children.map((child) => (
              <li key={child.slug}>
                <Link href={catalogHref(searchParams, { category: child.slug })} className={CATEGORY_CHIP}>
                  {categoryLabel(child, locale)}
                </Link>
              </li>
            ))}
          </ul>
          <Dateline className="mt-2">{t("context.browseWithinBasis")}</Dateline>
        </nav>
      )}

      {within && lead.moving.length > 0 && (
        <section className="mb-6 border-b border-hairline pb-6">
          <SectionHeader
            eyebrow={t("context.movingEyebrow")}
            title={t("context.moving", { category: withinLabel })}
            dateline={t("context.movingBasis", { days: TRENDING_WINDOW_DAYS })}
          />
          <ProductGrid>
            {lead.moving.map((tile, index) => (
              // The card gates the ladder on isB2B itself, so a consumer tile
              // cannot be handed wholesale breaks by a caller that forgot.
              <ProductCard key={tile.id} index={index} {...tile} locale={locale} isB2B={wantsB2B} />
            ))}
          </ProductGrid>
        </section>
      )}

      {lead.topCategories.length > 0 && (
        <nav aria-label={t("context.topCategories")} className="mb-6">
          <Eyebrow as="h2" className="mb-2">
            {t("context.topCategories")}
          </Eyebrow>
          <ul className="flex flex-wrap gap-2">
            {lead.topCategories.map((root) => {
              const Icon = categoryIcon(root.iconName, root.slug);
              return (
                <li key={root.slug}>
                  <Link href={catalogHref(searchParams, { category: root.slug })} className={CATEGORY_CHIP}>
                    <Icon className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                    {categoryLabel(root, locale)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Dateline className="mt-2">{t("context.topCategoriesBasis")}</Dateline>
        </nav>
      )}
    </>
  );
}

async function ProductGridSection({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("catalogue");
  // The card eyebrow follows the visitor, and both halves of every name are on
  // the DTO. Reading the locale here rather than inside the card keeps the card
  // free of a second source of truth for it.
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  // Narrowed, not cast: the card row helper takes the two locales the
  // storefront ships, and anything else in the cookie is English.
  const cardLocale: "en" | "ar" = locale === "ar" ? "ar" : "en";
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
  // The lead above the grid is fetched WITH the page, not after it: the two
  // have no dependency, and serialising them would add the signal's round
  // trips to the time this section spends as a skeleton.
  const [{ products, totalPages, total, search }, lead] = await Promise.all([
    fetchBackendJson<{
      products: any[];
      total: number;
      totalPages: number;
      search: CatalogSearchOutcome;
    }>(`/api/products?${qs.toString()}`),
    loadCatalogueLead(filters, searchParams.search, { locale: cardLocale, wantsB2B, currency, page }),
  ]);

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
      <CatalogueLeadView lead={lead} searchParams={searchParams} locale={cardLocale} wantsB2B={wantsB2B} />

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
      <div className="mx-auto max-w-shell px-gutter py-block">
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
