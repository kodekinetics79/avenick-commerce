import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { listShippingZones } from "@avenick/database";
import { getTranslations } from "next-intl/server";
import { Dateline, EmptyState, PageHeader, StatusPill, Surface } from "@avenick/ui";
import { Globe2, Scale } from "lucide-react";
import { ZoneEditor } from "./zone-editor";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce");
  return { title: t("shipping.meta") };
}

// Tariffs are operator-edited; a cached page would show an operator the rates
// they replaced a moment ago.
export const dynamic = "force-dynamic";

export default async function ShippingZonesPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce");
  const zones = await listShippingZones();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("shipping.eyebrow")}
          title={t("shipping.title")}
          description={t("shipping.description")}
        />

        {/*
          The provenance line, not a disclaimer. Delivery is quoted from these
          rows and nothing else, and an operator editing a band is changing what
          a buyer is charged at checkout — saying so here is what makes the
          screen readable as the authority it is.
        */}
        <Dateline>{t("shipping.dateline")}</Dateline>

        {zones.length === 0 ? (
          <EmptyState
            variant="certificate"
            glyph={<Globe2 />}
            eyebrow={t("shipping.empty.eyebrow")}
            headline={t("shipping.empty.headline")}
            body={t("shipping.empty.body")}
          />
        ) : (
          <div className="space-y-block">
            {zones.map((zone) => (
              <Surface key={zone.id} rung={2} className="p-block">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="u-h3 text-ink-1">{zone.nameEn}</h2>
                    <p className="u-meta text-ink-2" dir="rtl">{zone.nameAr}</p>
                  </div>
                  <StatusPill tone={zone.isActive ? "success" : "neutral"}>
                    {zone.isActive ? t("shipping.zone.active") : t("shipping.zone.inactive")}
                  </StatusPill>
                </div>

                <p className="u-meta mb-3 text-ink-2">
                  <Globe2 aria-hidden="true" className="me-1.5 inline h-3.5 w-3.5" />
                  {zone.countries.length > 0
                    ? zone.countries.join(" · ")
                    : t("shipping.zone.noCountries")}
                </p>

                {/*
                  The bands are the tariff. They are shown as a table rather than
                  as cards because an operator reads them the way they read a
                  carrier's published rates — down a column, checking for a gap.
                */}
                {zone.rates.length === 0 ? (
                  <p className="u-meta text-warning-ink">
                    <Scale aria-hidden="true" className="me-1.5 inline h-3.5 w-3.5" />
                    {t("shipping.zone.noBands")}
                  </p>
                ) : (
                  <table className="w-full text-start">
                    <thead>
                      <tr className="border-b border-hairline">
                        {["currency", "from", "to", "price"].map((column) => (
                          <th key={column} className="u-micro py-1.5 text-start text-ink-3">
                            {t(`shipping.band.${column}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {zone.rates.map((rate) => (
                        <tr key={rate.id} className="border-b border-hairline last:border-0">
                          <td className="u-mono u-meta py-1.5">{rate.currency}</td>
                          <td className="u-mono u-meta py-1.5 tabular-nums">{String(rate.minWeightKg)}</td>
                          <td className="u-mono u-meta py-1.5 tabular-nums">
                            {/* The open-ended top band, so no parcel falls through. */}
                            {rate.maxWeightKg == null ? t("shipping.band.andAbove") : String(rate.maxWeightKg)}
                          </td>
                          <td className="u-mono u-meta py-1.5 tabular-nums">{String(rate.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-3 grid gap-1">
                  <p className="u-meta text-ink-2">
                    {t("shipping.zone.fallback", { amount: String(zone.fallbackPrice) })}
                  </p>
                  <p className="u-meta text-ink-2">
                    {zone.freeOverSubtotal == null
                      ? t("shipping.zone.neverFree")
                      : t("shipping.zone.freeOver", { amount: String(zone.freeOverSubtotal) })}
                  </p>
                </div>
              </Surface>
            ))}
          </div>
        )}

        <ZoneEditor />
      </div>
    </AdminLayout>
  );
}
