import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AlertCircle, PackageSearch } from "lucide-react";
import { classifyCatalogSearch, type CatalogSearchOutcome } from "@avenick/database";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  LightGrid,
  Num,
  PageHeader,
  Reveal,
  Surface,
} from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { categoryIcon } from "@/components/products/category-icon";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel, getPublicCategories, type PublicCategory } from "@/lib/catalog-categories";
import {
  assembleRecoveryLadder,
  brandBrowseHref,
  brandLabel,
  categoryBrowseHref,
  planSearchRecovery,
  verifiedBrandMatches,
  type BrandMatch,
  type CategoryMatch,
  type RecoveryBrand,
  type RecoveryVerification,
  type VerifiedBrandMatch,
} from "@/lib/search-recovery";
import { readPublicBrands } from "@/lib/public-brands";

// No platform-name suffix. The root layout declares
// `title.template: "%s | <platform>"`, so appending it here rendered
// "Search — Avenick | Avenick" in the tab and in every share card.
//
// generateMetadata rather than a static object: the title was the English
// literal "Search" for every visitor, and a document title is user-visible —
// the tab, the history entry, the bookmark and every share card. An Arabic
// session read the whole page in Arabic under an English tab. It says the same
// two things the h1 does, from the same message tree.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<Metadata> {
  const t = await getTranslations("catalogue");
  const query = (searchParams.q ?? "").trim();
  return { title: query ? t("title.search", { query }) : t("search.titleEmpty") };
}

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

/** The two fields a verification read needs: how many, and whether the search ran at all. */
interface CountResponse {
  total: number;
  search?: CatalogSearchOutcome;
}

/**
 * /api/brands, reduced to what name matching needs. Empty on failure: the
 * brands are a recovery aid, and a failed aid must not fail the search.
 */
async function getRecoveryBrands(): Promise<RecoveryBrand[]> {
  try {
    const result = (await readPublicBrands()) as unknown;
    if (!Array.isArray(result)) return [];
    return result.flatMap((brand) => {
      if (!brand || typeof brand !== "object") return [];
      const { slug, nameEn, nameAr, _count } = brand as { slug?: unknown; nameEn?: unknown; nameAr?: unknown; _count?: { products?: unknown } };
      if (typeof slug !== "string" || typeof nameEn !== "string") return [];
      return [{
        slug,
        nameEn,
        nameAr: typeof nameAr === "string" ? nameAr : null,
        productCount: typeof _count?.products === "number" ? _count.products : null,
      }];
    });
  } catch (error) {
    console.error("Unable to load brands for search recovery", error);
    return [];
  }
}

/**
 * How many public listings each candidate brand link actually lands on.
 *
 * /api/brands counts ACTIVE, non-deleted products with no discoverability or
 * seller predicate, so its count is a candidate, not a promise. The chip links
 * to /products?brand=, and this asks that exact surface — the same predicate,
 * one row — before the chip is allowed to exist. A check that fails leaves no
 * entry, and no entry renders as no chip.
 */
