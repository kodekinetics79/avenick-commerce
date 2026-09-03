import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, PackageSearch, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import {
  AvailabilityDot,
  Button,
  CellGrid,
  DisplayPlate,
  EmptyState,
  Eyebrow,
  HeroCopy,
  HeroSpecimen,
  HeroStage,
  ImageFrame,
  LightGrid,
  PriceStack,
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
import { partitionHomeProducts } from "@/lib/home-catalog";
import { productCardPricePresentation, storefrontProductHref } from "@/lib/product-card-commerce";

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
  const tp = await getTranslations("products");
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

  const specimenName = specimen
    ? locale === "ar"
      ? specimen.nameAr || specimen.nameEn
      : specimen.nameEn
    : "";
  const specimenMoney =
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

      {/* ─── THE REGISTER — the hero ───────────────────────── */}
      {/*
        Nothing is claimed here that the catalogue cannot support: no counts of
        suppliers, no logos, no delivery promise, no rating. The hero earns its
        space with RANGE — a 92px display against 15px body, seven columns of
        voice against four columns holding one real object, on a lit and ruled
        ground with three planes of Z-depth behind it. Depth is Z-POSITION, never
        rotation; there is no tilt anywhere in this composition.

        ONE STAGE PER SITE. This is it. A second instance halves the impact of
        the first and doubles the cost.
      */}
      <section className="border-b border-hairline">
        <HeroStage
          as="div"
          planes={3}
          className="mx-auto w-full max-w-7xl px-4 py-block"
          backPlane={
            /*
              The lit object behind the specimen, bleeding off the stage edge.
              `grain` is OFF deliberately: this plane sits at translateZ(-260)
              with a 1.289 scale correction, which would stretch a 160px noise
              tile to 206px and turn grain into visible speckle — and it keeps
              the page inside the ≤3 grained-elements-per-viewport budget with
              the field and the certificate.
            */
            <DisplayPlate
              grain={false}
              className="absolute bottom-[6%] top-[6%] end-[-12%] w-[54%] max-lg:hidden"
            />
          }
          midPlane={
            /*
              The same brass rule as active nav, the section marks and the
              certificate's top edge — one gesture in another posture, standing
              at mid depth in the gutter between the voice and the object. It is
              vertical, so it is direction-neutral by construction.
            */
            <span
              className="u-drawn absolute bottom-[12%] top-[12%] end-[31%] opacity-40 max-lg:hidden"
              data-orientation="vertical"
              data-on="true"
            />
          }
        >
          <HeroCopy>
            <Reveal index={0}>
              <Eyebrow tone="brass" className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t("heroTagline")}
              </Eyebrow>
            </Reveal>

            {/*
              The hero rung: --fs-hero, weight 680, opsz 32, text-wrap balance.
              Under [dir="rtl"] the same class resolves to Noto Kufi at 76/1.20,
              so the Arabic headline occupies the SAME ~91px vertical band and
              the CTA lands at the same fold in both languages.

              THE HARD <br> IS GONE, and that is the whole reason the type change
              works rather than just being bigger. Two forced blocks of ~19
              characters each wrap to two lines apiece at this size — four lines
              of 88px, which pushes the CTA under the fold on the 1366×768
              laptops that are a large share of Gulf desktop traffic. One block
              lets `text-wrap: balance` set the same words as three even lines
              and never leave a single-word last line, which is the loudest
              amateur tell in a large headline. The accent then reads as an
              emphasised clause inside one sentence rather than as a stacked
              couplet.
            */}
            <Reveal index={1} as="h1" className="u-hero text-ink-1">
              {t("heroTitle1")} <span className="text-accent-ink">{t("heroTitle2")}</span>
            </Reveal>

            <Reveal index={2}>
              <p className="u-lead max-w-desc text-ink-2">{t("heroDesc")}</p>
            </Reveal>

            <Reveal index={3} className="flex flex-wrap items-center gap-3 pt-tight">
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
            </Reveal>

            {/*
              Density of TRUE fact where a template would put white space. This
              is a live count of the categories the catalogue API actually
              returns — active, with discoverable products. It renders at all
              only when there is something to count, and it is set in the
              provenance voice because it is a citation, not a claim.
            */}
            {categories.length > 0 && (
              <Reveal index={4}>
                {/*
                  THE COUNT IS PASSED TWICE ON PURPOSE. `count` selects the
                  plural form; `n` is the digits, pre-stringified, because ICU's
                  `#` formats through Intl for the active locale and the Arabic
                  build would render ١٢ — a second numeral system on a page whose
                  prices are Western. One numeral system, Western, everywhere.
                */}
                <p className="u-provenance">
                  {t("heroProvenance", { count: categories.length, n: String(categories.length) })}
                </p>
              </Reveal>
            )}
          </HeroCopy>

          <HeroSpecimen>
            <Reveal index={2}>
              {specimen ? (
                <div className="grid gap-3">
                <Surface rung={3} className="group overflow-hidden">
                  <Link
                    href={storefrontProductHref(specimen.slug, { currency: specimen.currency })}
                    aria-label={t("specimenView", { name: specimenName })}
                    className="u-focus block rounded-[inherit]"
                  >
                    {/*
                      ONE frame, the same one every product image in all three
                      portals goes through: contained rather than cropped, inset
                      so the product never touches its own frame, on a tinted
                      plate with the cast floor pooled under it. This is the only
                      image the page asks the browser to prioritise.
                    */}
                    <ImageFrame
                      sku={specimen.sku}
                      // The same three-state mapping every product card uses.
                      // Collapsing UNCONFIRMED into "available" makes the frame
                      // contradict the availability dot two lines beneath it.
                      state={
                        specimenAvailability === "OUT_OF_STOCK"
                          ? "out"
                          : specimenAvailability === "UNCONFIRMED"
                            ? "unconfirmed"
                            : "available"
                      }
                    >
                      {specimen.imageUrl ? (
                        <Image
                          src={specimen.imageUrl}
                          alt={specimenName}
                          fill
                          priority
                          fetchPriority="high"
                          sizes="(max-width: 1024px) 100vw, 30vw"
                        />
                      ) : undefined}
                    </ImageFrame>

                    <div className="flex flex-col gap-2 p-4">
                      <Eyebrow>{t("specimenEyebrow")}</Eyebrow>
                      <p className="u-body line-clamp-2 font-medium text-ink-1">{specimenName}</p>
                      {specimenMoney && (
                        <PriceStack
                          amount={specimenMoney}
                          qualifier={specimenPriceIsRange ? tp("priceFrom") : undefined}
                          // The stored unit price is VAT-EXCLUSIVE, which every
                          // product card and the product page state in as many
                          // words. This figure is the largest and most prominent
                          // price on the storefront, and it was the only one
                          // printed bare — a figure a consumer reads as the
                          // amount they will pay when it is not. The rate goes
                          // in as a STRING because a number handed to the
                          // formatter renders in the locale's own numeral
                          // system, and the Arabic build would print ٥ beside a
                          // Western-digit price.
                          vat={
                            specimen.vatRate != null
                              ? tp("vatExcl", { rate: String(specimen.vatRate) })
                              : undefined
                          }
                        />
                      )}
                      <AvailabilityDot state={specimenAvailability} label={specimenAvailabilityLabel} />
                    </div>
                  </Link>
                </Surface>

                {/*
                  The shelf. Two more real products at a smaller rank, so the
                  first thing above the fold says "shop" rather than "brochure".
                  Each is a whole link — image, name and price — because a price
                  a visitor cannot click is a price they have to hunt for.
                */}
                {heroShelf.length > 0 && (
                  <ul className="grid grid-cols-2 gap-3">
                    {heroShelf.map((item) => {
                      const name = locale === "ar" ? item.nameAr : item.nameEn;
                      const money =
                        item.price != null && item.currency && isSupportedCurrency(item.currency)
                          ? formatCurrency(item.price, item.currency, locale)
                          : null;
                      return (
                        <li key={item.id}>
                          <Surface rung={2} interactive className="group h-full overflow-hidden">
                            <Link
                              href={storefrontProductHref(item.slug, { currency: item.currency })}
                              className="u-focus flex h-full flex-col rounded-[inherit]"
                            >
                              <ImageFrame
                                sku={item.sku}
                                ratio="card"
                                state={item.inStock ? "available" : "unconfirmed"}
                              >
                                {item.imageUrl ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt={name}
                                    fill
                                    sizes="(max-width: 1024px) 45vw, 15vw"
                                  />
                                ) : undefined}
                              </ImageFrame>
                              <div className="flex flex-1 flex-col gap-1 p-3">
                                <p className="u-meta line-clamp-2 text-ink-1">{name}</p>
                                {/* VAT-exclusive, stated — the same basis as
                                    every other price on the storefront. */}
                                {money && (
                                  <p className="u-mono u-meta mt-auto font-medium tabular-nums text-ink-1">
                                    {item.priceIsFrom ? `${tp("priceFrom")} ` : ""}{money}
                                  </p>
                                )}
                              </div>
                            </Link>
                          </Surface>
                        </li>
                      );
                    })}
                  </ul>
                )}
                </div>
              ) : (
                /*
                  THE RULE THAT OUTRANKS EVERYTHING ELSE ON THIS PAGE: when a
                  layout has a hole in it, the answer is a better empty state,
                  never a plausible number. The specimen slot holds a certificate
                  — never a placeholder product, never a stock photograph, never
                  a rating — and its one action is the RFQ route, which turns the
                  emptiest surface in the product into its most differentiated
                  one.
                */
                <EmptyState
                  variant="certificate"
                  scale="hero"
                  glyph={<PackageSearch />}
                  eyebrow={t("specimenEmptyEyebrow")}
                  headline={t("specimenEmptyHeadline")}
                  body={t("specimenEmptyBody")}
                  action={
                    <Button variant="secondary" size="md" asChild>
                      <Link href="/b2b/rfq/new">{t("requestQuote")}</Link>
                    </Button>
                  }
                />
              )}
            </Reveal>
          </HeroSpecimen>
        </HeroStage>
      </section>

      {/* ─── Category strip ───────────────────────────────── */}
      {/* Categories come from the catalog API (active, with discoverable
          products), never a list typed into this page. An empty catalog gets a
          plain link to all products rather than a decorative strip. */}
      <section className="mx-auto max-w-7xl px-4 pt-block">
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

      {/* ─── Catalog products ─────────────────────────────── */}
      {/* No badge: "HOT" asserts demand ranking the catalog does not compute. */}
      <Section
        eyebrow={t("catalogEyebrow")}
        title={t("bestSellers")}
        subtitle={t("bestSellersSub")}
        href="/products"
        linkLabel={t("viewAll")}
      >
        {productSections.catalog.length === 0 ? (
          // getFeaturedProducts swallows a failed fetch and returns [], and a
          // brand-new catalogue returns [] legitimately. Either way this section
          // used to render a heading, an underrule and a "View all" link over
          // nothing at all, which reads as a grid that failed to paint. The
          // certificate says exactly what is empty and gives one real thing to
          // do next.
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
        <SectionHead eyebrow={t("propsEyebrow")} title={t("propsTitle")} />
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
        <Section
          eyebrow={t("catalogEyebrow")}
          title={t("featuredProducts")}
          subtitle={t("featuredProductsSub")}
          href="/products"
          linkLabel={t("viewAll")}
        >
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
