import Link from "next/link";
import {
  ShieldCheck,
  Factory,
  Briefcase,
  Cpu,
  ShieldAlert,
  UtensilsCrossed,
  Building2,
  Cog,
  CheckCircle2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { db } from "@manzil/database";

const CATEGORIES = [
  { slug: "industrial-supplies", nameEn: "Industrial Supplies", nameAr: "مستلزمات صناعية", icon: Factory, color: "bg-blue-50 text-blue-600" },
  { slug: "electronics", nameEn: "Electronics", nameAr: "إلكترونيات", icon: Cpu, color: "bg-purple-50 text-purple-600" },
  { slug: "office-supplies", nameEn: "Office Supplies", nameAr: "مستلزمات مكتبية", icon: Briefcase, color: "bg-green-50 text-green-600" },
  { slug: "safety-ppe", nameEn: "Safety & PPE", nameAr: "معدات السلامة", icon: ShieldAlert, color: "bg-yellow-50 text-yellow-600" },
  { slug: "food-hospitality", nameEn: "Food & Hospitality", nameAr: "الأغذية والضيافة", icon: UtensilsCrossed, color: "bg-orange-50 text-orange-600" },
  { slug: "building-materials", nameEn: "Building Materials", nameAr: "مواد البناء", icon: Building2, color: "bg-red-50 text-red-600" },
];

async function getFeaturedProducts() {
  return db.product.findMany({
    where: { status: "ACTIVE", isB2CEnabled: true, deletedAt: null },
    take: 8,
    orderBy: { createdAt: "desc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      prices: { where: { type: "B2C", isActive: true }, take: 1 },
      seller: { select: { businessNameEn: true } },
      inventory: { select: { qty: true, reservedQty: true }, take: 1 },
      category: { select: { nameEn: true } },
    },
  });
}

export default async function HomePage() {
  const products = await getFeaturedProducts();

  const mappedProducts = products.map((p) => {
    const price = p.prices[0];
    const stock = p.inventory[0];
    const available = stock ? stock.qty - stock.reservedQty : 0;
    return {
      id: p.id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      imageUrl: p.images[0]?.url,
      price: price ? Number(price.price) : 0,
      sku: p.sku,
      sellerId: p.sellerId,
      sellerName: p.seller.businessNameEn,
      inStock: available > 0,
      moq: p.moq,
      category: p.category?.nameEn ?? "Industrial",
    };
  });

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-5 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 py-20 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 text-green-300 text-xs px-3 py-1.5 rounded-full mb-5">
              <ShieldCheck className="h-3.5 w-3.5" /> GCC&apos;s Trusted Industrial Marketplace
            </div>
            <h1 className="text-5xl lg:text-6xl font-black mb-3 leading-tight tracking-tight">
              THE NEW<br /><span className="text-green-400">STANDARD</span>
            </h1>
            <p className="text-slate-300 text-lg mb-1">
              Starting at <span className="text-green-400 font-bold text-2xl">AED 749</span>
            </p>
            <p className="text-slate-400 text-sm mb-8 max-w-lg">
              Industrial supplies, safety equipment, CNC parts, bearings and more — from verified GCC suppliers.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shadow-lg shadow-green-900/30"
              >
                Start Buying →
              </Link>
              <Link
                href="/b2b/rfq/new"
                className="border border-white/20 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm backdrop-blur-sm"
              >
                Request a Quote
              </Link>
            </div>
            {/* Stats */}
            <div className="flex gap-6 mt-8 pt-6 border-t border-white/10">
              {[
                { v: "2,400+", l: "Verified Suppliers" },
                { v: "48,000+", l: "Products" },
                { v: "287", l: "B2B Companies" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-xl font-bold text-white">{s.v}</p>
                  <p className="text-xs text-slate-400">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-3xl border border-white/10 shadow-2xl bg-slate-800 w-[560px] h-[400px] flex flex-col items-center justify-center overflow-hidden">
                <div className="grid grid-cols-3 gap-3 p-6 opacity-60">
                  {["⚙️","🔩","🔧","🏭","⛏️","🔨","🪛","🔬","🏗️"].map((e,i) => (
                    <div key={i} className="text-4xl text-center">{e}</div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-lg font-bold">Industrial Marketplace</p>
                  <p className="text-green-400 text-sm">48,000+ Products · 2,400+ Suppliers</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Chips Row */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-3 overflow-x-auto py-4 -mx-1 px-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  className="flex items-center gap-2.5 bg-white border border-gray-200 hover:border-green-500 hover:bg-green-50 rounded-xl px-3 py-2.5 shrink-0 transition-all group"
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${cat.color} shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-green-700 whitespace-nowrap">{cat.nameEn}</p>
                    <p className="text-[10px] text-slate-400">{cat.nameAr}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Partner Logos Strip */}
      <section className="py-6 bg-slate-50 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-xs font-semibold text-center text-slate-400 uppercase tracking-widest mb-5">
            Our Trusted Partners
          </p>
          <div className="flex items-center justify-center flex-wrap gap-8">
            {["SKF", "EATON", "NSK", "TIMKEN", "ABB", "BOSCH", "SIEMENS", "GATES"].map((b) => (
              <div
                key={b}
                className="text-slate-400 font-black text-sm tracking-wide grayscale hover:grayscale-0 hover:text-green-600 transition-all cursor-pointer"
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      <main>
        {/* Best Sellers Section */}
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Best Sellers</h2>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                  {["All", "Bearings", "Motors", "Gears"].map((t, i) => (
                    <span
                      key={t}
                      className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        i === 0 ? "bg-green-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <Link href="/products" className="text-sm text-green-600 hover:underline font-medium ml-2">
                  More →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {mappedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  {...p}
                  badge="HOT"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Fast Customization Banner */}
        <section className="py-4">
          <div className="max-w-7xl mx-auto px-4">
            <div className="bg-green-600 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-500 opacity-50" />
              <div className="relative">
                <h3 className="text-xl font-bold mb-1">Fast Customization</h3>
                <p className="text-green-100 text-sm">
                  Custom specifications · Fast lead times · Competitive pricing from verified suppliers
                </p>
              </div>
              <Link
                href="/b2b/rfq/new"
                className="relative bg-white text-green-700 hover:bg-green-50 font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap shrink-0"
              >
                Get Quote →
              </Link>
            </div>
          </div>
        </section>

        {/* Featured Products Section */}
        <section className="py-10 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Featured Products</h2>
                <p className="text-slate-500 text-sm mt-0.5">Hand-picked by our team</p>
              </div>
              <Link href="/products" className="text-sm text-green-600 hover:underline font-medium">
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {mappedProducts.slice(0, 4).map((p) => (
                <ProductCard key={p.id} {...p} badge="NEW" />
              ))}
            </div>
          </div>
        </section>

        {/* New Arrivals Section */}
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                New Arrivals{" "}
                <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Just In
                </span>
              </h2>
              <Link href="/products?sort=newest" className="text-sm text-green-600 hover:underline font-medium">
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {mappedProducts.slice(0, 5).map((p) => (
                <ProductCard key={p.id} {...p} badge="NEW" />
              ))}
            </div>
          </div>
        </section>

        {/* Buyer Protection Section */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-green-600 mb-3 block">
                Why Buy on Avenick
              </span>
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Complete Buyer Protection</h2>
              <p className="text-slate-500 mb-6 max-w-md">
                Every transaction on Avenick Commerce is backed by our comprehensive buyer protection program.
              </p>
              <ul className="space-y-3">
                {[
                  "Secure Payment Processing",
                  "Multiple Payment Options (mada, VISA, Wire)",
                  "Easy Returns & Refund Policy",
                  "Quality Protection Guarantee",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-800">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/b2b"
                className="inline-flex items-center gap-2 mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                Learn More About Protection →
              </Link>
            </div>
            <div className="relative">
              <div className="rounded-2xl shadow-lg bg-slate-100 w-full h-80 flex items-center justify-center overflow-hidden relative">
                <div className="grid grid-cols-3 gap-4 p-8 opacity-40">
                  {["🛡️","✅","🔒","📦","💳","↩️","⭐","🏆","📋"].map((e,i) => (
                    <div key={i} className="text-3xl text-center">{e}</div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-green-50/80 to-slate-100/50" />
                <div className="absolute text-center">
                  <p className="text-slate-500 font-semibold">Buyer Protection Active</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl p-4 shadow-xl border border-gray-100">
                <p className="text-3xl font-black text-green-600">99.8%</p>
                <p className="text-xs text-slate-500 font-medium">Customer Satisfaction</p>
              </div>
            </div>
          </div>
        </section>

        {/* Custom Machined Parts Banner */}
        <section className="py-6 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-center text-white">
              <h2 className="text-2xl font-bold mb-2">Custom Machined Parts</h2>
              <p className="text-slate-400 mb-6 max-w-lg mx-auto">
                Submit your specifications. Get competitive quotes from verified precision manufacturers in the GCC.
              </p>
              <Link
                href="/b2b/rfq/new"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors"
              >
                Get Quote
              </Link>
            </div>
          </div>
        </section>

        {/* Top Rated Section */}
        <section className="py-10 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Top Rated</h2>
              <Link href="/products?sort=rating" className="text-sm text-green-600 hover:underline font-medium">
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {mappedProducts.slice(0, 5).map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>
          </div>
        </section>

        {/* RFQ CTA Banner */}
        <section className="py-4 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="bg-green-600 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-white overflow-hidden relative">
              <div className="absolute right-0 bottom-0 opacity-10">
                <Cog className="h-48 w-48" />
              </div>
              <div className="relative">
                <h2 className="text-2xl font-bold mb-1">Request for Quotation</h2>
                <p className="text-green-100">Get quotes from 3+ verified suppliers · Competitive pricing</p>
              </div>
              <Link
                href="/b2b/rfq/new"
                className="relative bg-white text-green-700 hover:bg-green-50 font-bold px-8 py-3 rounded-xl text-sm transition-colors shrink-0 shadow-lg"
              >
                Submit RFQ →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MainLayout>
  );
}
