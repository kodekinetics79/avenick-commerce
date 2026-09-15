import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, ClipboardCheck, PackageSearch, Undo2 } from "lucide-react";
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
import { loadHomeRails } from "@/lib/home-rails";
import { partitionHomeProducts } from "@/lib/home-catalog";
import { productCardPricePresentation } from "@/lib/product-card-commerce";
import { HeroCarousel } from "@/components/hero/hero-carousel";
import { toHeroSlides } from "@/components/hero/hero-slides";
import { categoryRailRows } from "@/components/hero/category-rail-rows";
import type { Metadata } from "next";
import { platformName } from "@avenick/utils/portal-config";
import { canonicalFor } from "@/lib/page-metadata";

/**
 * The home page exported no metadata, so its tab, its search result and every
 * share card read the root default: the bare platform name, with no word saying
 * what the platform is. `absolute` because the root template would otherwise
 * append the name a second time. The description stays the root's, which is
 * written for this page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return {
    title: { absolute: `${platformName()} · ${t("metaTitle")}` },
    ...canonicalFor("/"),
  };
}

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const locale = (cookieStore.get("AVENICK_LOCALE")?.value ?? "en") as "en" | "ar";
  const t = await getTranslations("home");
  const tp = await getTranslations("products");
  const tc = await getTranslations("catalogue");
  // The category strip comes from the catalog, not from a list typed into this
  // page: a typed list kept advertising categories with nothing to sell.
  const [rails, categories] = await Promise.all([
    loadHomeRails({ onError: (source, error) => console.error(`Unable to load storefront ${source}`, error) }),
    getPublicCategories(),
  ]);
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
    trending: rails.trending.map(toCard),
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
    <MainLayout discoveryTrending={railFor.trending}>
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

        THE OBJECT IS A CAROUSEL OF THE PRODUCTS THIS PAGE ALREADY LOADED — up
        to ten, one slide per distinct name, crossfading with a 1.02 → 1 settle
        every six seconds and pausing on hover, on focus, in a hidden tab and
        under reduced motion. The copy column does not turn; only the object and
        its glass caption do, which is Apple's hero taken as a behaviour rather
        than as an asset. NO VIDEO: there is no product video asset, and stock
        footage would be a fabrication — a hero made of things the catalogue
        does not hold. The behaviour matrix is in components/hero.

        WIDTH AND MOTION, NOT STRUCTURE. The shell is max-w-shell (96rem) with a
        fluid gutter where it was max-w-7xl over a fixed 16px; the rail and the
        slab stretch to one height so they read as one composed row; the object
        column grows with the shell (20 → 24 → 26rem) while the prose stays on
        max-w-desc. The object parallaxes on a view() timeline where scroll
        timelines exist and stands still where they do not, and the slab clips
        with overflow-clip rather than hidden because hidden makes a scroll
        container — inside one, a view() timeline never advances. The radius is
        rounded-3xl (--radius-lg): the class this slab carried before resolved
        to nothing, and it shipped square.
      */}
      <section className="border-b border-hairline">
        <div
          className={
            categories.length > 0
              ? "mx-auto w-full max-w-shell px-gutter py-block lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-stretch lg:gap-6"
              : "mx-auto w-full max-w-shell px-gutter py-block"
          }
        >
          <CategoryRail
            categories={categories}
            locale={locale}
            label={t("categoriesTitle")}
            allLabel={t("allProducts")}
          />

          {/* The panel's material is .u-panel-brand now — a utility in
              globals.css derived from --primary, rather than a gradient written
              inline here. See that rule for what came off this element and why:
              an inline gradient with two colour literals, `.u-drift` (24s
              infinite, animating background-position — the property §8 names
              under NEVER, and the product's fourth infinite animation against a
              budget of two), and a 320px blurred `#eff6ff` bloom, which is a
              glow, and §3.10 says there are none.

              `.u-sheen` stays. Its drift is a transform on a low-alpha ::before
              rather than a repaint, and its whole intent is to be noticed only
              as the surface not being flat.

              `data-grain` is new here and is the reason the panel stopped
              reading as a flat fill once the drift came off. It is the register's
              own grain — the same tiled noise the ambient field carries, at
              --field-noise, thinned to 70% above 2dppx — and it is a MATERIAL
              rather than an effect: it gives the green a surface to be, which a
              two-stop gradient on its own does not have. It rides ::after, so it
              composes with .u-sheen's ::before instead of replacing it; that is
              also why [data-rim] is NOT on this element, since its ::before
              would win on source order and delete the specular pass. */}
          <div
            data-grain=""
            className="u-sheen u-panel-brand relative flex min-w-0 flex-col justify-center overflow-clip rounded-3xl p-8 sm:p-12 lg:p-14"
          >

            <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
              {/* A size container, so the headline below can be set against
                  the width it actually has rather than the viewport's. */}
              <div className="min-w-0 [container-type:inline-size]">
                <Reveal index={0}>
                  <p className="u-meta font-medium uppercase tracking-[0.14em] text-white/80">
                    {t("heroTagline")}
                  </p>
                </Reveal>

                {/* Light over SemiBold, the reference's exact device. Our own
                    words: "THE NEW STANDARD" is Qantara's line, not Avenick's,
                    and a slogan is the one thing in a design file that belongs
                    to whoever wrote it.

                    THE DEVICE IS TWO LINES, SO THE SIZE FOLLOWS THE COLUMN.
                    The sizes used to step with the VIEWPORT (44 → 56 → 68px),
                    but this column is squeezed by the category rail on one side
                    and the carousel on the other: at 1366, 1440 and 1920 it is
                    492, 562 and 616px wide, and "Buy with confidence." at 68px
                    is 617px. The headline therefore set in three or four lines
                    at every desktop width. The longer line is ≈9.1em, so 10.5%
                    of the column's width (10.5cqi) fills about 95% of it at any
                    width, clamped between the old phone size and the old desktop
                    size. Phones stay at the 2.75rem floor. A browser without
                    container units keeps that floor everywhere, which is
                    smaller but still two readable lines, never a broken rule.

                    The {" "} between the spans is the word space. Without it
                    the heading's text read "clarity.Buy" to anything that reads
                    textContent — a crawler, a snippet, a copy-paste. */}
                <Reveal index={1} as="h1" className="mt-4 text-white">
                  <span className="block text-[2.75rem] font-light leading-[1.05] tracking-[-0.02em] supports-[width:1cqi]:text-[length:clamp(2.75rem,10.5cqi,4.25rem)]">
                    {t("heroTitle1")}
                  </span>{" "}
                  <span className="block text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.02em] supports-[width:1cqi]:text-[length:clamp(2.75rem,10.5cqi,4.25rem)]">
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
                    set at 60px would be a headline made out of an absence —
                    AND only while the object beside it is a single product.
                    With the carousel turning, a static figure here would be an
                    offer for a product that is off screen half the time; each
                    slide's own glass caption carries its figure instead. */}
                {specimenHasPrice && mapped.length === 1 && (
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
                    <Button variant="secondary" size="lg" className="u-shine" asChild>
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

              {/* The object. Real listings at scale — the reference's stock
                  gear replaced by things a buyer can actually click. Held to
                  lg and up exactly as the single specimen was: on a phone the
                  copy and the call to action are the hero, and a 20rem object
                  above them would push the action under the fold. */}
              {mapped.length > 0 ? (
                <Reveal index={2} className="hidden lg:block">
                  <HeroCarousel slides={toHeroSlides(mapped, { locale })} />
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
      <section className="mx-auto max-w-shell px-gutter pt-block lg:hidden">
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

      {/* ─── Buyer protection ─────────────────────────────
          The reference's layout: assurances beside a photograph. Every row is
          a rule the code enforces on an order, and each one names where —

            re-checked on submit  services/orders.ts prices the lines on the
                                  server and re-reads stock inside the order
                                  transaction, refusing a short line; a purchase
                                  order must still match its own server-priced
                                  total. Delivery terms are NOT settled at that
                                  point — they are confirmed while the order is
                                  processed, which is what the utility bar says
                                  on every page.
            bank transfer         the only method api/orders/route.ts accepts:
                                  it answers 503 for MADA, Apple Pay, card and
                                  STC Pay. A transfer is marked paid only after
                                  finance verifies the funds
                                  (orders.next.AWAIT_BANK_TRANSFER).
            returns               customer-returns.ts accepts a return only
                                  against a DELIVERED order, and the lifecycle
                                  runs REQUESTED through REFUNDED (workflow.ts)

          WHAT CAME OFF, SO IT DOES NOT COME BACK. This panel used to promise
          "Complete buyer protection — your order is protected from payment
          through to delivery", and there is no escrow: Terms §5 says so, which
          is why the button goes there. It listed "MADA, Apple Pay, card, bank
          transfer and STC Pay", which is the PaymentMethod enum — a schema, not
          what the order route takes. It said VAT and delivery were "computed
          and shown before you pay" above a rail of "Price on request" tiles,
          when a purchase order carries no computed delivery charge at all.
          And it ran a "Verified sellers" row under a "100% — Sellers verified
          before listing" badge, defended as true by construction because
          listing needs approval. It was not: approveSeller moves
          PENDING_REVIEW to ACTIVE without looking at a document, and
          pilot-catalog.ts upserts its sellers straight to ACTIVE without
          approval at all — when this was checked, every live listing belonged
          to a seller with no document on file. A verification claim needs a
          code gate on reviewed documents first, and then a sentence rather
          than a percentage.

          It sits after New arrivals rather than directly under the hero: a
          buyer sees products before the rules for ordering them, and the
          panel breaks what was a run of three product rails. */}
      <section className="mx-auto max-w-shell px-gutter py-block">
        <Surface rung={2} className="overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="p-6 sm:p-8">
              <Eyebrow tone="brass">{t("protectEyebrow")}</Eyebrow>
              <h2 className="u-h2 mt-2 text-ink-1">{t("protectTitle")}</h2>
              <p className="u-ui mt-1.5 text-ink-2">{t("protectSub")}</p>

              {/* In the order an order lives them: submitted, paid, returned.
                  The keys are called literally rather than through a mapped
                  key string, so the message-key regression test sees every one
                  of them in both languages. */}
              <ul className="mt-6 space-y-4">
                {[
                  { icon: ClipboardCheck, title: t("protect3Title"), desc: t("protect3Desc") },
                  { icon: Building2, title: t("protect2Title"), desc: t("protect2Desc") },
                  { icon: Undo2, title: t("protect4Title"), desc: t("protect4Desc") },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    {/* The reference's soft-green icon chip, taken from our own
                        primary-soft token rather than its raw #e4fff1 — the raw
                        hex has no dark counterpart and this panel has to work on
                        both grounds. */}
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-primary-soft text-primary-ink">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <h3 className="u-ui font-medium text-ink-1">{title}</h3>
                      <p className="u-meta mt-0.5 text-ink-2">{desc}</p>
                    </span>
                  </li>
                ))}
              </ul>

              {/* To the section of the Terms that states these limits in full.
                  It used to be labelled "How the platform works" and open the
                  help centre, which is neither what the label said nor where
                  the limits are written. */}
              <Button variant="secondary" size="md" className="mt-7" asChild>
                <Link href="/terms#disputes">{t("protectCta")}</Link>
              </Button>
            </div>

            {/* The photograph, and nothing on it. It is decorative (empty alt,
                hidden from assistive technology) and it asserts nothing about
                any seller. Hidden below lg: at phone width it would be a 200px
                letterbox carrying no information the rows beside it have not
                already given. */}
            <div className="relative hidden min-h-[22rem] lg:block">
              <Image
                src="/hero/workshop-1600.jpg"
                alt=""
                aria-hidden="true"
                fill
                sizes="(min-width: 1024px) 45vw, 0px"
                className="object-cover"
              />
            </div>
          </div>
        </Surface>
      </section>

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
        href="/products?sort=rating"
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
        <section className="mx-auto max-w-shell px-gutter py-block">
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
                    className="u-logo u-focus flex h-full flex-col items-center justify-center gap-2.5 rounded-[inherit] px-4 py-5"
                  >
                    {/* The logo is decorative and the NAME is the label right
                        beside it, so the image takes an empty alt rather than
                        repeating the text to a screen reader twice. */}
                    <img
                      src={brand.logoUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      className="h-14 w-full max-w-[9rem] object-contain"
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
      <section className="mx-auto max-w-shell px-gutter pb-section pt-block">
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
            {/* ONE NAME FOR ONE DESTINATION. This button said "Submit an RFQ"
                while the hero, the empty catalogue and the footer said
                "Request a quote" for the same /b2b/rfq/new, so it now uses the
                same key. The header keeps its shorter "Get a quote" as chrome.

                The note says out loud what the click does. The form sits behind
                sign-in (an anonymous visitor is sent to /login), and the RFQ
                API refuses anyone without a company account. The sentence is
                worded to be true for every viewer, so the page does not need to
                read the session to decide whether to show it. */}
            <Button variant="primary" size="lg" className="mt-7" asChild>
              <Link href="/b2b/rfq/new">
                {t("requestQuote")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </Button>
            <p className="u-meta mt-3 max-w-desc text-ink-2">{t("quoteSignInNote")}</p>
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
 *
 * "VIEW ALL" GOES WHERE THE RAIL'S OWN ORDER CONTINUES. All three rails used to
 * link to plain /products. That is right for New arrivals and More from the
 * marketplace — the catalogue's default order is newest first — and wrong for
 * Top rated, whose continuation is /products?sort=rating.
 *
 * ON A PHONE, A ROW; FROM sm UP, THE GRID. Ten tiles in ProductGrid's two
 * phone columns are five rows of about 480px, so three rails were 7,700px of
 * an 11,300px page, and the first product card sat on the third screen. Below
 * sm the SAME tiles are laid out as one horizontal row — 72% of the width each,
 * so the next tile shows at the edge — that scrolls under the thumb with
 * proximity snapping. Nothing is removed: every tile and its control is still
 * there, one swipe away rather than five screens down.
 *
 * WHY NOT <Rail>, AND WHY NOT TWO RENDERINGS. <Rail> is a horizontal scroller at
 * every width and cannot become the grid at sm. Rendering the tiles twice — a
 * Rail for phones, the grid for everything else, one of them display:none —
 * would hydrate thirty extra ProductCard client components on the busiest
 * route. So the wrapper below turns ProductGrid's single root element into
 * `display: contents` under sm, which hands the tiles to this scroller, and
 * does nothing at all from sm up. The scrollbar is NOT hidden: this row has no
 * prev/next controls, so the scrollbar and the edge of the next tile are its
 * only affordances, and hiding a scrollbar with nothing in its place is an
 * accessibility regression. Grid auto-flow and overflow are both
 * direction-aware, so the row starts at the inline start in Arabic unaided.
 *
 * IN THE ROW, A TILE DOES NOT WAIT FOR ITS ENTRANCE. <RevealRoot> hides every
 * [data-reveal] that is not on screen at first sighting and shows it when it
 * intersects the viewport. A tile past the edge of this scroller is clipped,
 * so it counts as off screen, and the tile a buyer had just swiped to arrived
 * as an empty plate that faded in up to half a second later — 320ms of fade
 * behind a stagger delay of up to 200ms. That is motion holding back content
 * someone asked for. So below sm the hidden state is overridden to visible
 * (at a higher specificity than the reveal rule, without !important) and the
 * row simply is there; from sm up the grid keeps its staggered entrance.
 *
 * Do not pass a phone tile limit to ProductGrid from here. A limit that hides
 * tiles past the fourth would hide them inside this row, where they cost no
 * page height at all.
 */
function ProductRail({
  rows,
  eyebrow,
  title,
  subtitle,
  viewAll,
  locale,
  href = "/products",
}: {
  rows: Array<Record<string, any>>;
  eyebrow: string;
  title: string;
  subtitle: string;
  viewAll: string;
  locale: "en" | "ar";
  /** Where "View all" continues this rail. Defaults to the catalogue, newest first. */
  href?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <Section eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} linkLabel={viewAll}>
      <div className="max-sm:grid max-sm:auto-cols-[72%] max-sm:grid-flow-col max-sm:gap-stack max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:snap-x max-sm:snap-proximity max-sm:pb-3 max-sm:[&>div]:contents">
        <ProductGrid columns={5}>
          {rows.map((p, i) => (
            <Reveal
              key={p["id"] as string}
              index={i}
              className="h-full max-sm:snap-start max-sm:[&[data-reveal][data-reveal-state=hidden]]:opacity-100 max-sm:[&[data-reveal][data-reveal-state=hidden]]:[transform:none]"
            >
              <ProductCard {...(p as any)} locale={locale} />
            </Reveal>
          ))}
        </ProductGrid>
      </div>
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
    <nav aria-label={label} className="hidden lg:flex lg:flex-col">
      {/*
        A FLOATING RAIL — raised to rung 4, and NOT glass.
        
        I tried glass here and took it back out after looking at it scrolled.
        The rail lives inside the hero's grid, so its `sticky` has a containing
        block only as tall as the hero: it leaves with the hero rather than
        riding over the product grids. Nothing ever passes behind it, so a
        backdrop-filter had nothing to filter — it was a lighter box costing a
        compositing layer, which is exactly the case this file argues against
        for the product tiles.

        Making it genuinely persist is possible and it is a LAYOUT change, not a
        finish: every section below would have to move into a second column so
        the rail has something tall to stick within. That is the version where
        glass earns itself. It is a decision about the page, not about the panel,
        so it is not made here.

        What it keeps is the float: rung 4 elevation, the fresnel shoulder, and
        rows that press in when you point at them.

        ONE BAND WITH THE HERO. The grid row is `items-stretch`, the nav is a
        flex column and the panel fills it, so the rail is exactly as tall as
        the slab beside it and its "All products" row sits flush with the
        slab's bottom edge — the two read as one composed row rather than a
        short list beside a tall panel. That is also why the panel is no longer
        `sticky`: a panel as tall as its containing block has nowhere to stick.
      */}
      <Surface rung={4} className="flex flex-1 flex-col overflow-hidden">
        <p className="u-meta border-b border-hairline px-3.5 py-2.5 font-medium text-ink-2">{label}</p>
        {/*
          THE SHAPE, ONE LEVEL DEEPER. Seven top-level rows ended 296px into a
          646px panel, so over half of this raised surface was empty. Under each
          root now sit as many of its own children as the band has room for,
          dealt round-robin and budgeted so the rail can never make the hero row
          taller (components/hero/category-rail-rows.ts has the arithmetic).
          The band is shorter from lg to xl, where the carousel column is
          narrower, so the rows that only the xl band has room for are hidden
          below xl rather than stretching the hero there. They are plain links
          like their parents, indented to the parent's label, in meta type and
          second ink so the roots still lead. Same taxonomy, same data, no
          query — getPublicCategories already returns the tree.
        */}
        <ul className="flex-1 py-1">
          {categoryRailRows(categories).map(({ root: category, children, compact }) => {
            const Icon = categoryIcon(category.iconName, category.slug);
            return (
              <li key={category.slug}>
                <Link
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  className="u-focus group flex items-center gap-2.5 rounded-nested px-3.5 py-2 text-start transition-[background-color,padding-inline-start] duration-hover ease-standard hover:bg-surface-2 hover:ps-4 active:bg-surface-1 active:shadow-elev-1"
                >
                  <Icon
                    className="h-4 w-4 shrink-0 text-ink-3 transition-colors duration-hover ease-standard group-hover:text-primary-ink"
                    aria-hidden="true"
                  />
                  <span className="u-ui truncate text-ink-1">{categoryLabel(category, locale)}</span>
                </Link>
                {children.length > 0 && (
                  <ul>
                    {children.map((child, index) => (
                      <li key={child.slug} className={index < compact ? undefined : "hidden xl:block"}>
                        <Link
                          href={`/products?category=${encodeURIComponent(child.slug)}`}
                          className="u-focus u-meta block truncate rounded-nested py-1 pe-3.5 ps-10 text-start text-ink-2 transition-colors duration-hover ease-standard hover:bg-surface-2 hover:text-ink-1"
                        >
                          {categoryLabel(child, locale)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
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
    <section className="mx-auto max-w-shell px-gutter py-block">
      <SectionHead eyebrow={eyebrow} title={title} subtitle={subtitle} href={href} linkLabel={linkLabel} />
      {children}
    </section>
  );
}
