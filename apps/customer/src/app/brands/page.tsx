import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button, Eyebrow, EmptyState, FieldWell, Num, PageHeader, Surface } from "@avenick/ui";
import { MainLayout } from "@/components/layout/main-layout";
import { fetchBackendJson } from "@/lib/backend";
import { platformName } from "@avenick/utils/portal-config";
import { SELLER_REGISTER_URL } from "@/lib/portal-urls";

export const metadata = { title: "Brands" };
// Live catalog data — must not prerender at build time (no DB on build machines).
export const dynamic = "force-dynamic";

const COUNTRY_LABEL: Record<string, string> = { AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", OM: "Oman", BH: "Bahrain" };

export default async function BrandsPage() {
  const brands = await fetchBackendJson<any[]>("/api/brands");

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-block">
        <PageHeader
          eyebrow="Discovery"
          title="Shop by brand"
          description="Browse products from GCC suppliers and global brands."
          // LAW E. The figure on each tile is a count of catalogue listings, not
          // a count of everything the brand makes — worth stating once here
          // rather than qualifying twenty tiles.
          //
          // It is also wider than what the catalogue will show. /api/brands
          // counts products with status ACTIVE and deletedAt null; public
          // browsing additionally requires publiclyDiscoverable and an active,
          // non-deleted seller (PUBLIC_CATALOG_SELLER in the catalog service).
          // The count can therefore exceed the number of listings a visitor can
          // reach, so the line says which population it counts.
          dateline="Counts are of active products recorded against each brand · the catalogue shows only those a seller has published for public discovery"
          linkComponent={Link}
        />

        {brands.length === 0 ? (
          <EmptyState
            eyebrow="Nothing recorded"
            headline="No brand has a listing in the catalogue yet."
            body="A brand appears here once a seller publishes a product against it."
            icon={<Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/products">Browse all products</Link>
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
                  {/* A neutral initial, not an indigo→violet gradient disc with a
                      900-weight glyph and a glow. The old one was three banned
                      things at once, and it scaled 10% on hover, which repainted
                      every tile in the grid. */}
                  <span
                    aria-hidden="true"
                    className="u-h3 grid h-11 w-11 shrink-0 place-items-center rounded-nested bg-surface-1 text-ink-2"
                  >
                    {brand.nameEn.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="u-ui block truncate font-medium text-ink-1">{brand.nameEn}</span>
                    <span className="mt-1 flex items-baseline gap-1.5">
                      <Num value={brand._count.products} rank="inline" />
                      <Eyebrow as="span">
                        {brand._count.products === 1 ? "listing" : "listings"}
                      </Eyebrow>
                    </span>
                    {brand.country && (
                      <span className="u-meta block text-ink-3">
                        {COUNTRY_LABEL[brand.country] ?? brand.country}
                      </span>
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
                <p className="u-ui font-medium text-ink-1">Are you a brand or distributor?</p>
                <p className="u-meta mt-1 max-w-prose text-ink-2">
                  Apply to sell on {platformName()}. Applications are reviewed before a storefront goes live.
                </p>
              </div>
            </div>
            <Button variant="secondary" size="md" className="shrink-0" asChild>
              <a href={SELLER_REGISTER_URL}>Become a seller</a>
            </Button>
          </FieldWell>
        )}
      </div>
    </MainLayout>
  );
}
