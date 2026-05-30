import Link from "next/link";
import Image from "next/image";
import { Tag, Clock, Filter, ShoppingCart } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { MOCK_PRODUCTS } from "@manzil/database";
import { Button, Badge } from "@manzil/ui";

export const metadata = { title: "Deals & Promotions" };

const CATEGORIES = ["All", "Safety & PPE", "Industrial Supplies", "Office Supplies", "Building Materials", "Food & Hospitality"];

export default function DealsPage() {
  const dealsProducts = MOCK_PRODUCTS.filter((p) => p.discount > 0);

  return (
    <MainLayout>
      {/* Hero Banner */}
      <section className="relative bg-gradient-to-br from-red-700 via-red-600 to-orange-500 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm mb-4">
              <Tag className="h-3.5 w-3.5" />
              Limited Time Offers — عروض محدودة
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-2 tracking-tight">Today&apos;s Best Deals</h1>
            <p className="text-orange-100 text-lg mb-3">Save up to 25% on top products from verified GCC suppliers.</p>
            <div className="flex items-center gap-3 text-sm text-orange-200">
              <span className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> {CATEGORIES.length - 1} categories on sale</span>
              <span className="w-1 h-1 rounded-full bg-orange-300" />
              <span>Free returns on all deals</span>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-black/20 border border-white/20 rounded-2xl px-8 py-5 backdrop-blur-sm shrink-0">
            <Clock className="h-10 w-10 text-yellow-300 shrink-0" />
            <div>
              <p className="text-xs text-orange-200 uppercase tracking-widest mb-1">Offers end in</p>
              <p className="text-4xl font-mono font-bold tracking-wider">14:22:08</p>
              <p className="text-xs text-orange-300 mt-1">Prices reset daily at midnight</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category filters */}
        <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${cat === "All" ? "bg-orange-500 text-white" : "bg-white border border-border hover:border-orange-300 text-muted-foreground hover:text-orange-600"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {dealsProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all group">
              <Link href={`/products/${product.slug}`}>
                <div className="relative aspect-square bg-muted overflow-hidden">
                  <Image src={product.imageUrl} alt={product.nameEn} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 50vw, 25vw" />
                  {product.discount > 0 && (
                    <div className="absolute top-2 start-2 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                      -{product.discount}% OFF
                    </div>
                  )}
                  {!product.inStock && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                      <span className="bg-white text-xs font-semibold px-3 py-1.5 rounded-full">Out of Stock</span>
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3.5">
                <p className="text-xs text-muted-foreground mb-1">{product.brand}</p>
                <Link href={`/products/${product.slug}`}>
                  <h3 className="text-sm font-semibold line-clamp-2 mb-2.5 hover:text-orange-600 transition-colors leading-snug">{product.nameEn}</h3>
                </Link>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-lg font-bold text-orange-600">
                    {product.currency} {(product.price * (1 - product.discount / 100)).toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    {product.currency} {product.price.toFixed(2)}
                  </span>
                  <span className="ml-auto text-xs font-semibold text-green-600">
                    Save {product.currency} {(product.price * product.discount / 100).toFixed(0)}
                  </span>
                </div>
                <Button size="sm" variant="primary" className="w-full" disabled={!product.inStock}>
                  <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                  {product.inStock ? "Add to Cart" : "Out of Stock"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {dealsProducts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No deals in this category right now.</p>
            <p className="text-sm">Check back soon — new deals added daily.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
