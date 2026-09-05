import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import { getTrendingProducts, TRENDING_WINDOW_DAYS } from "@avenick/database";
import { Button, Dateline, EmptyState, Eyebrow, Num, PageHeader, SectionHeader } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel } from "@/lib/catalog-categories";
import { toCatalogListDto } from "@/lib/catalog-list-dto";
import { categoryTrail, findCategory, type CategoryNode } from "@/lib/category-tree";
import { toCardRow, type CardRow } from "@/lib/product-card-row";
import { readPublicCategoryTree } from "@/lib/public-category-tree";

interface Props { params: { slug: string } }

const PAGE_LIMIT = 24;

/** Tiles in the "Moving in" rail: one row of the grid beneath it. */
const MOVING_LIMIT = 4;

/**
 * The "Moving in <category>" rail: the view signal ranked INSIDE this category
 * and every category beneath it — the same subtree the grid below lists from.
 *
 * The thresholds are the home rail's, unchanged: a product needs the view
 * floor inside the window, and three products must clear it before anything
 * renders. So this is empty before any view has been recorded, empty on a
 * quiet week, and empty in a category where only two products are being
 * looked at. Each of those is the signal's own answer and the page draws no
 * rail for it — there is no fallback ordering here and no "popular" label on
 * a list nothing ranked.
 *
 * Rows go through toCatalogListDto exactly as /api/products does, because the
 * DTO is where price privacy lives; and through toCardRow so this rail cannot
 * drift from the tile every other rail draws. The channel is the grid's own:
 * this page asks the catalogue for no channel, so neither does the rail.
 *
 * A failure is an empty rail, never a failed page: the rail is garnish on a
 * result, and the result must not 500 because its garnish did.
 */
