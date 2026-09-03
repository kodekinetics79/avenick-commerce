import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, BadgeCheck, Sparkles, PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { categoryIcon } from "@/components/products/category-icon";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel, getPublicCategories } from "@/lib/catalog-categories";
import { partitionHomeProducts } from "@/lib/home-catalog";

export const dynamic = "force-dynamic";

async function getFeaturedProducts() {
  try {
    const result = await fetchBackendJson<{ products?: any[] }>("/api/products?limit=10&b2c=true");
    return Array.isArray(result.products) ? result.products : [];
  } catch (error) {
    console.error("Unable to load featured products", error);
    return [];
  }
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("AVENICK_LOCALE")?.value ?? "en") as "en" | "ar";
  const t = await getTranslations("home");
  // The category strip comes from the catalog, not from a list typed into this
  // page: a typed list kept advertising categories with nothing to sell.
  const [products, categories] = await Promise.all([getFeaturedProducts(), getPublicCategories()]);

  const mapped = products.map((p) => {
    const stock = p.inventory?.[0];
    const available = stock?.inStock ? 1 : 0;
    return {
      id: p.id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      imageUrl: p.images?.[0]?.url,
      price: p.cardPrice?.amount,
      currency: p.cardPrice?.currency,
      vatRate: p.cardPrice?.vatRate,
      priceIsFrom: p.cardPrice?.isFrom === true,
      sku: p.sku,
      sellerId: p.sellerId,
      sellerName: p.seller?.businessNameEn,
      inStock: available > 0,
      availabilityStatus: stock?.status,
      hasVariants: p.hasVariants === true,
      priceTiered: p.priceTiered === true,
      moq: p.moq,
      // Locale-aware, and no fallback label: a product whose category is
      // unknown is shown without one rather than filed under a category it may
      // not belong to.
      category: (locale === "ar" ? p.category?.nameAr || p.category?.nameEn : p.category?.nameEn) ?? undefined,
    };
  });
  // Two headings over one ten-item feed used to render the same five products
  // twice. The catalog API exposes no sales ranking, so the sections are simply
  // made disjoint rather than labelled with a ranking nobody computes.
  const productSections = partitionHomeProducts(mapped);

  return (
    <MainLayout>
      {/* ─── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        {/* backdrop */}
        <div className="absolute inset-0 bg-grid mask-fade-b opacity-60" />
        <div className="absolute -top-24 start-1/4 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-10 end-1/4 h-80 w-80 rounded-full bg-accent/20 blur-[120px]" />

        <div className="relative max-w-7xl mx-auto px-4 py-20 lg:py-28">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("heroTagline")}
            </span>
            <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95]">
              {t("heroTitle1")}
              <br />
              <span className="text-gradient">{t("heroTitle2")}</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              {t("heroDesc")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 hover:shadow-glow transition-all active:scale-[0.98]"
              >
                {t("startBuying")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/b2b/rfq/new"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl border border-border bg-card/60 backdrop-blur font-semibold hover:bg-secondary transition-colors"
              >
                {t("requestQuote")}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ─── Category strip ───────────────────────────────── */}
      {/* Categories come from the catalog API (active, with discoverable
          products), never a list typed into this page. An empty catalog gets a
          plain link to all products rather than a decorative strip. */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {categories.length === 0 ? (
            <Link href="/products" className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold">
              <PackageSearch className="h-4 w-4 text-primary" /> Browse all products
            </Link>
          ) : (
            categories.map((category) => {
              const Icon = categoryIcon(category.iconName);
              return (
                <Link
                  key={category.slug}
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="group shrink-0 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 hover:border-primary/40 hover:shadow-card transition-all"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold whitespace-nowrap">{categoryLabel(category, locale)}</span>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* ─── Best sellers ─────────────────────────────────── */}
      <Section title={t("bestSellers")} subtitle={t("bestSellersSub")} href="/products">
        {/* No badge: "HOT" asserts demand ranking the catalog does not compute. */}
        <Grid>{productSections.catalog.map((p) => <ProductCard key={p.id} {...p} locale={locale} />)}</Grid>
      </Section>

      {/* ─── Value props ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: BadgeCheck, titleKey: "prop1Title", descKey: "prop1Desc" },
            { icon: ShieldCheck, titleKey: "prop2Title", descKey: "prop2Desc" },
            { icon: Truck, titleKey: "prop3Title", descKey: "prop3Desc" },
            { icon: Sparkles, titleKey: "prop4Title", descKey: "prop4Desc" },
          ].map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-card transition-all">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-semibold">{t(titleKey)}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Featured ─────────────────────────────────────── */}
      {/* No badge: "NEW" was stamped on every product regardless of age. The
          section is dropped entirely when the feed holds nothing the catalog
          strip above did not already show. */}
      {productSections.more.length > 0 && (
        <Section title={t("featuredProducts")} subtitle={t("featuredProductsSub")} href="/products">
          <Grid>{productSections.more.map((p) => <ProductCard key={p.id} {...p} locale={locale} />)}</Grid>
        </Section>
      )}

      {/* ─── B2B CTA band ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 pb-16 pt-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-600 to-accent-700 p-10 lg:p-14 text-white">
          <div className="absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative max-w-xl">
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight">{t("b2bTitle")}</h2>
            <p className="mt-3 text-white/80">{t("b2bDesc")}</p>
            <Link
              href="/b2b/rfq/new"
              className="mt-7 inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white text-primary-700 font-semibold hover:bg-white/90 transition-colors active:scale-[0.98]"
            >
              {t("b2bCta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}

/* ── local layout helpers ─────────────────────────────── */
function Section({ title, subtitle, href, children }: { title: string; subtitle?: string; href: string; children: React.ReactNode }) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{children}</div>;
}