async function countBrandListings(candidates: BrandMatch[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  await Promise.all(
    candidates.map(async (brand) => {
      try {
        const { total } = await fetchBackendJson<CountResponse>(`/api/products?limit=1&brand=${encodeURIComponent(brand.slug)}`);
        if (Number.isFinite(total)) totals.set(brand.slug, total);
      } catch (error) {
        console.error(`Unable to verify brand "${brand.slug}" for search recovery`, error);
      }
    }),
  );
  return totals;
}

/**
 * Run the shorter query for real. The suggestion is shown only when this says
 * the search ran AND found rows; a candidate that was never run is never
 * offered, because "try X instead" must be a fact about the catalogue.
 */
async function runRelaxedSearch(term: string | null): Promise<RecoveryVerification["relaxed"]> {
  if (!term) return null;
  try {
    const { total, search } = await fetchBackendJson<CountResponse>(`/api/products?limit=1&search=${encodeURIComponent(term)}`);
    return { status: search?.status ?? "none", total: Number.isFinite(total) ? total : 0 };
  } catch (error) {
    console.error(`Unable to verify relaxed search "${term}"`, error);
    return null;
  }
}

/** A chip that names something the query matched — one tone stronger than the neutral browse pills below it. */
const MATCH_CHIP =
  "u-focus u-state-wash u-meta inline-flex items-center gap-1.5 rounded-pill bg-primary-soft px-3 py-1 font-medium text-primary-ink ring-1 ring-primary/25";
const INLINE_LINK = "u-focus rounded-nested font-medium text-primary-ink hover:underline";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; sort?: string } }) {
  const query = (searchParams.q ?? "").trim();
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  const t = await getTranslations("catalogue");

  const [{ products, total, search }, categories, brands] = await Promise.all([
    query
      ? fetchBackendJson<SearchResponse>(`/api/products?limit=${PAGE_SIZE}&search=${encodeURIComponent(query)}`)
      : Promise.resolve({ products: [] as any[], total: 0, search: { status: "none" } as CatalogSearchOutcome }),
    getPublicCategories(),
    query ? getRecoveryBrands() : Promise.resolve([] as RecoveryBrand[]),
  ]);

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

  /*
   * RECOVERY AND PIVOT: plan (pure) → verify against the catalogue → assemble (pure).
   *
   * A query must end somewhere useful. When it matched nothing, the ladder
   * below the certificate offers, in order and only when real: categories
   * named like the query (from the live tree, any depth — /api/categories
   * already prunes to branches with public listings), brands named like it
   * (each confirmed against /products?brand= with its listing count), the
   * part-number route (only when the catalogue reports that it ran the
   * identifier tiers and matched nothing), and the query minus its last word
   * (only after that search was run and returned rows). When the query DID
   * match, the same categories and brands become chips above the grid, so a
   * text search can pivot to structured browsing in one click.
   *
   * `isRunnable` is the catalogue's own classification, so a relaxed term the
   * service would refuse is never proposed.
   */
  const plan = query
    ? planSearchRecovery({
        query,
        search,
        total,
        categories,
        brands,
        isRunnable: (term) => classifyCatalogSearch(term).status === "ran",
      })
    : null;
  const [brandTotals, relaxed] = plan
    ? await Promise.all([countBrandListings(plan.brandCandidates), runRelaxedSearch(plan.relaxedCandidate)])
    : [new Map<string, number>(), null];
  const ladder = plan ? assembleRecoveryLadder(plan, { brandTotals, relaxed }) : [];
  const pivotCategories = plan?.categories ?? [];
  const pivotBrands = plan ? verifiedBrandMatches(plan.brandCandidates, brandTotals) : [];

  // Category links for the discovery and empty states; omitted when the
  // catalog reports none rather than replaced with a typed list.
  const categoryPills = () =>
    categories.map((cat) => (
      <Link
        key={cat.slug}
        href={`/products?category=${encodeURIComponent(cat.slug)}`}
        className="u-focus u-state-wash u-meta rounded-pill bg-neutral-soft px-3 py-1 font-medium text-ink-2 ring-1 ring-neutral-rule"
      >
        {categoryLabel(cat, locale)}
      </Link>
    ));

  // A matched category, named with its parent so "Bolts" under "Fasteners" is
  // distinguishable from "Bolts" under "Anchors". "›" is Bidi-mirrored, so it
  // points the right way in Arabic without a second rule.
  const categoryChip = (match: CategoryMatch) => {
    const parent = match.trail[match.trail.length - 1];
    return (
      <Link key={`category-${match.slug}`} href={categoryBrowseHref(match.slug)} className={MATCH_CHIP}>
        {parent && <span className="text-ink-3">{categoryLabel(parent, locale)} ›</span>}
        <span>{categoryLabel(match, locale)}</span>
      </Link>
    );
  };

  // A verified brand, with the count the link lands on — a real figure, not a
  // directory count over listings the visitor may not be able to see.
  const brandChip = (match: VerifiedBrandMatch) => (
    <Link key={`brand-${match.slug}`} href={brandBrowseHref(match.slug)} className={MATCH_CHIP}>
      <span>{brandLabel(match, locale)}</span>
      <span className="text-ink-3">· {t("search.listingCount", { count: match.total })}</span>
    </Link>
  );

  const recoveryLadder = ladder.length > 0 && (
    <section className="mt-block" aria-labelledby="search-recovery-heading">
      <Eyebrow as="h2" id="search-recovery-heading" className="mb-3">
        {t("search.recovery.eyebrow")}
      </Eyebrow>
      <ol className="space-y-5">
        {ladder.map((rung) => {
          switch (rung.kind) {
            case "categories":
              return (
                <li key={rung.kind}>
                  <p className="u-ui mb-2 text-ink-2">{t("search.recovery.categories", { query })}</p>
                  <div className="flex flex-wrap gap-2">{rung.items.map(categoryChip)}</div>
                </li>
              );
            case "brands":
              return (
                <li key={rung.kind}>
                  <p className="u-ui mb-2 text-ink-2">{t("search.recovery.brands", { query })}</p>
                  <div className="flex flex-wrap gap-2">{rung.items.map(brandChip)}</div>
                </li>
              );
            case "identifier":
              return (
                <li key={rung.kind}>
                  <p className="u-ui text-ink-2">
                    {t("search.recovery.identifier", { query: rung.term })}{" "}
                    <Link href={rung.href} className={INLINE_LINK}>
                      {t("search.recovery.identifierAction")}
                    </Link>
                  </p>
                </li>
              );
            case "relaxed":
              return (
                <li key={rung.kind}>
                  <p className="u-ui text-ink-2">
                    {t("search.recovery.relaxed", { count: rung.total })}{" "}
                    <Link href={rung.href} className={INLINE_LINK}>
                      {t("search.recovery.relaxedAction", { query: rung.term })}
                    </Link>
                  </p>
                </li>
              );
            default:
              return null;
          }
        })}
      </ol>
    </section>
  );

  return (
    <MainLayout>
      <div className="mx-auto max-w-shell px-gutter py-block">
        <PageHeader
          eyebrow={t("search.eyebrow")}
          // The heading may not say "Results for" when no search was executed —
          // a refused term returns no rows because the service declined to run
          // it, not because the catalogue holds nothing.
          title={
            !query
              ? t("search.titleEmpty")
              : refused
              ? t("title.search", { query })
              : t("search.titleResults", { query })
          }
          description={!query ? t("search.prompt") : undefined}
          linkComponent={Link}
        />

        {/* ── No query: discovery ─────────────────────────── */}
        {!query && (
          categories.length > 0 ? (
            <section>
              <Eyebrow as="h2" className="mb-3">{t("search.browseByCategory")}</Eyebrow>
              {/*
               * THE ONE PLACE ON THESE SURFACES WHERE A STAGGER IS LEGITIMATE.
               *
               * Nobody asked a question to get this row: it is the catalogue
               * offering itself on first paint. Staggering a RESULT set — a
               * search, a filter, a category — is the canonical "this site is
               * slow" generator, and the product grids on these pages
               * deliberately have none. The stagger is capped at six by
               * <Reveal> itself, and every tile is clickable at t=0 while its
               * opacity is still moving.
               */}
              <LightGrid className="grid grid-cols-2 gap-stack sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((cat: PublicCategory, index: number) => {
                  const Icon = categoryIcon(cat.iconName, cat.slug);
                  return (
                    <Reveal key={cat.slug} index={index} className="h-full">
                      <Surface
                        rung={2}
                        interactive
                        specular
                        data-clips-focus=""
                        className="group u-drawn-host relative h-full overflow-hidden"
                      >
                        <Link
                          href={`/products?category=${encodeURIComponent(cat.slug)}`}
                          className="flex h-full items-center gap-3 rounded-[inherit] p-4 outline-none"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-nested border border-hairline bg-surface-1 text-ink-2 transition-colors duration-hover ease-standard group-hover:bg-accent-soft group-hover:text-accent-ink">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="u-ui min-w-0 truncate font-medium text-ink-1">
                            {categoryLabel(cat, locale)}
                          </span>
                        </Link>
                        {/* The same brass rule as active nav and the product
                            tile — one gesture, drawn from the inline start. */}
                        <div className="u-drawn absolute inset-x-0 bottom-0" aria-hidden="true" />
                      </Surface>
                    </Reveal>
                  );
                })}
              </LightGrid>
            </section>
          ) : (
            <EmptyState
              variant="certificate"
              glyph={<PackageSearch />}
              eyebrow={t("search.noCategories.eyebrow")}
              headline={t("search.noCategories.headline")}
              body={t("search.noCategories.body")}
              action={
                <Button variant="secondary" size="md" asChild>
                  <Link href="/products">{t("empty.browseAll")}</Link>
                </Button>
              }
            />
          )
        )}

        {/*
         * ── Query refused as too short: no search ran, so show no grid ───
         *
         * The Arabic sentence this state used to carry inline is gone. It was a
         * bilingual crutch written before this page reached the message tree —
         * on the Arabic build it printed the Arabic twice, and on the English
         * build it printed a language the reader had not asked for. Both
         * settings live in the tree now, which is what "Arabic is a first-class
         * language" has to mean structurally.
         *
         * The certificate carries exactly ONE action. The ladder and the
         * category row below it are discovery, not a second call to action, so
         * they sit outside the plate rather than being stacked inside it. The
         * ladder can still be real here: a refused term is a short single word,
         * and a short word can still be the name of a category or a brand.
         */}
        {query && refused && (
          <>
            <EmptyState
              variant="certificate"
              glyph={<AlertCircle />}
              eyebrow={t("refused.eyebrow")}
              headline={t("refused.headline", { query, min: String(refused.minLength) })}
              body={t("refused.body")}
              action={
                <Button variant="secondary" size="md" asChild>
                  <Link href="/products">{t("empty.browseAll")}</Link>
                </Button>
              }
            />
            {recoveryLadder}
            {categories.length > 0 && (
              <section className="mt-block">
                <Eyebrow as="h2" className="mb-3">{t("search.browseByCategory")}</Eyebrow>
                <div className="flex flex-wrap gap-2">{categoryPills()}</div>
              </section>
            )}
          </>
        )}

        {/* ── Query ran but matched nothing: the certificate, then the ladder ── */}
        {query && !refused && products.length === 0 && (
          <>
            <EmptyState
              variant="certificate"
              glyph={<PackageSearch />}
              eyebrow={t("search.noMatch.eyebrow")}
              headline={t("search.noMatch.headline", { query })}
              body={identifierOnly ? t("search.noMatch.identifierBody", { query }) : t("search.noMatch.body")}
              action={
                <Button variant="secondary" size="md" asChild>
                  <Link href="/products">{t("empty.browseAll")}</Link>
                </Button>
              }
            />
            {recoveryLadder}
            {categories.length > 0 && (
              <section className="mt-block">
                <Eyebrow as="h2" className="mb-3">{t("search.browseByCategory")}</Eyebrow>
                <div className="flex flex-wrap gap-2">{categoryPills()}</div>
              </section>
            )}
          </>
        )}

        {/* ── Results — ordered by the service: exact identifier matches first ── */}
        {query && !refused && products.length > 0 && (
          <>
            {/* The pivot: what the query named, as places to browse. Every chip
                is a category from the live tree or a brand whose listing count
                was just read, so none of them lands on an empty grid. */}
            {(pivotCategories.length > 0 || pivotBrands.length > 0) && (
              <section className="mb-5" aria-labelledby="search-pivot-heading">
                <Eyebrow as="h2" id="search-pivot-heading" className="mb-2">
                  {t("search.pivot.eyebrow")}
                </Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {pivotCategories.map(categoryChip)}
                  {pivotBrands.map(brandChip)}
                </div>
              </section>
            )}

            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-border-strong pb-3">
              <p className="u-ui flex flex-wrap items-baseline gap-x-1.5 text-ink-2">
                {/* `total` is the database count across the whole result set. This
                    line used to read products.length, which is capped at the page
                    size and so under-reported every search wider than one page. */}
                <Num value={total} rank="inline" />
                <span>{t("search.productsFound", { count: total })}</span>
              </p>
              <Dateline>
                {total > products.length
                  ? t("search.rankedTruncated", { shown: String(products.length) })
                  : t("search.ranked")}
              </Dateline>
            </div>

            <ProductGrid>
              {products.map((p, index) => {
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
                    // A search crosses the whole catalogue, so what a result is
                    // filed under is the most useful thing the eyebrow can say —
                    // and it says it in the visitor's language.
                    category={p.category ? categoryLabel(p.category, locale) : undefined}
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
                {t("search.moreNotShown", { count: total - products.length, formatted: String(total - products.length) })}{" "}
                <Link
                  href={`/products?search=${encodeURIComponent(query)}`}
                  className={INLINE_LINK}
                >
                  {t("search.seeAll")}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
