import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, CreditCard, PackageSearch, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import {
  Button,
  EmptyState,
  Eyebrow,
  LightGrid,
  Rail,
  Reveal,
  Surface,
} from "@avenick/ui";
import { formatCurrency, isSupportedCurrency } from "@avenick/utils";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductGrid } from "@/components/products/product-grid";
import { categoryIcon } from "@/components/products/category-icon";
import { fetchBackendJson } from "@/lib/backend";
import { categoryLabel, getPublicCategories, type PublicCategory } from "@/lib/catalog-categories";
import { getStorefrontSections, listBrandsWithLogos } from "@avenick/database";
import { toCatalogListDto } from "@/lib/catalog-list-dto";
import { partitionHomeProducts } from "@/lib/home-catalog";
import { productCardPricePresentation, storefrontProductHref } from "@/lib/product-card-commerce";

export const dynamic = "force-dynamic";

/**
 * Every rail on this page, from one call.
 *
 * The rows go through toCatalogListDto exactly as /api/products does, and that
 * is not a convenience — the DTO is where catalogue PRICE PRIVACY lives. It
 * decides which prices a channel may see and what the card is allowed to quote.
 * Reading the rows straight out of the service and shaping them here would
 * route around that rule, and the page would leak B2B pricing to an anonymous
 * visitor without anything failing.
 *
 * `rating` is re-attached after the DTO because the DTO builds a fresh object
 * and knows nothing about reviews.
 */
