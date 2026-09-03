import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
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
  if (!cat) return { title: "Category" };
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
          eyebrow="Category"
          title={primaryName}
          description={secondaryName}
          breadcrumbs={[
            { label: "All products", href: "/products" },
            { label: primaryName },
          ]}
          linkComponent={Link}
        />

        {products.length === 0 ? (
          <EmptyState
            eyebrow="Nothing published"
            headline={`No seller has a published listing in ${primaryName} yet.`}
            body="The category exists in the catalogue; nothing discoverable is filed under it right now."
            icon={<PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products">Browse all products</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-border-strong pb-3">
              <p className="u-ui flex items-baseline gap-1.5 text-ink-2">
                <Num value={total} rank="inline" />
                <span>{total === 1 ? "product" : "products"}</span>
              </p>
              <Dateline>
                {total > products.length
                  ? `Showing the first ${products.length} of ${total}`
                  : "Showing every listing in this category"}
              </Dateline>
            </div>

            <ProductGrid>
              {products.map((p) => {
                const stock = p.inventory?.[0];
                return (
                  <ProductCard key={p.id} id={p.id} slug={p.slug} nameEn={p.nameEn} nameAr={p.nameAr} imageUrl={p.images?.[0]?.url} price={p.cardPrice?.amount} currency={p.cardPrice?.currency} vatRate={p.cardPrice?.vatRate} priceIsFrom={p.cardPrice?.isFrom === true} sku={p.sku} sellerId={p.sellerId} sellerName={p.seller?.businessNameEn} inStock={stock?.inStock === true} availabilityStatus={stock?.status} hasVariants={p.hasVariants === true} priceTiered={p.priceTiered === true} moq={p.moq} locale={locale} />
                );
              })}
            </ProductGrid>

            {/* This route has no pagination. Rather than let 24 cards imply the
                whole category, it says how many are not shown and hands the
                visitor the catalogue surface that does paginate. */}
            {total > products.length && (
              <p className="u-ui mt-block text-ink-2">
                {total - products.length} more listing{total - products.length !== 1 ? "s" : ""} not shown on this page.{" "}
                <Link
                  href={`/products?category=${encodeURIComponent(params.slug)}`}
                  className="u-focus rounded-nested font-medium text-primary-ink hover:underline"
                >
                  See the full category
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
