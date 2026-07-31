import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { fetchBackendJson } from "@/lib/backend";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("brandsContent");
  return { title: t("title"), description: t("description") };
}
// Live catalog data — must not prerender at build time (no DB on build machines).
export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const [t, locale] = await Promise.all([getTranslations("brandsContent"), getLocale()]);
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const brands = await fetchBackendJson<any[]>("/api/brands");

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        {brands.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("emptyDescription")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {brands.map((brand) => {
              const displayName = locale === "ar" && brand.nameAr ? brand.nameAr : brand.nameEn;
              return (
              <Link
                key={brand.id}
                href={`/products?brand=${brand.slug}`}
                className="group flex flex-col items-center gap-3 p-5 bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-elevated hover:-translate-y-0.5 transition-all text-center"
              >
                <div className="h-14 w-14 rounded-2xl flex items-center justify-center font-black text-lg text-white bg-gradient-to-br from-primary-500 to-accent-600 group-hover:scale-110 transition-transform shadow-glow-sm">
                  {displayName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{t("productCount", { count: brand._count.products })}</p>
                  {brand.country && <p className="text-xs text-muted-foreground">{regionNames.of(brand.country) ?? brand.country}</p>}
                </div>
                <span className="text-xs text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t("browse")} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </span>
              </Link>
              );
            })}
          </div>
        )}

      </div>
    </MainLayout>
  );
}
