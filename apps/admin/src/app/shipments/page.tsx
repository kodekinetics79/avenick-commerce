import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ShipmentStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { Truck, CheckCircle, Clock, AlertTriangle, Package, RotateCcw, CircleOff } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Shipments" };
export const dynamic = "force-dynamic";

/**
 * This page previously rendered four invented shipments — invented carriers,
 * tracking numbers, routes and values — under two status codes (PENDING_PICKUP,
 * EXCEPTION) that do not exist in the ShipmentStatus enum. An operator could not
 * tell that no shipment has ever been recorded.
 *
 * The Shipment and ShipmentEvent models exist, but no code path in the repository
 * creates a Shipment row — not the checkout flow, not the seller portal, not the
 * seed (which only deletes). apps/seller/src/app/shipments/actions.ts advances
 * rows it finds and returns early when there are none. So the table is empty and
 * stays empty until fulfilment learns to create shipments.
 *
 * The query below is real, so this page becomes correct the moment that happens.
 * Until then the empty state names the capability gap, because "no shipments
 * today" and "shipments are never recorded" mean very different things to an
 * operator and only the second one is true.
 */

const STATUS: Record<ShipmentStatus, { label: string; color: string; icon: typeof Truck }> = {
  PENDING: { label: "Pending pickup", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Clock },
  PICKED_UP: { label: "Picked up", color: "bg-primary/10 text-primary", icon: Package },
  IN_TRANSIT: { label: "In transit", color: "bg-primary/10 text-primary", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400", icon: Truck },
  DELIVERED: { label: "Delivered", color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-500/10 text-red-700 dark:text-red-400", icon: AlertTriangle },
  RETURNED: { label: "Returned", color: "bg-secondary text-muted-foreground", icon: RotateCcw },
};

const fmtDate = (d: Date | null) => (d ? format(d, "d MMM yyyy") : "—");

export default async function ShipmentsPage() {
  await requireAdminSession();

  const shipments = await db.shipment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: {
        select: {
          orderNumber: true,
          total: true,
          currency: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      seller: { select: { businessNameEn: true } },
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const countFor = (statuses: ShipmentStatus[]) => shipments.filter((s) => statuses.includes(s.status)).length;
  const failed = countFor(["FAILED"]);
  // take: 100 above, so the tiles below count the loaded page, not all history.
  const truncated = shipments.length === 100;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shipments</h1>
            <p className="text-sm text-muted-foreground">Marketplace-wide outbound shipment oversight</p>
          </div>
          <div className="flex items-center gap-2">
            {shipments.length === 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <CircleOff className="h-3.5 w-3.5" /> No records
              </span>
            )}
            <Link href="/warehouse/pickpack" className="flex items-center gap-1.5 bg-card border border-border text-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-secondary transition-colors">
              <Package className="h-3.5 w-3.5" /> Pick &amp; Pack Queue
            </Link>
          </div>
        </div>

        {shipments.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold">No shipment has ever been recorded</p>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              This is a capability gap, not a quiet day. Nothing in the platform creates a shipment record —
              not checkout, not order confirmation, not the seller portal — so carrier tracking, delivery
              dates and transit exceptions are unavailable marketplace-wide. The seller fulfilment screen can
              only advance a shipment that already exists.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
              Paid orders awaiting fulfilment are real and visible in the{" "}
              <Link href="/warehouse/pickpack" className="font-medium text-primary hover:underline">
                Pick &amp; Pack queue
              </Link>
              . This register will populate on its own once fulfilment begins writing shipments.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Pending pickup", value: countFor(["PENDING"]), color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                { label: "In transit", value: countFor(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"]), color: "text-primary", bg: "bg-primary/10 border-primary/20" },
                { label: "Delivered", value: countFor(["DELIVERED"]), color: "text-green-600 dark:text-green-400", bg: "bg-card border-border" },
                { label: "Failed", value: failed, color: failed > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground", bg: failed > 0 ? "bg-red-500/10 border-red-500/20" : "bg-card border-border" },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {truncated && (
              <p className="text-xs text-muted-foreground">
                Showing the 100 most recent shipments. The counts above cover only those, not the full shipment history.
              </p>
            )}

            {failed > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                <p className="font-semibold text-red-800 dark:text-red-400 text-sm">
                  {failed} failed shipment{failed !== 1 ? "s" : ""} {failed !== 1 ? "need" : "needs"} resolution to avoid order disputes{truncated ? " (within the 100 most recent)" : ""}.
                </p>
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>{["Shipment", "Order", "Seller", "Buyer", "Carrier", "Order value", "Status", "Promised", "Delivered"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shipments.map((s) => {
                      const sc = STATUS[s.status];
                      const StatusIcon = sc.icon;
                      const latest = s.events[0];
                      return (
                        <tr key={s.id} className={`hover:bg-secondary/40 transition-colors ${s.status === "FAILED" ? "bg-red-500/5" : ""}`}>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-semibold text-primary">{s.shipmentNumber}</p>
                            {latest?.location && <p className="text-xs text-muted-foreground mt-0.5">{latest.location}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{s.order.orderNumber}</td>
                          <td className="px-4 py-3 font-medium">{s.seller.businessNameEn}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.order.user.firstName} {s.order.user.lastName}</td>
                          <td className="px-4 py-3">
                            <p className="text-xs">{s.carrier ?? <span className="text-muted-foreground">Not set</span>}</p>
                            {s.trackingNumber && <p className="font-mono text-xs text-muted-foreground">{s.trackingNumber}</p>}
                          </td>
                          {/* Shipment carries no value of its own; this is the parent order total, which
                              is not the shipment's value when an order ships in more than one parcel. */}
                          <td className="px-4 py-3 font-bold text-green-700 dark:text-green-400">{formatCurrency(Number(s.order.total), s.order.currency as never)}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}><StatusIcon className="h-3 w-3" /> {sc.label}</span></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.promisedBy)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.deliveredAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
