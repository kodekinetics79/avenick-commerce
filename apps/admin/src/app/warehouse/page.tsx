import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getWarehouseOverview } from "@avenick/database";
import { Warehouse as WarehouseIcon, Boxes, Truck, Clock, AlertTriangle, ArrowRight, MapPin, Activity } from "lucide-react";
import Link from "next/link";
import { platformName } from "@avenick/utils/portal-config";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Eyebrow, Num, Button,
} from "@avenick/ui";

export const metadata = { title: "Warehouse & 3PL" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  SELLER: "Seller-operated",
  PLATFORM: "Platform",
  THIRD_PARTY_3PL: "3PL partner",
};

export default async function WarehousePage() {
  await requireAdminSession();

  const o = await getWarehouseOverview();

  const kpis = [
    { label: "Units on hand", value: o.totalUnits.toLocaleString(), sub: `${o.reservedUnits.toLocaleString()} reserved · ${o.stockLines} stock lines`, icon: Boxes, href: "/warehouse/stock", lead: true, urgent: false },
    { label: "Orders to fulfil", value: o.processingOrders, sub: "confirmed / processing", icon: Clock, href: "/warehouse/pickpack", lead: false, urgent: o.processingOrders > 0 },
    { label: "Open shipments", value: o.openShipments, sub: "in the carrier network", icon: Truck, href: "/warehouse/pickpack", lead: false, urgent: false },
    { label: "Low stock lines", value: o.lowStockCount, sub: "at or below reorder point", icon: AlertTriangle, href: "/warehouse/stock?filter=low", lead: false, urgent: o.lowStockCount > 0 },
  ];

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Operations"
          title="Warehouse & 3PL"
          description="Live inventory across facilities."
          dateline={`${o.movements24h} stock movement${o.movements24h === 1 ? "" : "s"} recorded in the last 24 hours`}
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/warehouse/inbound">
                  <Truck className="h-3.5 w-3.5" aria-hidden="true" /> Inbound
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/warehouse/pickpack">
                  <Boxes className="h-3.5 w-3.5" aria-hidden="true" /> Pick &amp; pack
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
                key={k.label}
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
          title="Facilities"
          dateline="Active warehouses and the bin locations recorded against them"
          toolbar={<span className="u-meta text-ink-3"><span className="fig">{o.warehouses.length}</span> active</span>}
          rows={o.warehouses}
          getRowKey={(w) => w.id}
          columns={[
            {
              key: "facility",
              label: "Facility",
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
            { key: "type", label: "Type", render: (w) => <StatusPill tone="neutral">{TYPE_LABEL[w.type] ?? w.type}</StatusPill> },
            { key: "operator", label: "Operator", render: (w) => <span className="text-ink-2">{w.seller?.businessNameEn ?? platformName()}</span> },
            {
              key: "location",
              label: "Location",
              hideOnMobile: true,
              render: (w) => (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-2">
                  <MapPin className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" /> {w.city}, {w.country}
                </span>
              ),
            },
            {
              key: "bins",
              label: "Bin locations",
              hideOnMobile: true,
              render: (w) => (
                <span className="text-ink-2">
                  <span className="fig">{w.locations.length}</span> locations ·{" "}
                  <span className="fig">{w.locations.reduce((s, l) => s + l._count.stock, 0)}</span> stock lines
                </span>
              ),
            },
            {
              key: "action",
              label: "Stock",
              align: "end",
              render: () => (
                <Button variant="link" size="xs" asChild>
                  <Link href="/warehouse/stock">
                    Stock <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing configured"
              headline="No active warehouse has been configured."
              body="A facility appears here once it is created and set active; stock lines are recorded against its bin locations."
              icon={<WarehouseIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: "/warehouse/stock", label: "Stock manager", desc: "All stock lines with reserve and reorder levels", icon: Boxes },
            { href: "/warehouse/inbound", label: "Inbound receiving", desc: "Stock-in movements and adjustments", icon: Truck },
            { href: "/warehouse/pickpack", label: "Pick & pack queue", desc: `${o.processingOrders} paid order${o.processingOrders === 1 ? "" : "s"} awaiting fulfilment`, icon: Activity },
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
