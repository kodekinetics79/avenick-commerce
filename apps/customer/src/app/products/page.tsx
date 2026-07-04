import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal, PackageSearch } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { SortSelect } from "@/components/products/sort-select";
import { PageLoader } from "@avenick/ui";
import { fetchBackendJson } from "@/lib/backend";

export const metadata: Metadata = { title: "Products — Avenick Commerce" };

export const dynamic = "force-dynamic";

interface SearchParams {
  category?: string;
  search?: string;
  page?: string;
  sort?: string;
  inStock?: string;
  minPrice?: string;
  maxPrice?: string;
}

const PRICE_RANGES = [
  { label: "Under AED 50", min: 0, max: 50 },
  { label: "AED 50 – 200", min: 50, max: 200 },
  { label: "AED 200 – 500", min: 200, max: 500 },
  { label: "AED 500+", min: 500, max: 999999 },
];

async function ProductGrid({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const limit = 24;
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    b2c: "true",
    ...(searchParams.search ? { search: searchParams.search } : {}),
    ...(searchParams.category ? { categorySlug: searchParams.category } : {}),
    ...(searchParams.inStock === "1" ? { inStock: "true" } : {}),
    ...(searchParams.sort ? { sort: searchParams.sort } : {}),
  });
  const { products, totalPages, total } = await fetchBackendJson<{ products: any[]; total: number; totalPages: number }>(`/api/products?${qs.toString()}`);

  const sortedProducts =
    searchParams.sort === "price_asc" || searchParams.sort === "price_desc"
      ? [...products].sort((a, b) => {
          const aPrice = Number(a.prices?.find((pr: { type: string }) => pr.type === "B2C")?.price ?? a.prices?.[0]?.price ?? 0);
          const bPrice = Number(b.prices?.find((pr: { type: string }) => pr.type === "B2C")?.price ?? b.prices?.[0]?.price ?? 0);
          return searchParams.sort === "price_desc" ? bPrice - aPrice : aPrice - bPrice;
        })
      : products;

  if (sortedProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <PackageSearch className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No products found</h3>
        <p className="text-muted-foreground text-sm mb-4">لم يتم العثور على منتجات</p>
        <p className="text-sm text-muted-foreground mb-6">Try adjusting your filters or search term.</p>
        <Link href="/products" className="text-sm text-primary hover:underline font-medium">Clear all filters →</Link>
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
          const b2cPrice = p.prices?.find((pr: { type: string; price: number }) => pr.type === "B2C") ?? p.prices?.[0];
          const stock = p.inventory?.[0];
          return (
            <ProductCard
              key={p.id}
              id={p.id}
              slug={p.slug}
              nameEn={p.nameEn}
              nameAr={p.nameAr}
              imageUrl={p.images?.[0]?.url}
              price={b2cPrice ? Number(b2cPrice.price) : 0}
              sku={p.sku}
              sellerId={p.sellerId}
              sellerName={p.seller?.businessNameEn}
              inStock={stock ? stock.qty - stock.reservedQty > 0 : false}
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

  const currentMin = searchParams.minPrice ? parseInt(searchParams.minPrice) : undefined;
  const currentMax = searchParams.maxPrice ? parseInt(searchParams.maxPrice) : undefined;

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

      {/* Price range */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <h3 className="font-semibold text-sm mb-3">Price Range</h3>
        <ul className="space-y-0.5">
          {PRICE_RANGES.map((r) => {
            const active = currentMin === r.min && currentMax === r.max;
            return (
              <li key={r.label}>
                <a
                  href={active ? buildUrl({ minPrice: undefined, maxPrice: undefined }) : buildUrl({ minPrice: String(r.min), maxPrice: String(r.max) })}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary/10 text-primary font-medium" : "hover:bg-secondary text-muted-foreground"}`}
                >
                  {r.label}
                </a>
              </li>
            );
          })}
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
