import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal, PackageSearch } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { SortSelect } from "@/components/products/sort-select";
import { PageLoader } from "@avenick/ui";
import { fetchBackendJson } from "@/lib/backend";
import { getServerB2BContext } from "@/lib/b2b-server";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { browseAllHref } from "@/lib/catalog-navigation";
import { platformName } from "@avenick/utils/portal-config";

export const metadata: Metadata = { title: `Products — ${platformName()}` };

export const dynamic = "force-dynamic";

interface SearchParams {
  category?: string;
  search?: string;
  page?: string;
  sort?: string;
  inStock?: string;
  minPrice?: string;
  maxPrice?: string;
  b2b?: string;
  currency?: string;
}

async function ProductGrid({ searchParams }: { searchParams: SearchParams }) {
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
    ...(searchParams.inStock === "1" ? { inStock: "true" } : {}),
    ...(searchParams.sort ? { sort: searchParams.sort } : {}),
  });
  const { products, totalPages, total } = await fetchBackendJson<{ products: any[]; total: number; totalPages: number }>(`/api/products?${qs.toString()}`);

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
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <PackageSearch className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">
          {searchParams.category ? "No products in this category yet" : "No products found"}
        </h3>
        <p className="text-muted-foreground text-sm mb-4">لم يتم العثور على منتجات</p>
        <p className="text-sm text-muted-foreground mb-6">
          {searchParams.category
            ? "This category has no published products right now."
            : "Try adjusting your filters or search term."}
        </p>
        <Link href={browseAllHref(searchParams)} className="text-sm text-primary hover:underline font-medium">
          Browse all products →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> products
          {searchParams.search && <> for <em>&ldquo;{searchParams.search}&rdquo;</em></>}
        </p>
        <SortSelect />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`?${new URLSearchParams({ ...searchParams, page: String(p) })}`}
              className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${p === page ? "bg-primary/100 text-white" : "bg-card border border-border hover:bg-primary/10"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

async function FilterSidebar({ searchParams }: { searchParams: SearchParams }) {
  const categories = await fetchBackendJson<any[]>("/api/categories");

  const buildUrl = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...searchParams, ...updates };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.delete("page");
    return `/products?${params.toString()}`;
  };

  return (
    <aside className="w-full lg:w-60 shrink-0 space-y-4">
      {/* Categories */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Categories</h3>
        </div>
        <ul className="space-y-0.5">
          <li>
            <a href="/products" className={`block px-3 py-2 rounded-lg text-sm transition-colors ${!searchParams.category ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-muted-foreground"}`}>
              All Products
            </a>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <a
                href={buildUrl({ category: cat.slug })}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${searchParams.category === cat.slug ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-muted-foreground"}`}
              >
                {cat.nameEn}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* In stock */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h3 className="font-semibold text-sm mb-3">Availability</h3>
        <a
          href={searchParams.inStock === "1" ? buildUrl({ inStock: undefined }) : buildUrl({ inStock: "1" })}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${searchParams.inStock === "1" ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-muted-foreground"}`}
        >
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${searchParams.inStock === "1" ? "bg-primary/100 border-primary/100" : "border-muted-foreground"}`}>
            {searchParams.inStock === "1" && <span className="text-white text-xs">✓</span>}
          </span>
          In Stock Only
        </a>
      </div>

      {/* Clear filters */}
      {(searchParams.category || searchParams.inStock || searchParams.minPrice) && (
        <a href="/products" className="block text-center text-sm text-primary hover:underline py-1">
          Clear all filters
        </a>
      )}
    </aside>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const title = searchParams.search
    ? `Results for "${searchParams.search}"`
    : searchParams.category
    ? "Category Products"
    : "All Products — جميع المنتجات";

  return (
    <MainLayout>
      <div className="bg-background min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">{title}</h1>
          <div className="flex flex-col lg:flex-row gap-6">
            <Suspense fallback={<div className="w-60 h-64 bg-card animate-pulse rounded-2xl" />}>
              <FilterSidebar searchParams={searchParams} />
            </Suspense>
            <div className="flex-1 min-w-0">
              <Suspense fallback={<PageLoader />}>
                <ProductGrid searchParams={searchParams} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
