import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSlaMetrics } from "@avenick/database";
import { Gauge, Clock, Truck, AlertTriangle, LifeBuoy } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

export const metadata = { title: "SLA Monitor" };
export const dynamic = "force-dynamic";

export default async function SlaPage() {
  await requireAdminSession();

  const m = await getSlaMetrics();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">SLA Monitor</h1>
          <p className="text-muted-foreground text-sm">
            Support responsiveness and delivery promise-keeping, measured from live tickets and shipments.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open tickets", value: m.openTickets, icon: LifeBuoy, color: m.openTickets > 5 ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-border text-muted-foreground" },
            { label: "Resolved within 24h", value: m.resolvedWithin24hPct !== null ? `${m.resolvedWithin24hPct}%` : "—", icon: Clock, color: "bg-blue-50 border-blue-200 text-primary" },
            { label: "On-time delivery", value: m.onTimeDeliveryPct !== null ? `${m.onTimeDeliveryPct}%` : "—", icon: Truck, color: "bg-green-50 border-green-200 text-green-700" },
            { label: "Late shipments", value: m.lateShipments.length, icon: AlertTriangle, color: m.lateShipments.length > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-border text-muted-foreground" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`rounded-2xl border p-4 ${s.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <Icon className={`h-4 w-4 ${s.color.split(" ")[2]}`} />
                </div>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Aging tickets */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Oldest open tickets</h2>
              <Link href="/support" className="text-xs text-primary hover:underline">All tickets →</Link>
            </div>
            {m.oldestOpen.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Gauge className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No open tickets — support queue is clear.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {m.oldestOpen.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/support/${t.id}`} className="min-w-0">
                        <p className="text-sm font-medium truncate hover:text-primary">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.ticketNumber} · {t.user.firstName} {t.user.lastName} · {t.priority}
                        </p>
                      </Link>
                      <span className="text-xs text-amber-600 font-medium whitespace-nowrap shrink-0">
                        open {formatDistanceToNow(t.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Late shipments */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Shipments past their promise date</h2>
            </div>
            {m.lateShipments.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Truck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No shipments are past their promised delivery date.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {m.lateShipments.map((s) => (
                  <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.shipmentNumber} · {s.order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{s.seller.businessNameEn} · {s.carrier ?? "no carrier"}</p>
                    </div>
                    <span className="text-xs text-red-600 font-medium whitespace-nowrap shrink-0">
                      promised {s.promisedBy ? format(s.promisedBy, "MMM d") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Delivered shipments measured: {m.deliveredShipments}. SLA targets: first response &lt; 4h, resolution &lt; 24h, delivery by promise date.
        </p>
      </div>
    </AdminLayout>
  );
}
