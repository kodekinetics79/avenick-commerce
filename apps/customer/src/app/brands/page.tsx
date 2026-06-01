import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { db } from "@avenick/database";

export const metadata = { title: "Brands" };

const COUNTRY_LABEL: Record<string, string> = { AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", OM: "Oman", BH: "Bahrain" };

export default async function BrandsPage() {
  const brands = await db.brand.findMany({
    where: { isActive: true },
    include: { _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } } },
    orderBy: { nameEn: "asc" },
  });

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Shop by brand</h1>
          <p className="text-muted-foreground">Browse products from verified GCC suppliers and global brands.</p>
        </div>

        {brands.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No brands yet</p>
            <p className="text-sm text-muted-foreground mt-1">Brands will appear here as sellers list products.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/products?brand=${brand.slug}`}
                className="group flex flex-col items-center gap-3 p-5 bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-elevated hover:-translate-y-0.5 transition-all text-center"
              >
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center font-black text-lg text-white bg-gradient-to-br from-primary-500 to-accent-600 group-hover:scale-110 transition-transform shadow-glow-sm">
                  {brand.nameEn.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{brand.nameEn}</p>
                  <p className="text-xs text-muted-foreground">{brand._count.products} product{brand._count.products !== 1 ? "s" : ""}</p>
                  {brand.country && <p className="text-xs text-muted-foreground">{COUNTRY_LABEL[brand.country] ?? brand.country}</p>}
                </div>
                <span className="text-xs text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  Browse <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Seller CTA */}
        <div className="mt-12 bg-primary/10 border border-primary/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold">Are you a brand or distributor?</p>
              <p className="text-sm text-muted-foreground">Join Avenick Commerce as a verified seller and reach thousands of B2B buyers.</p>
            </div>
          </div>
          <Link href="/register" className="inline-flex items-center gap-1.5 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98] shrink-0 whitespace-nowrap">
            Become a seller <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
