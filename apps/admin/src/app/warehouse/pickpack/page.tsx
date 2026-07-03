import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getPickPackQueue } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { ArrowLeft, Boxes, Truck, PackageCheck, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Pick & Pack" };
export const dynamic = "force-dynamic";

const SHIPMENT_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending pickup", color: "bg-amber-100 text-amber-700" },
  PICKED_UP: { label: "Picked up", color: "bg-blue-100 text-primary" },
  IN_TRANSIT: { label: "In transit", color: "bg-indigo-100 text-indigo-700" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "bg-purple-100 text-purple-700" },
};

export default async function PickPackPage() {
  await requireAdminSession();

  const { queue, shipments } = await getPickPackQueue();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/warehouse" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Warehouse
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Pick & Pack</span>
            </div>
            <h1 className="text-2xl font-bold">Pick & Pack Queue</h1>
            <p className="text-sm text-muted-foreground">Paid orders awaiting fulfilment, oldest first, plus shipments in the carrier network.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Orders in queue", value: queue.length, color: "bg-amber-50 border-amber-200" },
            { label: "Units to pick", value: queue.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0), color: "bg-blue-50 border-blue-200" },
            { label: "Active shipments", value: shipments.length, color: "bg-indigo-50 border-indigo-200" },
            { label: "Without shipment", value: queue.filter((o) => o.shipments.length === 0).length, color: "bg-red-50 border-red-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Fulfilment queue */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Awaiting fulfilment</h2>
            <span className="text-xs text-muted-foreground">FIFO · oldest first</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Order", "Age", "Customer", "Items", "Value", "Shipment"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <PackageCheck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">Queue is clear — no paid orders awaiting fulfilment.</p>
                    </td>
                  </tr>
                )}
                {queue.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.orderNumber}</Link>
                      <p className="text-[11px] text-muted-foreground">{o.type} · {o.status}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {formatDistanceToNow(o.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.user.firstName} {o.user.lastName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs">
                      <p className="truncate">
                        {o.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                        {o.items.length > 2 ? ` +${o.items.length - 2} more` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(Number(o.total), o.currency as never)}</td>
                    <td className="px-4 py-3">
                      {o.shipments.length > 0 ? (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                          {o.shipments.length} shipment{o.shipments.length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-600">Not shipped</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active shipments */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Active shipments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Shipment", "Order", "Seller", "Carrier", "Tracking", "Status", "Promised"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shipments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Truck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No shipments currently in the carrier network.</p>
                    </td>
                  </tr>
                )}
                {shipments.map((s) => {
                  const cfg = SHIPMENT_STATUS[s.status] ?? { label: s.status, color: "bg-slate-100 text-muted-foreground" };
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium">{s.shipmentNumber}</td>
                      <td className="px-4 py-3 text-primary">{s.order.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.seller.businessNameEn}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.carrier ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.trackingNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {s.promisedBy ? format(s.promisedBy, "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
