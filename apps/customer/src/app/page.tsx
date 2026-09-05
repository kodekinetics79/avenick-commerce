import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, CreditCard, PackageSearch, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import {
  AvailabilityDot,
  Button,
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
        {/* The rail and the hero share one row on desktop: the taxonomy is
            visible without interaction, which is the whole point of it. Below
            lg the rail is absent and the horizontal strip below takes over.

            The grid is applied ONLY when there is a rail to put in it. With an
            empty catalogue CategoryRail renders nothing, and a two-column grid
            with an absent first child promotes the hero into the 15rem rail
            column — a 92px headline reflowing inside 240px, clipped, with the
            display plate laid across the copy. An empty catalogue is a real
            state (it is what a fresh environment looks like), so the layout has
            to survive it rather than assume the happy path. */}
        <div
          className={
            categories.length > 0
              ? "mx-auto w-full max-w-7xl px-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6"
              : "mx-auto w-full max-w-7xl px-4"
          }
        >
          <CategoryRail
            categories={categories}
            locale={locale}
            label={t("categoriesTitle")}
            allLabel={t("allProducts")}
          />
        <HeroStage
          as="div"
          planes={3}
          className="w-full min-w-0 py-block"
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
            >
              {/*
                The photographic ground, taken from the reference design.

                It sits INSIDE the display plate — beside the headline, never
                under it. The reference puts its photograph full-bleed with no
                text on it at all; laying our headline over the same photograph
                would be a new composition and a new problem, because contrast
                over supplier imagery is not deterministic and no scrim floor
                can be measured for an image that might change. Here the copy
                keeps the ruled ground it was designed for and the plate carries
                the material. Nothing overlaps, so nothing needs a scrim.

                Decorative, so alt="" and aria-hidden: it depicts no specific
                product, seller or facility, and says nothing the headline does
                not already say. Captioning it would be inventing a claim.

                priority, because this is the LCP element on the busiest route.
              */}
              <Image
                src="/hero/workshop-1600.jpg"
                alt=""
                aria-hidden="true"
                fill
                priority
                sizes="(min-width: 1024px) 54vw, 0px"
                className="rounded-[inherit] object-cover"
              />
            </DisplayPlate>
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
              {t("heroTitle1")} <span className="text-primary-ink">{t("heroTitle2")}</span>
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
                {/*
                  GLASS, and this is the one place on the page that earns it.
                  This card sits directly on the workshop photograph, so the
                  backdrop filter has something to refract: the image blurs and
                  saturates behind the panel instead of being covered by it,
                  which is what makes the card read as a pane in front of a
                  scene rather than a rectangle pasted over one. Glass over a
                  flat ground is just a lighter box, which is why it is not used
                  on the product tiles below.

                  Rung 4 because the system permits backdrop-filter at the
                  floating rungs only, and the budget is 2-3 per viewport — this
                  is one, the sticky header is the other.
                */}
                <Surface rung={4} glass className="group overflow-hidden">
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
