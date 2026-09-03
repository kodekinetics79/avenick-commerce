import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, BadgeCheck, Sparkles, PackageSearch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Button, CellGrid, EmptyState, Eyebrow, Reveal, Surface } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
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
  // "View all" is shared with the rest of the storefront, so it lives in common.
  const tc = await getTranslations("common");
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
      {/*
        No <AmbientField> here. The single permitted gradient in the product —
        which replaced the two 384px blur-[120px] orbs that used to sit behind
        this hero — is a fixed, full-viewport layer mounted exactly once in
        app/layout.tsx. Mounting a second one on this page alone would stack two
        translucent fields and double the ambient alpha on the home page only,
        which is precisely the visible-orb failure the field was built to avoid.
      */}

      {/* ─── Hero ─────────────────────────────────────────── */}
      {/* Nothing is claimed here that the catalog cannot support: no counts, no
          logos, no delivery promise. The hero earns its space with light, space
          and rank instead, which is the one currency that costs no truth. */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-section">
          <Reveal className="max-w-3xl">
            <Eyebrow tone="accent" className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t("heroTagline")}
            </Eyebrow>

            {/* Display tops out at 52px / weight 600. The old 72px / weight 800
                with tracking-tighter was the loudest amateur signal on the page,
                and the second line was a .text-gradient — unselectable, and
                invisible under forced-colors. One accent word does the same job. */}
            <h1 className="u-display mt-5 text-ink-1">
              {t("heroTitle1")}
              <br />
              <span className="text-accent-ink">{t("heroTitle2")}</span>
            </h1>

            <p className="u-lead mt-6 max-w-desc text-ink-2">{t("heroDesc")}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* The page's one primary fill. Everything else on this page is
                  raised or flat, which is what keeps this button meaning "commit". */}
              <Button variant="primary" size="lg" asChild>
                <Link href="/products">
                  {t("startBuying")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/b2b/rfq/new">{t("requestQuote")}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Category strip ───────────────────────────────── */}
      {/* Categories come from the catalog API (active, with discoverable
          products), never a list typed into this page. An empty catalog gets a
          plain link to all products rather than a decorative strip. */}
      <section className="mx-auto max-w-7xl px-4 pt-block">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <Eyebrow as="h2">{t("shopByCategory")}</Eyebrow>
          <ViewAllLink href="/products" label={t("allProducts")} />
        </div>
        {/* A <nav>, not a <div>. This strip is the storefront's primary category
            navigation — the brief's "reads as navigation rather than decoration"
            has to be true in the accessibility tree as well as on screen, and
            /deals already wraps its identical chip row in a labelled nav. */}
        <nav aria-label={t("shopByCategory")} className="-mx-4 flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2">
          {categories.length === 0 ? (
            <Surface rung={2} interactive className="shrink-0">
              <Link
                href="/products"
                className="u-focus flex items-center gap-2.5 rounded-[inherit] px-4 py-3"
              >
                <PackageSearch className="h-4 w-4 text-ink-3" aria-hidden="true" />
                <span className="u-ui font-medium text-ink-1">{t("browseAllProducts")}</span>
              </Link>
            </Surface>
          ) : (
            categories.map((category) => {
              const Icon = categoryIcon(category.iconName);
              return (
                <Surface key={category.slug} rung={2} interactive className="group shrink-0">
                  <Link
                    href={`/products?category=${encodeURIComponent(category.slug)}`}
                    className="u-focus flex items-center gap-2.5 rounded-[inherit] px-4 py-3"
                  >
                    {/* A neutral chip, not a coloured one. Ten hues of icon tile
                        carrying zero information is the loudest amateur signal in
                        the product, and a primary fill per category would spend
                        the page's whole indigo budget on decoration. */}
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-surface-1 text-ink-2 transition-colors duration-hover ease-standard group-hover:bg-accent-soft group-hover:text-accent-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="u-ui whitespace-nowrap font-medium text-ink-1">
                      {categoryLabel(category, locale)}
                    </span>
                  </Link>
                </Surface>
              );
            })
          )}
        </nav>
      </section>

      {/* ─── Catalog products ─────────────────────────────── */}
      {/* No badge: "HOT" asserts demand ranking the catalog does not compute. */}
      <Section title={t("bestSellers")} subtitle={t("bestSellersSub")} href="/products" viewAllLabel={tc("viewAll")}>
        {productSections.catalog.length === 0 ? (
          // getFeaturedProducts swallows a failed fetch and returns [], and a
          // brand-new catalogue returns [] legitimately. Either way this section
          // used to render a heading, an underrule and a "View all" link over
          // nothing at all, which reads as a grid that failed to paint. Law E:
          // an empty surface has to say what is empty and why.
          <EmptyState
            eyebrow={t("emptyEyebrow")}
            headline={t("emptyHeadline")}
            body={t("emptyBody")}
            icon={<PackageSearch className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products">{t("browseAllProducts")}</Link>
              </Button>
            }
          />
        ) : (
          <ProductGrid columns={5}>
            {productSections.catalog.map((p, i) => (
              // h-full on the wrapper, not just on the card: Reveal introduces a
              // div between the grid and the card, and without it the card stops
              // stretching to the row height and the row loses its baseline.
              <Reveal key={p.id} index={i} className="h-full">
                <ProductCard {...p} locale={locale} />
              </Reveal>
            ))}
          </ProductGrid>
        )}
      </Section>

      {/* ─── What the platform actually does ──────────────── */}
      {/* One hairline-divided panel, not four independently bordered, shadowed,
          hoverable cards. These are statements of fact, not actions: they are
          flat content inside a single object, and nothing about them lifts. */}
      <section className="mx-auto max-w-7xl px-4 py-block">
        <CellGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {[
            { icon: BadgeCheck, titleKey: "prop1Title", descKey: "prop1Desc" },
            { icon: ShieldCheck, titleKey: "prop2Title", descKey: "prop2Desc" },
            { icon: Truck, titleKey: "prop3Title", descKey: "prop3Desc" },
            { icon: Sparkles, titleKey: "prop4Title", descKey: "prop4Desc" },
          ].map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey}>
              <Icon className="mb-3 h-5 w-5 text-ink-3" aria-hidden="true" />
              <h3 className="u-ui font-medium text-ink-1">{t(titleKey)}</h3>
              <p className="u-meta mt-1.5 text-ink-2">{t(descKey)}</p>
            </div>
          ))}
        </CellGrid>
      </section>

      {/* ─── More products ────────────────────────────────── */}
      {/* No badge: "NEW" was stamped on every product regardless of age. The
          section is dropped entirely when the feed holds nothing the catalog
          strip above did not already show. */}
      {productSections.more.length > 0 && (
        <Section title={t("featuredProducts")} subtitle={t("featuredProductsSub")} href="/products" viewAllLabel={tc("viewAll")}>
          <ProductGrid columns={5}>
            {productSections.more.map((p, i) => (
              <Reveal key={p.id} index={i} className="h-full">
                <ProductCard {...p} locale={locale} />
              </Reveal>
            ))}
          </ProductGrid>
        </Section>
      )}

      {/* ─── B2B band ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-section pt-block">
        {/* Recessed, because law A says recessed is context — and the raised
            button on top of it is the action. The old version was an
            indigo→violet gradient panel with a white blur orb and white text,
            which is three banned things in one element and had no dark value. */}
        <Surface rung={1} className="p-8 lg:p-12">
          <div className="max-w-xl">
            <Eyebrow tone="accent">B2B sourcing</Eyebrow>
            <h2 className="u-h2 mt-2 text-ink-1">{t("b2bTitle")}</h2>
            <p className="u-body mt-3 max-w-desc text-ink-2">{t("b2bDesc")}</p>
            <Button variant="primary" size="lg" className="mt-7" asChild>
              <Link href="/b2b/rfq/new">
                {t("b2bCta")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Surface>
      </section>
    </MainLayout>
  );
}

/* ── local layout helpers ─────────────────────────────── */

/**
 * The "View all" affordance, in one place so it is the same gesture everywhere.
 * The arrow travels 2px on hover — the icon alone, by transform. The old version
 * animated `gap-1 → gap-2` through `transition-all`, i.e. it animated a layout
 * property on every frame of every hover on the page.
 */
function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="u-focus u-ui group inline-flex items-center gap-1.5 rounded-nested font-medium text-primary-ink"
    >
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-hover ease-standard group-hover:translate-x-[calc(2px*var(--dir))] rtl:rotate-180"
        aria-hidden="true"
      />
    </Link>
  );
}

function Section({ title, subtitle, href, viewAllLabel, children }: { title: string; subtitle?: string; href: string; viewAllLabel: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-block">
      <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-border-strong pb-3">
        <div className="min-w-0">
          <h2 className="u-h2 text-ink-1">{title}</h2>
          {subtitle && <p className="u-meta mt-0.5 text-ink-2">{subtitle}</p>}
        </div>
        <ViewAllLink href={href} label={viewAllLabel} />
      </div>
      {children}
    </section>
  );
}
