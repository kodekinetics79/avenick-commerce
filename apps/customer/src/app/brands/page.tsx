import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Button, Eyebrow, EmptyState, FieldWell, Num, PageHeader, Surface } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { platformName } from "@avenick/utils/portal-config";
import { SELLER_REGISTER_URL } from "@/lib/portal-urls";
import { readPublicBrands } from "@/lib/public-brands";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalFor } from "@/lib/page-metadata";

// The tab read the English literal "Brands" for every visitor, above an h1 that
// says "Shop by brand". The tab now comes from brandsContent.title, whose English
// value is that heading's words, so the two agree in English. The heading below
// is still the English literal, so an Arabic session reads an Arabic tab above
// an English h1 until the page body reads the same key.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("brandsContent");
  return { title: t("title"), description: t("metaDescription"), ...canonicalFor("/brands") };
}
// Live catalog data — must not prerender at build time (no DB on build machines).
export const dynamic = "force-dynamic";

/*
 * EVERY WORD ON THIS PAGE COMES FROM THE MESSAGE TREE. It was the one catalogue
 * surface still written in JSX literals — the header, the empty state, the
 * seller band, a country table, and the tile's noun chosen by
 * `count === 1 ? "listing" : "listings"`, which is English grammar hardcoded
 * into a page the Arabic build also renders. Arabic has six plural forms and
 * the noun has to agree with the figure beside it, so the choice belongs to the
 * message, which is given the count.
 *
 * Where the words already existed they are reused rather than restated: the
 * empty state's way out is the catalogue's own "Browse all products", the
 * seller action is the footer's "Become a seller", and a brand's country is
 * named exactly as checkout names it.
 */
export default async function BrandsPage() {
  const [brands, t, tc, tf, tco] = await Promise.all([
    readPublicBrands() as Promise<any[]>,
    getTranslations("brandsContent"),
    getTranslations("catalogue"),
    getTranslations("footer"),
    getTranslations("checkout"),
  ]);

  // Literal keys, one per country, so the message-key regression test can see
  // every one of them. A `countries.${code}` template renders the same words
  // and is invisible to that guard.
  const countryLabel = (code: string): string => {
    switch (code) {
      case "AE":
        return tco("countries.AE");
      case "SA":
        return tco("countries.SA");
      case "QA":
        return tco("countries.QA");
      case "KW":
        return tco("countries.KW");
      case "OM":
        return tco("countries.OM");
      case "BH":
        return tco("countries.BH");
      default:
        return code;
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-shell px-gutter py-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          // LAW E. The figure on each tile is a count of catalogue listings, not
          // a count of everything the brand makes — worth stating once here
          // rather than qualifying twenty tiles.
          //
          // The line used to hedge that the count was WIDER than the catalogue:
          // "active products recorded against each brand · the catalogue shows
          // only those a seller has published for public discovery". That was
          // true of the old /api/brands count and stopped being true when
          // readPublicBrands began counting discoverable products only, so the
          // hedge described a mismatch that no longer existed. It now says what
          // is counted: ACTIVE, undeleted, publicly discoverable listings.
          //
          // It deliberately does not say "the listings that open in the
          // catalogue". The catalogue additionally requires a live seller and
          // this count does not yet, so that sentence would be true only while
          // no seller with a listing has been rejected.
          dateline={t("dateline")}
          linkComponent={Link}
        />

        {brands.length === 0 ? (
          <EmptyState
            eyebrow={t("empty.eyebrow")}
            headline={t("empty.headline")}
            body={t("empty.body")}
            icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products">{tc("empty.browseAll")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {brands.map((brand) => (
              <Surface key={brand.id} rung={2} interactive>
                <Link
                  // /products reads this through listProducts' brandSlug filter.
                  href={`/products?brand=${encodeURIComponent(brand.slug)}`}
                  className="u-focus flex items-start gap-3 rounded-[inherit] p-4"
                >
                  {/* The brand's own mark when it has one, and a neutral initial
                      when it does not — never the indigo→violet gradient disc
                      with a 900-weight glyph and a glow that used to sit here.
                      That was three banned things at once and it scaled 10% on
                      hover, repainting every tile in the grid.

                      A plain <img>, not next/image: these are same-origin SVGs a
                      few hundred bytes each, so the optimiser would add a round
                      trip and a transform to save nothing. Dimensions are set to
                      reserve the box and keep the row from shifting as it loads. */}
                  {brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt=""
                      aria-hidden="true"
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 shrink-0 rounded-nested bg-surface-1 object-contain p-1.5"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="u-h3 grid h-11 w-11 shrink-0 place-items-center rounded-nested bg-surface-1 text-ink-2"
                    >
                      {brand.nameEn.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="u-ui block truncate font-medium text-ink-1">{brand.nameEn}</span>
                    {/* flex-wrap, so the noun drops under the figure when a
                        2-up phone tile cannot hold both. A single nowrap row
                        clipped "176 LISTINGS" at the tile's edge on a 390px
                        screen, and the Arabic noun is no shorter. */}
                    <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                      <Num value={brand._count.products} rank="inline" />
                      <Eyebrow as="span">{t("listingsNoun", { count: brand._count.products })}</Eyebrow>
                    </span>
                    {brand.country && (
                      <span className="u-meta block text-ink-3">{countryLabel(brand.country)}</span>
                    )}
                  </span>
                </Link>
              </Surface>
            ))}
          </div>
        )}

        {/*
          Seller CTA. Seller sign-up lives in the seller portal; this app's
          /register is buyer registration, which is where this button used to
          send suppliers. Without a configured seller-portal origin there is no
          correct target, so the whole card is omitted rather than linked to a
          guess. The old copy also promised "thousands of B2B buyers" — a
          number nothing measures — so it now says only what the button does.

          Recessed, because law A says recessed is context: the band is the
          context and the raised button on it is the action.
        */}
        {SELLER_REGISTER_URL && (
          <FieldWell className="mt-section flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
              <div>
                <p className="u-ui font-medium text-ink-1">{t("sellerCta.headline")}</p>
                <p className="u-meta mt-1 max-w-prose text-ink-2">
                  {t("sellerCta.body", { platform: platformName() })}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="md" className="shrink-0" asChild>
              <a href={SELLER_REGISTER_URL}>{tf("becomeSeller")}</a>
            </Button>
          </FieldWell>
        )}
      </div>
    </MainLayout>
  );
}
