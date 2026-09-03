import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { computeSellerPerformanceScore, db } from "@avenick/database";
import { TrendingUp, RotateCcw, MessageSquare, Star, Award, Truck } from "lucide-react";

export const metadata = { title: "Performance" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Every figure on this page is measured from the seller's own records or is
 * shown as "—". There are no targets, no "platform average" and no colouring
 * by threshold: the platform publishes no benchmark, and the "illustrative
 * marketplace averages" this page used to print (91% on-time, 2.8% returns,
 * 3.5h response) were invented numbers presented as a comparison.
 */
export default async function PerformancePage() {
  const { seller, membership } = await requireSellerPermission("analytics.view");

  const [sellerOrders, deliveredShipments, returnsCount, threads, performance, reviews] = await Promise.all([
    db.order.findMany({ where: { items: { some: { sellerId: seller.id } } }, select: { createdAt: true } }),
    db.shipment.findMany({ where: { sellerId: seller.id, status: "DELIVERED", promisedBy: { not: null } }, select: { deliveredAt: true, promisedBy: true } }),
    db.returnRequest.count({ where: { sellerId: seller.id } }),
    db.messageThread.findMany({ where: { sellerId: seller.id, firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true } }),
    // The real score (paid lines shipped, listing health, current compliance
    // documents over a rolling window), or null when there is too little
    // activity to state one. SellerProfile.accountHealth is never recomputed
    // and is not used here.
    computeSellerPerformanceScore(seller.id),
    // SellerProfile.rating / reviewCount are columns nothing in the application
    // writes (the seed no longer does either), so they are not a measurement. The rating is
    // aggregated from the reviews buyers actually left on this seller's products.
    db.productReview.aggregate({ where: { product: { sellerId: seller.id } }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const reviewCount = reviews._count._all;

  const totalOrders = sellerOrders.length;

  // On-time delivery — only stated once at least one delivered shipment carried
  // a promised date; "100%" with nothing delivered was a claim, not a measurement.
  const onTimeCount = deliveredShipments.filter((s) => s.deliveredAt && s.promisedBy && s.deliveredAt <= s.promisedBy).length;
  const onTimeDelivery = deliveredShipments.length > 0 ? Math.round((onTimeCount / deliveredShipments.length) * 100) : null;

  // Return rate — requires at least one order to be a rate of anything.
  const returnRate = totalOrders > 0 ? Math.round((returnsCount / totalOrders) * 1000) / 10 : null;

  // Avg first-response time (hours) across threads that received a reply.
  const responseHours = threads.length > 0
    ? Math.round((threads.reduce((s, t) => s + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / threads.length / 3600000) * 10) / 10
    : null;

  const rating = reviewCount > 0 && reviews._avg.rating !== null ? Number(reviews._avg.rating) : null;

  // Monthly order trend (last 6 months)
  const now = new Date();
  const trend: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = sellerOrders.filter((o) => o.createdAt.getMonth() === d.getMonth() && o.createdAt.getFullYear() === d.getFullYear()).length;
    trend.push({ label: MONTHS[d.getMonth()]!, count });
  }
  const trendMax = Math.max(1, ...trend.map((t) => t.count));

  const metrics = [
    {
      label: "On-time delivery",
      value: onTimeDelivery === null ? "—" : `${onTimeDelivery}%`,
      basis: deliveredShipments.length > 0 ? `${onTimeCount} of ${deliveredShipments.length} delivered shipments with a promised date` : "No delivered shipments with a promised date yet",
      icon: Truck,
    },
    {
      label: "Return rate",
      value: returnRate === null ? "—" : `${returnRate}%`,
      basis: totalOrders > 0 ? `${returnsCount} return request${returnsCount === 1 ? "" : "s"} across ${totalOrders} order${totalOrders === 1 ? "" : "s"}` : "No orders yet",
      icon: RotateCcw,
    },
    {
      label: "Avg first response",
      value: responseHours === null ? "—" : `${responseHours}h`,
      basis: threads.length > 0 ? `Across ${threads.length} buyer thread${threads.length === 1 ? "" : "s"} you replied to` : "No buyer threads answered yet",
      icon: MessageSquare,
    },
    {
      label: "Buyer rating",
      value: rating === null ? "—" : rating.toFixed(1),
      basis: reviewCount > 0 ? `From ${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No reviews yet",
      icon: Star,
    },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions} performance={performance}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground">Measured from your own orders, shipments, returns, and messages</p>
        </div>

        {/* Score hero — the computed score or an honest "not enough data" */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-6">
          <div className="absolute -top-10 end-8 h-40 w-40 rounded-full bg-primary/15 blur-[80px]" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Award className="h-4 w-4 text-primary" /> Performance score</div>
              {performance ? (
                <>
                  <p className="mt-2 text-5xl font-bold font-mono tracking-tighter">{performance.score}<span className="text-2xl text-muted-foreground">/100</span></p>
                  <p className="text-sm text-muted-foreground mt-1">Last {performance.windowDays} days. The score has no effect on commission or ranking.</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold text-muted-foreground">Not enough data yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Ship a few paid orders or quote a few RFQs and a score will appear here.</p>
                </>
              )}
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">Reviews</p>
              <p className="text-2xl font-bold font-mono">{reviewCount}</p>
              {rating !== null && <p className="text-sm flex items-center gap-1 justify-end"><Star className="h-3.5 w-3.5 text-amber-400 fill-current" /> {rating.toFixed(1)}</p>}
            </div>
          </div>
          {performance && (
            <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
              {performance.components.map((component) => (
                <div key={component.key} className="rounded-xl border border-border/60 bg-card/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{component.label}</p>
                  <p className="text-sm font-semibold font-mono">
                    {component.share === null ? "—" : `${Math.round(component.share * 100)}%`}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {component.share === null ? "no data in window" : `${component.good} of ${component.total}`}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metric cards — value plus the exact basis it was computed from */}
        <div className="grid sm:grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><m.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{m.label}</span></div>
                <span className="text-lg font-bold font-mono">{m.value}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{m.basis}</p>
            </div>
          ))}
        </div>

        {/* Monthly order trend */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4"><TrendingUp className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Monthly orders</h2></div>
          <div className="flex items-end justify-between gap-3 h-36">
            {trend.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                  <div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-primary-600 to-accent-500" style={{ height: `${Math.max(6, (m.count / trendMax) * 100)}%` }} title={`${m.count} orders`} />
                </div>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
