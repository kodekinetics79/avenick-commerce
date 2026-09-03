import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getWarehouseOverview } from "@avenick/database";
import { Warehouse as WarehouseIcon, Boxes, Truck, Clock, AlertTriangle, ArrowRight, MapPin, Activity } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { platformName } from "@avenick/utils/portal-config";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Eyebrow, Num, Button,
} from "@avenick/ui";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.warehouse");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Facility types the platform models; the labels come from `warehouse.type`. */
const KNOWN_TYPES = new Set(["SELLER", "PLATFORM", "THIRD_PARTY_3PL"]);

export default async function WarehousePage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.warehouse");

  const o = await getWarehouseOverview();

  const kpis = [
    { key: "units", label: t("kpi.units"), value: o.totalUnits.toLocaleString(), sub: t("kpi.unitsNote", { reserved: o.reservedUnits.toLocaleString(), lines: String(o.stockLines) }), icon: Boxes, href: "/warehouse/stock", lead: true, urgent: false },
    { key: "fulfil", label: t("kpi.toFulfil"), value: o.processingOrders, sub: t("kpi.toFulfilNote"), icon: Clock, href: "/warehouse/pickpack", lead: false, urgent: o.processingOrders > 0 },
    { key: "shipments", label: t("kpi.openShipments"), value: o.openShipments, sub: t("kpi.openShipmentsNote"), icon: Truck, href: "/warehouse/pickpack", lead: false, urgent: false },
    { key: "low", label: t("kpi.lowStock"), value: o.lowStockCount, sub: t("kpi.lowStockNote"), icon: AlertTriangle, href: "/warehouse/stock?filter=low", lead: false, urgent: o.lowStockCount > 0 },
  ];

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline", { count: o.movements24h, value: String(o.movements24h) })}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/warehouse/inbound">
                  <Truck className="h-3.5 w-3.5" aria-hidden="true" /> {t("actions.inbound")}
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/warehouse/pickpack">
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" /> {t("actions.pickpack")}
                </Link>
              </Button>
            </>
          }
        />

        {/* One panel, four figures, each of them a link to the screen that acts
            on it. The whole cell is the target; the ring travels with it. */}
        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Link
                key={k.key}
                href={k.href}
                // No negative margin here: CellGrid draws its dividers as a 1px
                // gap that each cell paints over, so a child that overhangs its
                // cell covers the hairlines and the panel falls back to looking
                // like four floating boxes. The cell's own padding comes from
                // CellGrid, so the whole cell is already the link target.
                className="u-focus group block h-full rounded-nested transition-colors duration-hover ease-standard hover:bg-ink-1/[0.03]"
              >
                <div className="flex items-start justify-between gap-2">
                  <Eyebrow className="truncate">{k.label}</Eyebrow>
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${k.urgent ? "text-warning-ink" : "text-ink-3"}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-1.5">
                  <Num value={k.value} rank={k.lead ? "section" : "inline"} />
                </div>
                <p className="u-meta mt-1 text-ink-2">{k.sub}</p>
              </Link>
            );
          })}
        </CellGrid>

        <LedgerTable
          title={t("facilities.title")}
          dateline={t("facilities.dateline")}
          toolbar={
            <span className="u-meta text-ink-3">
              {t.rich("facilities.active", {
                count: String(o.warehouses.length),
                n: (chunks) => <span className="fig">{chunks}</span>,
              })}
            </span>
          }
          rows={o.warehouses}
          getRowKey={(w) => w.id}
          columns={[
            {
              key: "facility",
              label: t("facilities.columns.facility"),
              render: (w) => (
                <span className="inline-flex items-center gap-2 py-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
                    <WarehouseIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink-1">{w.nameEn}</span>
                    {w.nameAr && <span className="u-meta block text-ink-3">{w.nameAr}</span>}
                  </span>
                </span>
              ),
            },
            // A facility type the platform does not model is shown by its own
            // code rather than under an invented label.
            { key: "type", label: t("facilities.columns.type"), render: (w) => <StatusPill tone="neutral">{KNOWN_TYPES.has(w.type) ? t(`type.${w.type}`) : w.type}</StatusPill> },
            { key: "operator", label: t("facilities.columns.operator"), render: (w) => <span className="text-ink-2">{w.seller?.businessNameEn ?? platformName()}</span> },
            {
              key: "location",
              label: t("facilities.columns.location"),
              hideOnMobile: true,
              render: (w) => (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-2">
                  <MapPin className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" /> {w.city}, {w.country}
                </span>
              ),
            },
            {
              key: "bins",
              label: t("facilities.columns.bins"),
              hideOnMobile: true,
              render: (w) => (
                <span className="text-ink-2">
                  {t.rich("facilities.bins", {
                    locations: String(w.locations.length),
                    lines: String(w.locations.reduce((s, l) => s + l._count.stock, 0)),
                    n: (chunks) => <span className="fig">{chunks}</span>,
                  })}
                </span>
              ),
            },
            {
              key: "action",
              label: t("facilities.columns.stock"),
              align: "end",
              render: () => (
                <Button variant="link" size="xs" asChild>
                  <Link href="/warehouse/stock">
                    {t("facilities.stockLink")} <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("facilities.emptyEyebrow")}
              headline={t("facilities.emptyHeadline")}
              body={t("facilities.emptyBody")}
              icon={<WarehouseIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: "/warehouse/stock", label: t("links.stockLabel"), desc: t("links.stockDesc"), icon: Boxes },
            { href: "/warehouse/inbound", label: t("links.inboundLabel"), desc: t("links.inboundDesc"), icon: Truck },
            { href: "/warehouse/pickpack", label: t("links.pickpackLabel"), desc: t("links.pickpackDesc", { count: o.processingOrders, value: String(o.processingOrders) }), icon: Activity },
          ].map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group u-focus block rounded-lg">
                <Surface interactive className="h-full p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="u-ui inline-flex items-center gap-2 font-medium text-ink-1">
                      <Icon className="h-4 w-4 text-ink-3" aria-hidden="true" /> {l.label}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-hover ease-standard group-hover:translate-x-[calc(2px*var(--dir))] rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="u-meta mt-1 text-ink-2">{l.desc}</p>
                </Surface>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
