import type { Metadata } from "next";
import Link from "next/link";
import { Search, PackageSearch, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { fetchBackendJson } from "@/lib/backend";

export const metadata: Metadata = { title: "Search — Avenick Commerce" };

const POPULAR_SEARCHES = [
  "Safety helmets", "Office chairs", "Industrial gloves", "Fire extinguisher",
  "CCTV cameras", "Steel pipes", "Laptop bags", "First aid kit",
];

const POPULAR_CATEGORIES = [
  { name: "Industrial Supplies", slug: "industrial-supplies" },
  { name: "Safety & PPE", slug: "safety-ppe" },
  { name: "Electronics", slug: "electronics" },
  { name: "Office Supplies", slug: "office-supplies" },
];

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; sort?: string } }) {
  const query = (searchParams.q ?? "").trim();

  const { products } = query
    ? await fetchBackendJson<{ products: any[] }>(`/api/products?limit=24&search=${encodeURIComponent(query)}&b2c=true`)
    : { products: [] as any[] };

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">
              {query ? <>Results for <em className="not-italic text-primary">&ldquo;{query}&rdquo;</em></> : "Search Products"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            {query ? <><span className="font-semibold text-foreground">{products.length}</span> product{products.length !== 1 ? "s" : ""} found</> : "Enter a keyword above to search"}
          </p>

          {/* No query — show discovery */}
          {!query && (
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-primary/100" />
                  <h2 className="font-semibold">Popular Searches</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCHES.map((s) => (
                    <Link key={s} href={`/search?q=${encodeURIComponent(s)}`}
                      className="px-3 py-1.5 bg-white border border-border rounded-full text-sm hover:border-primary hover:text-primary transition-colors">
                      {s}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="font-semibold mb-3">Browse by Category</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {POPULAR_CATEGORIES.map((cat) => (
                    <Link key={cat.slug} href={`/products?category=${cat.slug}`}
                      className="bg-white rounded-2xl border border-border p-4 text-sm font-medium text-center hover:border-primary hover:shadow-sm transition-all">
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Query but no results */}
          {query && products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-border text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <PackageSearch className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No results for &ldquo;{query}&rdquo;</h3>
              <p className="text-sm text-muted-foreground mb-1">لم يتم العثور على منتجات</p>
              <p className="text-sm text-muted-foreground mb-6">Try a different keyword or browse by category.</p>
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {POPULAR_SEARCHES.slice(0, 4).map((s) => (
                  <Link key={s} href={`/search?q=${encodeURIComponent(s)}`}
                    className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 rounded-full text-sm hover:bg-primary/20 transition-colors">
                    {s}
                  </Link>
                ))}
              </div>
              <Link href="/products" className="text-sm text-primary hover:underline">Browse all products →</Link>
            </div>
          )}

          {/* Results */}
          {query && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => {
                const price = p.prices?.[0];
                const stock = p.inventory?.[0];
                return (
                  <ProductCard
                    key={p.id}
                    id={p.id}
                    slug={p.slug}
                    nameEn={p.nameEn}
                    nameAr={p.nameAr}
                    imageUrl={p.images?.[0]?.url}
                    price={price ? Number(price.price) : 0}
                    sku={p.sku}
                    sellerId={p.sellerId}
                    sellerName={p.seller?.businessNameEn}
                    inStock={stock?.inStock === true}
                    moq={p.moq}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