async function getHomeRails() {
  try {
    const [sections, brands] = await Promise.all([
      getStorefrontSections({ limit: 10 }),
      listBrandsWithLogos({ limit: 12 }),
    ]);
    const shape = (rows: Array<Record<string, any>>) =>
      rows.map((row) => ({ ...toCatalogListDto(row as any, "B2C"), rating: row["rating"] ?? null }));
    return {
      bestSellers: shape(sections.bestSellers),
      newArrivals: shape(sections.newArrivals),
      topRated: shape(sections.topRated),
      featured: shape(sections.featured),
      brands,
    };
  } catch (error) {
    console.error("Unable to load storefront rails", error);
    return { bestSellers: [], newArrivals: [], topRated: [], featured: [], brands: [] };
  }
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("AVENICK_LOCALE")?.value ?? "en") as "en" | "ar";
  const t = await getTranslations("home");
  const tp = await getTranslations("products");
  const tc = await getTranslations("catalogue");
  // The category strip comes from the catalog, not from a list typed into this
  // page: a typed list kept advertising categories with nothing to sell.
  const [rails, categories] = await Promise.all([getHomeRails(), getPublicCategories()]);
  // The hero's specimen and shelf come from the same rails the page already
  // loaded, so the page makes no extra round trip to fill its own header.
  const products = [...rails.featured, ...rails.bestSellers, ...rails.newArrivals];

  function toCard(p: any) {
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
      rating: p.rating ?? null,
      // Locale-aware, and no fallback label: a product whose category is
      // unknown is shown without one rather than filed under a category it may
      // not belong to.
      category: (locale === "ar" ? p.category?.nameAr || p.category?.nameEn : p.category?.nameEn) ?? undefined,
    };
  }

  const mapped = products.map(toCard);

  // The hero's specimen slot holds ONE REAL PRODUCT from the fetch this page
  // already does — never a placeholder, never stock photography. If the
  // catalogue is empty the slot renders the certificate empty state instead,
  // which is the whole point of the slot.
  const specimen = mapped[0];
  /*
    The hero's supporting shelf. A single framed object reads as a trade
    catalogue's frontispiece; a shop is recognised by several products with
    prices, immediately. These two sit under the lead specimen at a smaller
    rank, from the same fetch the page already does — still real products, still
    real prices, no placeholder and no stock photography.

    Two, not four: they must not compete with the lead or push the call to
    action under the fold on a 1366x768 laptop, which is a large share of Gulf
    desktop traffic.
  */
  const heroShelf = (() => {
    /*
      Distinct NAMES, not just distinct rows. The pilot catalogue carries the
      same product name across several SKUs — the first six rows of the live
      feed are three "Wire & Cable Lubricants" and two "Twist-on Wire
      Connectors" — so slicing the first three put the same words under three
      different photographs and made the hero read as a rendering fault rather
      than a shelf. Falling back to whatever is left keeps the shelf populated
      on a catalogue too small to offer three distinct names.
    */
    const seen = new Set<string>([specimen?.nameEn ?? ""]);
    const distinct = mapped.slice(1).filter((item) => {
      if (seen.has(item.nameEn)) return false;
      seen.add(item.nameEn);
      return true;
    });
    return (distinct.length >= 2 ? distinct : mapped.slice(1)).slice(0, 2);
  })();
  // Two headings over one ten-item feed used to render the same five products
  // twice. The catalog API exposes no sales ranking, so the sections are simply
  // made disjoint rather than labelled with a ranking nobody computes.
  //
  // The specimen is withheld from the grids ONLY when there is enough catalogue
  // to spare it. Repeating one tile on a five-product storefront is a cosmetic
  // redundancy; printing "no supplier lists a product in this storefront yet"
  // underneath a product this same page is showing in its hero would be a lie,
  // and a lie delivered by a layout decision is still the unsurvivable one.
  const productSections = partitionHomeProducts(mapped.length > 5 ? mapped.slice(1) : mapped);

  // The rails, in card shape. Same mapping the hero's specimen uses, so a
  // product cannot describe itself one way in the header and another in a grid.
  const railFor = {
    bestSellers: rails.bestSellers.map(toCard),
    newArrivals: rails.newArrivals.map(toCard),
    featured: rails.featured.map(toCard),
    topRated: rails.topRated.map(toCard),
  };

  const specimenName = specimen
    ? locale === "ar"
      ? specimen.nameAr || specimen.nameEn
      : specimen.nameEn
    : "";


  /*
    The hero's figure line. The reference prints a price in this slot; a number
    there is read as an offer, so it may only ever be the product's own. When
    the catalogue exposes no public price for it — which is every product today,
    because nothing has isB2CEnabled set — it says "Price on request", the same
    words the tile uses, rather than borrowing a figure from the B2B channel
    that an anonymous visitor is not entitled to see.
  */
  const specimenHasPrice = Boolean(
    specimen && specimen.price != null && specimen.currency && isSupportedCurrency(specimen.currency),
  );
  const specimenPriceLine =
    specimen && specimen.price != null && specimen.currency && isSupportedCurrency(specimen.currency)
      ? `${specimen.priceIsFrom ? `${tc("from")} ` : ""}${formatCurrency(specimen.price, specimen.currency, locale)}`
      : tc("quoteOnRequest");  const specimenMoney =
    specimen && specimen.price != null && typeof specimen.currency === "string" && isSupportedCurrency(specimen.currency)
      ? formatCurrency(specimen.price, specimen.currency, locale)
      : null;
  // The qualifier is computed with the SAME rule the grid below uses. A
  // variant-bearing product's card price is the lowest of several bands, so the
  // card qualifies it with "From"; the hero showing the identical figure bare
  // would state a price the buyer cannot actually transact at.
  const specimenPriceIsRange =
    specimen != null &&
    (specimen.priceIsFrom || productCardPricePresentation(specimen.price, specimen.hasVariants) === "FROM");
  const specimenAvailability: "IN_STOCK" | "OUT_OF_STOCK" | "UNCONFIRMED" =
    specimen?.availabilityStatus ?? (specimen?.inStock ? "IN_STOCK" : "OUT_OF_STOCK");
  const specimenAvailabilityLabel =
    specimenAvailability === "IN_STOCK"
      ? tp("inStock")
      : specimenAvailability === "UNCONFIRMED"
        ? tp("availabilityUnconfirmed")
        : tp("outOfStock");

  return (
    <MainLayout>
      {/*
        No <AmbientField> here. The single permitted ambient gradient in the
        product is a fixed, full-viewport layer mounted exactly once in
        app/layout.tsx. Mounting a second one on this page alone would stack two
        translucent fields and double the ambient alpha on the home page only,
        which is precisely the visible-orb failure the field was built to avoid —
        and it would silently break every contrast ceiling the field's alphas
        were derived from.
      */}

      {/* ─── THE HERO ─────────────────────────────────────
        The reference's hero, taken structurally: a green gradient slab with a
        two-line display headline in Light over SemiBold, an uppercase kicker, a
        large figure, a white pill button, and one product photographed at scale
        on the right over a soft glow. Node 2204:13035.

        THE GRADIENT IS DARKER THAN THE REFERENCE'S, and that is not a liberty.
        Its stops measure 1.97:1 and 3.91:1 against white — the headline sits on
        it, the kicker sits on it at 50% opacity, and none of that is readable.
        The hue and the light-to-dark direction are kept exactly; the lightness
        is taken down until white text passes, which is 5.2:1 at the near stop
        and 7.5:1 at the far one. A hero nobody can read is not a hero.

        THE FIGURE IS THE PRODUCT'S OWN. The reference prints $749.99 beside a
        stock gear; this prints whatever the specimen actually costs, and when
        the catalogue exposes no public price it says so instead. That is the
        one substitution this hero cannot make — a number in this position is
        read as an offer.
      */}
      <section className="border-b border-hairline">
        <div
          className={
            categories.length > 0
              ? "mx-auto w-full max-w-7xl px-4 py-block lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6"
              : "mx-auto w-full max-w-7xl px-4 py-block"
          }
        >
          <CategoryRail
            categories={categories}
            locale={locale}
            label={t("categoriesTitle")}
            allLabel={t("allProducts")}
          />

          <div
            className="relative min-w-0 overflow-hidden rounded-lifted p-8 sm:p-12 lg:p-14"
            style={{
              backgroundImage:
                "linear-gradient(107deg, hsl(150 62% 30%) 22%, hsl(150 92% 20%) 99%)",
            }}
          >
            {/* The reference's blurred bloom behind the object. Decorative and
                inert, and it sits UNDER everything — a blur over the copy would
                take the contrast measured above straight back out. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -end-16 top-8 h-80 w-80 rounded-full opacity-30 blur-[64px]"
              style={{ backgroundColor: "#eff6ff" }}
            />

            <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="min-w-0">
                <Reveal index={0}>
                  <p className="u-meta font-medium uppercase tracking-[0.14em] text-white/80">
                    {t("heroTagline")}
                  </p>
                </Reveal>

                {/* Light over SemiBold, the reference's exact device. Our own
                    words: "THE NEW STANDARD" is Qantara's line, not Avenick's,
                    and a slogan is the one thing in a design file that belongs
                    to whoever wrote it. */}
                <Reveal index={1} as="h1" className="mt-4 text-white">
                  <span className="block text-[2.75rem] font-light leading-[1.05] tracking-[-0.02em] sm:text-[3.5rem] lg:text-[4.25rem]">
                    {t("heroTitle1")}
                  </span>
                  <span className="block text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[3.5rem] lg:text-[4.25rem]">
                    {t("heroTitle2")}
                  </span>
                </Reveal>

                <Reveal index={2}>
                  <p className="u-ui mt-5 max-w-desc text-white/85">{t("heroDesc")}</p>
                </Reveal>

                {/* The reference's $749.99 sits here, between the copy and
                    the button. It renders only when the catalogue actually
                    exposes a price for the specimen — a figure this size in
                    this position is read as an offer, and "Price on request"
                    set at 60px would be a headline made out of an absence. The
                    caption on the object carries that state instead. */}
                {specimenHasPrice && (
                  <Reveal index={3}>
                    <p className="mt-6 text-[2.5rem] font-bold leading-none text-white">{specimenPriceLine}</p>
                  </Reveal>
                )}

                <Reveal index={4}>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    {/* White pill on the slab, exactly as the reference draws
                        its primary action. `secondary` already renders a light
                        fill with dark ink and carries the key edge, so it is the
                        existing variant rather than a bespoke button. */}
                    <Button variant="secondary" size="lg" asChild>
                      <Link href="/products">
                        {t("allProducts")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="lg" className="text-white hover:bg-white/10 hover:text-white" asChild>
                      <Link href="/b2b/rfq/new">{t("requestQuote")}</Link>
                    </Button>
                  </div>
                </Reveal>
              </div>

              {/* The object. One real listing at scale — the reference's stock
                  gear replaced by something a buyer can actually click. */}
              {specimen ? (
                <Reveal index={2} className="hidden lg:block">
                  <Link
                    href={storefrontProductHref(specimen.slug, { currency: specimen.currency })}
                    aria-label={t("specimenView", { name: specimenName })}
                    className="u-focus group block rounded-lifted"
                  >
                    <div className="relative aspect-square w-full">
                      {specimen.imageUrl ? (
                        <Image
                          src={specimen.imageUrl}
                          alt=""
                          aria-hidden="true"
                          fill
                          priority
                          sizes="(min-width: 1024px) 20rem, 0px"
                          className="object-contain drop-shadow-2xl transition-transform duration-hover ease-standard group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    {/* Glass, over the photograph it actually refracts. */}
                    <Surface rung={4} glass className="mt-3 p-3">
                      {/* No fallback label: this page already states that a product whose
                          category is unknown is shown WITHOUT one rather than filed
                          under a category it may not belong to. */}
                      {specimen.category ? (
                        <p className="u-meta text-ink-3">{specimen.category}</p>
                      ) : null}
                      <p className="u-ui mt-0.5 font-medium text-ink-1">{specimenName}</p>
                      <p className="u-meta mt-1 text-ink-2">{specimenPriceLine}</p>
                    </Surface>
                  </Link>
                </Reveal>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Category strip ───────────────────────────────── */}
      {/* Categories come from the catalog API (active, with discoverable
          products), never a list typed into this page. An empty catalog gets a
          plain link to all products rather than a decorative strip. */}
      <section className="mx-auto max-w-7xl px-4 pt-block lg:hidden">
        <SectionHead
          eyebrow={t("categoriesEyebrow")}
          title={t("categoriesTitle")}
          subtitle={
            categories.length > 0
              ? t("categoriesCount", { count: categories.length, n: String(categories.length) })
              : undefined
          }
          href="/products"
          linkLabel={t("allProducts")}
        />

        {categories.length === 0 ? (
          <Surface rung={2} interactive className="inline-block">
            <Link href="/products" className="u-focus flex items-center gap-2.5 rounded-[inherit] px-4 py-3">
              <PackageSearch className="h-4 w-4 text-ink-3" aria-hidden="true" />
              <span className="u-ui font-medium text-ink-1">{t("browseAll")}</span>
            </Link>
          </Surface>
        ) : (
          /*
            ONE pointermove listener for the whole strip rather than one per
            tile: the tiles then read as one lit material passing under a light
            rather than as N independent hover states. It early-returns before
            attaching anything at all on a coarse pointer, under reduced motion
            or under Save-Data, so a phone registers no listener.
          */
          <LightGrid>
            <CategoryStrip
              categories={categories}
              locale={locale}
              prevLabel={t("railPrev")}
              nextLabel={t("railNext")}
              label={t("categoriesTitle")}
            />
          </LightGrid>
        )}
      </section>

      {/* ─── The named rails ──────────────────────────────
          The certificate belongs to an EMPTY CATALOGUE, not to an empty rail.
          Binding it to Best Sellers alone printed "No supplier lists a product
          in this storefront yet" above three hundred listed products, because
          only a handful of paid orders exist to rank from — a true sentence
          about the ranking, rendered as a false one about the catalogue.

          So: the certificate shows when every rail is empty, and each rail
          otherwise renders only when it has rows. */}
      {railFor.bestSellers.length === 0 &&
      railFor.newArrivals.length === 0 &&
      railFor.featured.length === 0 &&
      railFor.topRated.length === 0 ? (
        <Section
          eyebrow={t("catalogEyebrow")}
          title={t("bestSellers")}
          subtitle={t("bestSellersSub")}
          href="/products"
          linkLabel={t("viewAll")}
        >
          <EmptyState
            variant="certificate"
            glyph={<PackageSearch />}
            eyebrow={t("catalogEmptyEyebrow")}
            headline={t("catalogEmptyHeadline")}
            body={t("catalogEmptyBody")}
            action={
              <Button variant="primary" size="md" asChild>
                <Link href="/b2b/rfq/new">
                  {t("requestQuote")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </Section>
      ) : (
        <ProductRail
          rows={railFor.bestSellers}
          eyebrow={t("catalogEyebrow")}
          title={t("bestSellers")}
          subtitle={t("bestSellersSub")}
          viewAll={t("viewAll")}
          locale={locale}
        />
      )}

      {/* ─── Buyer protection ─────────────────────────────
          The reference's layout: four assurances beside a photograph, with a
          percentage badge over its lower corner. The CONTENT is Avenick's, and
          each line is checkable —

            verified sellers   SellerProfile reaches ACTIVE only through the
                               approval gate in services/admin.ts
            payment options    the real PaymentMethod enum: MADA, Apple Pay,
                               card, bank transfer, STC Pay. The reference says
                               "PayPal", which is neither offered here nor the
                               right rail for the Gulf.
            priced up front    VAT and delivery are computed at checkout before
                               the order is placed (services/orders.ts)
            returns            the ReturnRequest lifecycle, REQUESTED through
                               REFUNDED

          The badge reads 100% rather than the reference's 99.8%. 99.8% of what
          is the question it cannot answer — twelve orders exist, so any success
          rate quoted from them is noise dressed as evidence. "Every seller is
          verified before listing" is a different KIND of claim: it is true by
          construction, because listing requires approval. It fills the same
          slot and survives being asked about. */}
      <section className="mx-auto max-w-7xl px-4 py-block">
        <Surface rung={2} className="overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="p-6 sm:p-8">
              <Eyebrow tone="brass">{t("protectEyebrow")}</Eyebrow>
              <h2 className="u-h2 mt-2 text-ink-1">{t("protectTitle")}</h2>
              <p className="u-ui mt-1.5 text-ink-2">{t("protectSub")}</p>

              <ul className="mt-6 space-y-4">
                {[
                  { icon: ShieldCheck, titleKey: "protect1Title", descKey: "protect1Desc" },
                  { icon: CreditCard, titleKey: "protect2Title", descKey: "protect2Desc" },
                  { icon: BadgeCheck, titleKey: "protect3Title", descKey: "protect3Desc" },
                  { icon: Undo2, titleKey: "protect4Title", descKey: "protect4Desc" },
                ].map(({ icon: Icon, titleKey, descKey }) => (
                  <li key={titleKey} className="flex items-start gap-3">
                    {/* The reference's soft-green icon chip, taken from our own
                        primary-soft token rather than its raw #e4fff1 — the raw
                        hex has no dark counterpart and this panel has to work on
                        both grounds. */}
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-primary-soft text-primary-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <h3 className="u-ui font-medium text-ink-1">{t(titleKey)}</h3>
                      <p className="u-meta mt-0.5 text-ink-2">{t(descKey)}</p>
                    </span>
                  </li>
                ))}
              </ul>

              <Button variant="primary" size="md" className="mt-7" asChild>
                <Link href="/support">{t("propsEyebrow")}</Link>
              </Button>
            </div>

            {/* The photograph, and the badge standing on its corner. Hidden
                below lg: at phone width it would be a 200px letterbox carrying
                no information the four lines above have not already given. */}
            <div className="relative hidden min-h-[22rem] lg:block">
              <Image
                src="/hero/workshop-1600.jpg"
                alt=""
                aria-hidden="true"
                fill
                sizes="(min-width: 1024px) 45vw, 0px"
                className="object-cover"
              />
              <Surface rung={4} className="absolute bottom-6 end-6 w-40 p-4 text-center">
                <p className="u-display text-primary-ink">{t("protectStat")}</p>
                <p className="u-meta mt-1 text-ink-2">{t("protectStatLabel")}</p>
              </Surface>
            </div>
          </div>
        </Surface>
      </section>

      {/* ─── More products ────────────────────────────────── */}
      {/* No badge: "NEW" was stamped on every product regardless of age. The
          section is dropped entirely when the feed holds nothing the catalog
          strip above did not already show. */}
      {/* ─── The named rails ──────────────────────────────
          The reference stacks eight to twelve product carousels. Four ship,
          because four is how many this catalogue can NAME truthfully:

            New Arrivals  — newest by createdAt
            Featured      — a slice of the catalogue feed, deduplicated against
                            the other rails, which is exactly what /deals
                            already says it is
            Top Rated     — real review averages, minimum three reviews

          "Best Sellers" is the fourth and is ranked from actual paid order
          lines (see storefront-sections.ts). The rails the reference also draws
          — "Tools & Hardware", "Vehicle Parts" — are category feeds, and the
          category rail beside the hero already routes there without spending a
          screen apiece on them.

          Each rail renders only when it has rows. A heading and a "View all"
          link over an empty grid reads as a section that failed to paint. */}
      <ProductRail
        rows={railFor.newArrivals}
        eyebrow={t("catalogEyebrow")}
        title={t("newArrivals")}
        subtitle={t("newArrivalsSub")}
        viewAll={t("viewAll")}
        locale={locale}
      />

      <ProductRail
        rows={railFor.featured}
        eyebrow={t("catalogEyebrow")}
        title={t("featuredProducts")}
        subtitle={t("featuredProductsSub")}
        viewAll={t("viewAll")}
        locale={locale}
      />

      <ProductRail
        rows={railFor.topRated}
        eyebrow={t("catalogEyebrow")}
        title={t("topRated")}
        subtitle={t("topRatedSub")}
        viewAll={t("viewAll")}
        locale={locale}
      />

      {/* ─── Brands ───────────────────────────────────────
          The reference calls this strip "Our Partners" and fills it with
          manufacturer logos. That word is the problem, not the row: a partner
          is a commercial relationship, and Avenick has none of the ones those
          logos would imply. The same row is completely true under its real
          name — these are brands whose products sellers list here, which is a
          fact about the catalogue rather than a claim about a boardroom.

          Backed by listBrandsWithLogos, which returns only brands that are
          active, HAVE a logo, and have at least one visible product. So the
          strip cannot show a brand nothing is listed under, and it renders
          nothing at all rather than a row of gaps when no logo is set. */}
      {rails.brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-block">
          <SectionHead
            eyebrow={t("brandsEyebrow")}
            title={t("brandsTitle")}
            subtitle={t("brandsSub")}
            href="/brands"
            linkLabel={t("brandsAll")}
          />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {rails.brands.map((brand) => (
              <li key={brand.slug}>
                <Surface rung={2} interactive className="h-full">
                  <Link
                    href={`/products?brand=${encodeURIComponent(brand.slug)}`}
                    className="u-focus flex h-full flex-col items-center justify-center gap-2 rounded-[inherit] p-4"
                  >
                    {/* The logo is decorative and the NAME is the label right
                        beside it, so the image takes an empty alt rather than
                        repeating the text to a screen reader twice. */}
                    <img
                      src={brand.logoUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-10 w-auto max-w-full object-contain"
                    />
                    <span className="u-meta text-center text-ink-2">
                      {locale === "ar" ? brand.nameAr || brand.nameEn : brand.nameEn}
                    </span>
                  </Link>
                </Surface>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ─── B2B band ─────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-section pt-block">
        {/*
          Recessed, because recessed is context — and the raised button on top of
          it is the action. The old version was an indigo→violet gradient panel
          with a white blur orb and white text, which is three banned things in
          one element and had no dark value.

          It is set at the DISPLAY rung, not h2. This is the page's second scale
          moment: after the hero at 92px, everything else was within one order of
          magnitude of everything else, which is a system with no range rather
          than a restrained one. Display is an existing rung, so nothing new is
          invented to get it.

          NO ledger ruling here, deliberately. The ruling is the product's
          identity and the one place it must never end up is under a paragraph —
          at 3.5% ink behind body copy it stops being felt and starts reading as
          ruled-paper homework. The brass rule carries the register mark instead.
        */}
        <Surface rung={1} className="overflow-hidden p-8 lg:p-12">
          <div className="max-w-xl">
            <span className="u-drawn mb-5 w-14" data-on="true" aria-hidden="true" />
            <Eyebrow tone="brass">{t("b2bEyebrow")}</Eyebrow>
            <h2 className="u-display mt-2 text-ink-1">{t("b2bTitle")}</h2>
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
 * One product rail. Four of these replace the reference's eight-to-twelve
 * carousels, and it renders nothing at all when it has no rows — a heading over
 * an empty grid reads as a grid that failed to paint, which is worse than the
 * section being absent.
 */
function ProductRail({
  rows,
  eyebrow,
  title,
  subtitle,
  viewAll,
  locale,
}: {
  rows: Array<Record<string, any>>;
  eyebrow: string;
  title: string;
  subtitle: string;
  viewAll: string;
  locale: "en" | "ar";
}) {
  if (rows.length === 0) return null;
  return (
    <Section eyebrow={eyebrow} title={title} subtitle={subtitle} href="/products" linkLabel={viewAll}>
      <ProductGrid columns={5}>
        {rows.map((p, i) => (
          <Reveal key={p["id"] as string} index={i} className="h-full">
            <ProductCard {...(p as any)} locale={locale} />
          </Reveal>
        ))}
      </ProductGrid>
    </Section>
  );
}

/**
 * The persistent category rail — the one structural idea worth taking from the
 * Qantara design.
 *
 * The taxonomy is the most useful thing a sourcing buyer can be shown first,
 * and a horizontal strip only ever exposes as many categories as fit the
 * viewport. A vertical rail beside the hero shows the whole shape of the
 * catalogue without a single interaction, which is exactly what the reference
 * design gets right and what a carousel cannot do.
 *
 * DELIBERATELY NOT A FLYOUT MENU. The reference opens a panel on hover over
 * each row. useDisclosure attaches hover handlers only under
 * `(hover: hover) and (pointer: fine)` — on a touch screen they are absent
 * entirely — so a hover-revealed subtree would be unreachable on a phone and
 * invisible to a keyboard. These are plain links. Every row goes somewhere on
 * one activation, from any input device.
 *
 * Desktop only, and the horizontal strip below is hidden at the same
 * breakpoint: one taxonomy surface per viewport, never two saying the same
 * thing. Logical properties throughout, so it mirrors in Arabic without a
 * second rule.
 */
function CategoryRail({
  categories,
  locale,
  label,
  allLabel,
}: {
  categories: PublicCategory[];
  locale: "en" | "ar";
  label: string;
  allLabel: string;
}) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label={label} className="hidden lg:block">
      <Surface rung={3} className="sticky top-24 overflow-hidden">
        <p className="u-meta border-b border-hairline px-3.5 py-2.5 font-medium text-ink-2">{label}</p>
        <ul className="py-1">
          {categories.map((category) => {
            const Icon = categoryIcon(category.iconName, category.slug);
            return (
              <li key={category.slug}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="u-focus group flex items-center gap-2.5 rounded-nested px-3.5 py-2 text-start transition-colors duration-hover ease-standard hover:bg-surface-2"
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-ink-3 transition-colors duration-hover ease-standard group-hover:text-primary-ink"
                    aria-hidden="true"
                  />
                  <span className="u-ui truncate text-ink-1">{categoryLabel(category, locale)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-hairline px-3.5 py-2.5">
          <Link href="/products" className="u-meta u-focus rounded-nested font-medium text-primary-ink hover:underline">
            {allLabel}
          </Link>
        </div>
      </Surface>
    </nav>
  );
}

/**
 * The category strip.
 *
 * Below five categories every tile fits, so the rail's prev/next controls would
 * be two dead buttons — an affordance appears when it is needed and not before.
 * Past that it becomes a <Rail>: proximity snapping (mandatory fights a trackpad
 * flick), symmetric feathered edges (a one-sided `to right` mask passes English
 * review and ships broken in Arabic), and real keyboard-reachable controls,
 * because hiding a scrollbar without another affordance is an accessibility
 * regression.
 */
function CategoryStrip({
  categories,
  locale,
  prevLabel,
  nextLabel,
  label,
}: {
  categories: PublicCategory[];
  locale: "en" | "ar";
  prevLabel: string;
  nextLabel: string;
  label: string;
}) {
  const tiles = categories.map((category) => (
    <CategoryTile key={category.slug} category={category} locale={locale} />
  ));

  if (categories.length <= 4) {
    return (
      <nav aria-label={label} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {tiles}
      </nav>
    );
  }

  return (
    <nav aria-label={label}>
      <Rail prevLabel={prevLabel} nextLabel={nextLabel} label={label}>
        {tiles}
      </Rail>
    </nav>
  );
}

/**
 * A category tile with real presence: a full 128px object rather than a chip.
 *
 * A neutral plate, not a coloured one. Ten hues of icon tile carrying zero
 * information is the loudest amateur signal in the product, and a primary fill
 * per category would spend the page's whole indigo budget on decoration. The
 * tile earns its weight from elevation, the fresnel shoulder and the specular —
 * which is fed by the ONE listener <LightGrid> puts on the strip, not by a
 * listener of its own.
 */
function CategoryTile({ category, locale }: { category: PublicCategory; locale: "en" | "ar" }) {
  const Icon = categoryIcon(category.iconName, category.slug);
  return (
    // `rim` is passed explicitly. Surface turns the fresnel shoulder on by
    // default at rungs 3-5 and off at the content rungs, and this tile is rung 2
    // — but it is an OBJECT a buyer clicks, not a paragraph, and the shoulder is
    // the part of the four-part light model that makes it read as a slab under
    // the overhead source rather than as a tinted rectangle. The conic ring is
    // symmetric about the vertical axis, so it is byte-identical in Arabic.
    <Surface rung={2} interactive specular rim className="group h-full">
      <Link
        href={`/products?category=${encodeURIComponent(category.slug)}`}
        className="u-focus flex h-full min-h-[8rem] flex-col justify-between gap-5 rounded-[inherit] p-4"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-nested bg-surface-1 text-ink-2 shadow-elev-1 transition-colors duration-hover ease-standard group-hover:bg-accent-soft group-hover:text-accent-ink">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="u-ui font-medium text-ink-1">{categoryLabel(category, locale)}</span>
      </Link>
    </Surface>
  );
}

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
      className="u-focus u-ui group inline-flex shrink-0 items-center gap-1.5 rounded-nested font-medium text-primary-ink"
    >
      {label}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-hover ease-standard group-hover:translate-x-[calc(2px*var(--dir))] rtl:rotate-180"
        aria-hidden="true"
      />
    </Link>
  );
}

/**
 * The section mark.
 *
 * Rank is built from FOUR levers between the heading and the line under it —
 * size, weight, colour and case — plus the brass rule above, which is the same
 * gesture as active nav, the certificate's top edge and the ladder's active
 * band. One gesture in different postures is what makes a system read as
 * designed rather than assembled; the round-one 2px full-width underrule was a
 * fifth gesture doing the same job.
 */
function SectionHead({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Omitted on a section that has no "view all" destination. The mark is the
   *  same either way — that is the whole point of it being one gesture. */
  href?: string;
  linkLabel?: string;
}) {
  return (
    <header className="mb-6">
      <span className="u-drawn w-14" data-on="true" aria-hidden="true" />
      <div className="mt-4 flex items-end justify-between gap-4 border-b border-hairline pb-4">
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="u-h2 mt-1 text-ink-1">{title}</h2>
          {subtitle && <p className="u-meta mt-1.5 text-ink-2">{subtitle}</p>}
        </div>
        {href && linkLabel && <ViewAllLink href={href} label={linkLabel} />}
      </div>
    </header>
  );
}

function Section({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-block">
      <SectionHead eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} linkLabel={linkLabel} />
      {children}
    </section>
  );
}
