import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getWarehouseOverview } from "@avenick/database";
import { Warehouse as WarehouseIcon, Boxes, Truck, Clock, AlertTriangle, ArrowRight, MapPin, Activity } from "lucide-react";
import Link from "next/link";

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
    { label: "Units on hand", value: o.totalUnits.toLocaleString(), sub: `${o.reservedUnits.toLocaleString()} reserved · ${o.stockLines} stock lines`, icon: Boxes, color: "text-primary", bg: "bg-blue-50 border-blue-200", href: "/warehouse/stock" },
    { label: "Orders to fulfil", value: o.processingOrders, sub: "confirmed / processing", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", href: "/warehouse/pickpack" },
    { label: "Open shipments", value: o.openShipments, sub: "in the carrier network", icon: Truck, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", href: "/warehouse/pickpack" },
    { label: "Low stock lines", value: o.lowStockCount, sub: "at or below reorder point", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200", href: "/warehouse/stock?filter=low" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Warehouse & 3PL</h1>
            <p className="text-muted-foreground text-sm">
              Live inventory across facilities · {o.movements24h} stock movements in the last 24h
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/warehouse/inbound" className="flex items-center gap-1.5 text-sm border border-border bg-white text-muted-foreground hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
              <Truck className="h-3.5 w-3.5" /> Inbound
            </Link>
            <Link href="/warehouse/pickpack" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <Boxes className="h-3.5 w-3.5" /> Pick & Pack
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Link key={k.label} href={k.href} className={`rounded-2xl border p-4 transition-transform hover:-translate-y-0.5 ${k.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <p className="text-2xl font-bold mt-1">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
              </Link>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Facilities</h2>
            <span className="text-xs text-muted-foreground">{o.warehouses.length} active</span>
          </div>
          {o.warehouses.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <WarehouseIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No active warehouses configured yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    {["Facility", "Type", "Operator", "Location", "Bin locations", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {o.warehouses.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <WarehouseIcon className="h-4 w-4 text-indigo-600" />
                          </span>
                          <span>
                            <span className="font-medium block">{w.nameEn}</span>
                            {w.nameAr && <span className="text-xs text-muted-foreground">{w.nameAr}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-muted-foreground">
                          {TYPE_LABEL[w.type] ?? w.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{w.seller?.businessNameEn ?? "Avenick"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {w.city}, {w.country}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {w.locations.length} locations · {w.locations.reduce((s, l) => s + l._count.stock, 0)} stock lines
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link href="/warehouse/stock" className="text-primary text-xs font-medium hover:underline inline-flex items-center gap-1">
                          Stock <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/warehouse/stock", label: "Stock manager", desc: "All stock lines with reserve and reorder levels", icon: Boxes },
            { href: "/warehouse/inbound", label: "Inbound receiving", desc: "Stock-in movements and adjustments", icon: Truck },
            { href: "/warehouse/pickpack", label: "Pick & pack queue", desc: `${o.processingOrders} paid orders awaiting fulfilment`, icon: Activity },
          ].map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 font-semibold text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" /> {l.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{l.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
