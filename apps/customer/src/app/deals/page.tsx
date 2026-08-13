import Link from "next/link";
import { Tag, Clock, Filter } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { fetchBackendJson } from "@/lib/backend";

export const metadata = { title: "Deals & Promotions" };
// Live catalog data — must not prerender at build time (no DB on build machines).
export const dynamic = "force-dynamic";

const CATEGORIES = [
  { label: "All", slug: "" },
  { label: "Safety & PPE", slug: "safety-ppe" },
  { label: "Industrial", slug: "industrial-supplies" },
  { label: "Office", slug: "office-supplies" },
  { label: "Building", slug: "building-materials" },
];

// Stable, illustrative discount per product (no discount model in schema yet).
function dealDiscount(sku: string) {
  let h = 0;
  for (const c of sku) h = (h + c.charCodeAt(0)) % 100;
  return 10 + (h % 4) * 5; // 10 / 15 / 20 / 25 %
}

export default async function DealsPage() {
  const { products } = await fetchBackendJson<{ products: any[] }>("/api/products?limit=12&b2c=true");

  const deals = products
    .map((p) => {
      const base = p.prices?.[0] ? Number(p.prices[0].price) : 0;
      if (base <= 0) return null;
      const discount = dealDiscount(p.sku);
      const price = Math.round(base * (1 - discount / 100) * 100) / 100;
      const stock = p.inventory?.[0];
      const available = stock?.inStock ? 1 : 0;
      return {
        id: p.id,
        slug: p.slug,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        imageUrl: p.images?.[0]?.url,
        price,
        originalPrice: base,
        sku: p.sku,
        sellerId: p.sellerId,
        sellerName: p.seller?.businessNameEn,
        inStock: available > 0,
        hasVariants: p.hasVariants === true,
        moq: p.moq,
        category: p.category?.nameEn ?? "Industrial",
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <MainLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-600 via-red-600 to-accent-700 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute bottom-0 start-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm mb-4">
              <Tag className="h-3.5 w-3.5" /> Limited-time offers — عروض محدودة
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-2 tracking-tighter">Today&apos;s best deals</h1>
            <p className="text-white/80 text-lg">Save up to 25% on top products from verified GCC suppliers.</p>
          </div>
          <div className="flex items-center gap-4 bg-black/20 border border-white/20 rounded-2xl px-8 py-5 backdrop-blur-sm shrink-0">
            <Clock className="h-10 w-10 text-amber-300 shrink-0" />
            <div>
              <p className="text-xs text-white/70 uppercase tracking-widest mb-1">Offers end in</p>
              <p className="text-4xl font-mono font-bold tracking-wider">14:22:08</p>
              <p className="text-xs text-white/60 mt-1">Prices reset daily at midnight</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category filters */}
        <div className="flex items-center gap-3 mb-6 overflow-x-auto scrollbar-hide pb-1">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.label}
              href={cat.slug ? `/products?category=${cat.slug}` : "/deals"}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${cat.label === "All" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"}`}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {deals.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium">No deals right now.</p>
            <p className="text-sm">Check back soon — new deals added daily.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {deals.map((p) => (
              <ProductCard key={p.id} {...p} badge="SALE" />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
