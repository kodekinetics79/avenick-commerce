import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { advanceShipment } from "./actions";
import { Truck, Package, CheckCircle2, Clock, MapPin, ArrowRight } from "lucide-react";

export const metadata = { title: "Shipments" };

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-secondary text-muted-foreground" },
  PICKED_UP: { label: "Picked up", cls: "bg-primary/15 text-primary" },
  IN_TRANSIT: { label: "In transit", cls: "bg-primary/15 text-primary" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  DELIVERED: { label: "Delivered", cls: "bg-success/15 text-success" },
  FAILED: { label: "Failed", cls: "bg-danger/15 text-danger" },
  RETURNED: { label: "Returned", cls: "bg-secondary text-muted-foreground" },
};

const NEXT_LABEL: Record<string, string> = {
  PENDING: "Mark picked up", PICKED_UP: "Mark in transit", IN_TRANSIT: "Out for delivery", OUT_FOR_DELIVERY: "Mark delivered",
};

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

export default async function ShipmentsPage() {
  const { seller } = await requireSellerSession();

  const shipments = await db.shipment.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: { select: { orderNumber: true } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  const inTransit = shipments.filter((s) => ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status)).length;
  const delivered = shipments.filter((s) => s.status === "DELIVERED").length;
  const stats = [
    { label: "In transit", value: inTransit, icon: Truck },
    { label: "Delivered", value: delivered, icon: CheckCircle2 },
    { label: "Total", value: shipments.length, icon: Package },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipments</h1>
          <p className="text-sm text-muted-foreground">Track and update fulfilment for your orders</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2"><s.icon className="h-4 w-4" /><span className="text-[11px]">{s.label}</span></div>
              <p className="text-2xl font-bold font-mono tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {shipments.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Truck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold">No shipments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Shipments appear here once you start fulfilling orders.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shipments.map((sh) => {
              const st = STATUS[sh.status]!;
              const nextLabel = NEXT_LABEL[sh.status];
              return (
                <div key={sh.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-semibold text-primary">{sh.shipmentNumber}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">Order {sh.order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sh.carrier ?? "Carrier TBD"}{sh.trackingNumber ? ` · ${sh.trackingNumber}` : ""}</p>
                    </div>
                    {nextLabel && (
                      <form action={advanceShipment.bind(null, sh.id)}>
                        <button type="submit" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
                          {nextLabel} <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                  </div>

                  {sh.events.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2.5">
                      {sh.events.map((ev, i) => (
                        <div key={ev.id} className="flex gap-2.5 text-sm">
                          <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-primary" : "bg-border"}`} />
                          <div>
                            <p className={i === 0 ? "font-medium" : "text-muted-foreground"}>{ev.note ?? ev.status.replace(/_/g, " ")}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">{ev.location && <><MapPin className="h-3 w-3" /> {ev.location} · </>}{fmt(ev.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
