import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AlertCircle, PackageSearch } from "lucide-react";
import type { CatalogSearchOutcome } from "@avenick/database";
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

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; sort?: string } }) {
  const query = (searchParams.q ?? "").trim();
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  const t = await getTranslations("catalogue");

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
        className="u-focus u-state-wash u-meta rounded-pill bg-neutral-soft px-3 py-1 font-medium text-ink-2 ring-1 ring-neutral-rule"
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
                  const Icon = categoryIcon(cat.iconName);
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
         * The certificate carries exactly ONE action. The category row below is
         * discovery, not a second call to action, so it sits outside the plate
         * rather than being stacked inside it.
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
            {categories.length > 0 && (
              <section className="mt-block">
                <Eyebrow as="h2" className="mb-3">{t("search.browseByCategory")}</Eyebrow>
                <div className="flex flex-wrap gap-2">{categoryPills()}</div>
              </section>
            )}
          </>
        )}

        {/* ── Query ran but matched nothing ────────────────── */}
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
                  className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
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
