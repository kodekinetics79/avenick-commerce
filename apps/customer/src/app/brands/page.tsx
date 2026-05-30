import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { MOCK_BRANDS } from "@manzil/database";

export const metadata = { title: "Brands" };

export default function BrandsPage() {
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Shop by Brand</h1>
          <p className="text-muted-foreground">Browse products from verified GCC suppliers and global brands.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {MOCK_BRANDS.map((brand) => (
            <Link
              key={brand.id}
              href={`/products?brand=${brand.slug}`}
              className="group flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-border hover:border-orange-300 hover:shadow-md transition-all text-center"
            >
              <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-bold text-lg ${brand.color} group-hover:scale-110 transition-transform`}>
                {brand.name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-sm">{brand.name}</p>
                <p className="text-xs text-muted-foreground">{brand.productCount} products</p>
                <p className="text-xs text-muted-foreground">{brand.country}</p>
              </div>
              <span className="text-xs text-orange-600 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Browse <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>

        {/* B2B CTA */}
        <div className="mt-12 bg-orange-50 border border-orange-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-orange-500 shrink-0" />
            <div>
              <p className="font-semibold">Are you a brand or distributor?</p>
              <p className="text-sm text-muted-foreground">Join Avenick Commerce as a verified seller and reach thousands of B2B buyers.</p>
            </div>
          </div>
          <Link href="/b2b/register" className="bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 whitespace-nowrap transition-colors">
            Start Selling →
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