async function movingInCategory(category: CategoryNode, locale: "en" | "ar"): Promise<CardRow[]> {
  try {
    const rows = await getTrendingProducts({ limit: MOVING_LIMIT, categoryId: category.id });
    return rows.map((row) => {
      const dto = { ...toCatalogListDto(row as any, "B2C"), rating: row.rating ?? null };
      const card = toCardRow(dto, locale);
      // The tile's category eyebrow is kept only when it says more than the h1
      // already does: a product filed under a child category names the child,
      // one filed directly under this category falls through to its supplier,
      // exactly as the grid below does for every tile.
      return { ...card, category: dto.category?.slug === category.slug ? undefined : card.category };
    });
  } catch (error) {
    console.error("Unable to load the category activity rail", error);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categories = (await readPublicCategoryTree()) as unknown as CategoryNode[];
  // Searched at any DEPTH. `Array.find` walks roots only, which is why every
  // subcategory page in the storefront rendered the not-found body.
  const cat = findCategory(categories, params.slug);
  // The unknown-slug fallback was the English literal "Category" for every
  // visitor. A tab title is a user-visible string, so it comes out of the tree
  // like every other one.
  if (!cat) {
    const t = await getTranslations("catalogue");
    return { title: t("category.eyebrow") };
  }
  // No platform-name suffix: the root layout declares
  // `title.template: "%s | <platform>"`, so appending it here produced
  // "Electronics | Avenick | Avenick". The name also follows the visitor's
  // locale, the same way the h1 below does — a tab title in a different
  // language from the page it labels is the same defect, one layer up.
  const locale = cookies().get("AVENICK_LOCALE")?.value ?? "en";
  return { title: locale === "ar" && cat.nameAr?.trim() ? cat.nameAr : cat.nameEn };
}

export default async function CategoryPage({ params }: Props) {
  const locale = (cookies().get("AVENICK_LOCALE")?.value ?? "en") as "en" | "ar";
  const t = await getTranslations("catalogue");
  const categories = (await readPublicCategoryTree()) as unknown as CategoryNode[];
  const category = findCategory(categories, params.slug);
  const trail = categoryTrail(categories, params.slug);
  if (!category) return notFound();

  // `total` is the database count across the whole category. The heading used to
  // read `products.length`, which is capped at the page limit below — so a
  // category with 300 listings announced "24 products" and the visitor had no
  // way to know the other 276 existed.
  //
  // The rail is fetched alongside the page, not after it: the two have no
  // dependency and serialising them would add the signal's round trips to the
  // time this page spends blank.
  const [{ products, total }, moving] = await Promise.all([
    fetchBackendJson<{ products: any[]; total: number }>(
      `/api/products?limit=${PAGE_LIMIT}&categorySlug=${encodeURIComponent(params.slug)}`,
    ),
    movingInCategory(category, locale),
  ]);

  // The heading follows the visitor's locale. It used to render nameAr as the h1
  // and nameEn as the subtitle for everyone, so an English visitor got an Arabic
  // heading and an Arabic visitor got their own language demoted to a caption.
  const primaryName = locale === "ar" ? (category.nameAr?.trim() || category.nameEn) : category.nameEn;
  const secondaryName = locale === "ar" ? category.nameEn : category.nameAr?.trim() || undefined;

  return (
    <MainLayout>
      <div className="mx-auto max-w-shell px-gutter py-block">
        <PageHeader
          eyebrow={t("category.eyebrow")}
          title={primaryName}
          description={secondaryName}
          /*
            The FULL ancestor trail, not "All products › this one". The
            catalogue is a tree of unlimited depth and this crumb was two fixed
            entries, so a third-level category showed no path back to its
            grandparent — the trail a buyer needs most is exactly the one a deep
            catalogue makes longest. The last entry carries no href because it
            is the page you are on.
          */
          breadcrumbs={[
            { label: t("filters.allProducts"), href: "/products" },
            ...trail.map((node, index) => ({
              label: locale === "ar" ? node.nameAr?.trim() || node.nameEn : node.nameEn,
              ...(index < trail.length - 1 ? { href: `/categories/${node.slug}` } : {}),
            })),
          ]}
          linkComponent={Link}
        />

        {products.length === 0 ? (
          /*
           * THE CERTIFICATE, and the marketplace move.
           *
           * An empty category is the emptiest surface in the product, and it is
           * also the most differentiated one available: nobody lists this yet,
           * so ask for it. That is completely true — it invents no supplier, no
           * count and no promise — and it is exactly what a procurement buyer
           * wants next. A "browse everything" link, by contrast, answers a
           * question they did not ask.
           */
          <EmptyState
            variant="certificate"
            glyph={<PackageSearch />}
            eyebrow={t("empty.eyebrow")}
            headline={t("category.empty.headline", { category: primaryName })}
            body={t("category.empty.body")}
            action={
              <Button variant="secondary" size="md" asChild>
                <Link href="/b2b/rfq/new">{t("empty.requestQuote")}</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/*
              BROWSE WITHIN. The category's own children, from the tree the API
              already pruned to categories with a published listing beneath
              them — so every chip leads to a populated page, and a leaf offers
              nothing rather than an empty row. One click narrows without the
              filter panel; the breadcrumb above is the way back up.
            */}
            {category.children.length > 0 && (
              <nav aria-label={t("context.browseWithin", { category: primaryName })} className="mb-6">
                <Eyebrow as="h2" className="mb-2">
                  {t("context.browseWithin", { category: primaryName })}
                </Eyebrow>
                <ul className="flex flex-wrap gap-2">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/categories/${encodeURIComponent(child.slug)}`}
                        className="u-focus u-state-wash u-meta inline-block rounded-pill bg-neutral-soft px-3 py-1 font-medium text-ink-2 ring-1 ring-neutral-rule"
                      >
                        {categoryLabel(child, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Dateline className="mt-2">{t("context.browseWithinBasis")}</Dateline>
              </nav>
            )}

            {/*
              MOVING IN. Rendered only when the scoped signal has rows — see
              movingInCategory for the three ways it is legitimately empty. The
              dateline states the basis and the window the way the home page's
              rails do; the window is the module's own constant, so the sentence
              cannot drift from the measurement.
            */}
            {moving.length > 0 && (
              <section className="mb-6 border-b border-hairline pb-6">
                <SectionHeader
                  eyebrow={t("context.movingEyebrow")}
                  title={t("context.moving", { category: primaryName })}
                  dateline={t("context.movingBasis", { days: TRENDING_WINDOW_DAYS })}
                />
                <ProductGrid>
                  {moving.map((card, index) => (
                    <ProductCard key={card.id} index={index} {...card} locale={locale} />
                  ))}
                </ProductGrid>
              </section>
            )}

            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-border-strong pb-3">
              <p className="u-ui flex flex-wrap items-baseline gap-x-1.5 text-ink-2">
                <Num value={total} rank="inline" />
                <span>{t("productsCount", { count: total })}</span>
              </p>
              <Dateline>
                {total > products.length
                  ? t("category.showingFirst", { shown: String(products.length), total: String(total) })
                  : t("category.showingAll")}
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
                    // The eyebrow follows the visitor's language. No `category`
                    // is passed here on purpose: this page IS one category, and
                    // repeating its name under all twenty-four tiles says
                    // nothing the h1 has not already said — so the eyebrow falls
                    // through to who lists it, which is the useful fact.
                    sellerNameAr={p.seller?.businessNameAr ?? undefined}
                    inStock={stock?.inStock === true}
                    availabilityStatus={stock?.status}
                    hasVariants={p.hasVariants === true}
                    priceTiered={p.priceTiered === true}
                    moq={p.moq}
                    locale={locale}
                  />
                );
              })}
            </ProductGrid>

            {/* This route has no pagination. Rather than let 24 cards imply the
                whole category, it says how many are not shown and hands the
                visitor the catalogue surface that does paginate. */}
            {total > products.length && (
              <p className="u-ui mt-block text-ink-2">
                {t("category.moreNotShown", {
                  count: total - products.length,
                  formatted: String(total - products.length),
                })}{" "}
                <Link
                  href={`/products?category=${encodeURIComponent(params.slug)}`}
                  className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
                >
                  {t("category.seeFull")}
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
