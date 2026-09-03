import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import { Button, Dateline, EmptyState, Num, PageHeader } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { fetchBackendJson } from "@/lib/backend";

interface Props { params: { slug: string } }

const PAGE_LIMIT = 24;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categories = await fetchBackendJson<any[]>("/api/categories");
  const cat = categories.find((c) => c.slug === params.slug);
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
  const categories = await fetchBackendJson<any[]>("/api/categories");
  const category = categories.find((c) => c.slug === params.slug);
  if (!category) return notFound();

  // `total` is the database count across the whole category. The heading used to
  // read `products.length`, which is capped at the page limit below — so a
  // category with 300 listings announced "24 products" and the visitor had no
  // way to know the other 276 existed.
  const { products, total } = await fetchBackendJson<{ products: any[]; total: number }>(
    `/api/products?limit=${PAGE_LIMIT}&b2c=true&categorySlug=${encodeURIComponent(params.slug)}`,
  );

  // The heading follows the visitor's locale. It used to render nameAr as the h1
  // and nameEn as the subtitle for everyone, so an English visitor got an Arabic
  // heading and an Arabic visitor got their own language demoted to a caption.
  const primaryName = locale === "ar" ? (category.nameAr?.trim() || category.nameEn) : category.nameEn;
  const secondaryName = locale === "ar" ? category.nameEn : category.nameAr?.trim() || undefined;

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-block">
        <PageHeader
          eyebrow={t("category.eyebrow")}
          title={primaryName}
          description={secondaryName}
          breadcrumbs={[
            { label: t("filters.allProducts"), href: "/products" },
            { label: primaryName },
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
