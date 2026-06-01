import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { TrendingUp, RotateCcw, MessageSquare, Star, Award, Target, Truck } from "lucide-react";

export const metadata = { title: "Performance" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Platform reference benchmarks (illustrative marketplace averages).
const BENCHMARK = { onTimeDelivery: 91, returnRate: 2.8, responseHours: 3.5 };

export default async function PerformancePage() {
  const { seller } = await requireSellerSession();

  const [sellerOrders, deliveredShipments, returnsCount, threads] = await Promise.all([
    db.order.findMany({ where: { items: { some: { sellerId: seller.id } } }, select: { createdAt: true } }),
    db.shipment.findMany({ where: { sellerId: seller.id, status: "DELIVERED", promisedBy: { not: null } }, select: { deliveredAt: true, promisedBy: true } }),
    db.returnRequest.count({ where: { sellerId: seller.id } }),
    db.messageThread.findMany({ where: { sellerId: seller.id, firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true } }),
  ]);

  const totalOrders = sellerOrders.length;

  // On-time delivery
  const onTimeCount = deliveredShipments.filter((s) => s.deliveredAt && s.promisedBy && s.deliveredAt <= s.promisedBy).length;
  const onTimeDelivery = deliveredShipments.length > 0 ? Math.round((onTimeCount / deliveredShipments.length) * 100) : 100;

  // Return rate
  const returnRate = totalOrders > 0 ? Math.round((returnsCount / totalOrders) * 1000) / 10 : 0;

  // Avg first-response time (hours)
  const responseHours = threads.length > 0
    ? Math.round((threads.reduce((s, t) => s + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / threads.length / 3600000) * 10) / 10
    : 0;

  const overallScore = seller.accountHealth;
  const rating = seller.rating ? Number(seller.rating) : 0;

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
    { label: "On-time delivery", value: `${onTimeDelivery}%`, pct: onTimeDelivery, target: 90, bench: BENCHMARK.onTimeDelivery, good: onTimeDelivery >= 90, icon: Truck },
    { label: "Return rate", value: `${returnRate}%`, pct: Math.max(0, 100 - returnRate * 10), target: 3, bench: BENCHMARK.returnRate, good: returnRate <= 3, icon: RotateCcw, invert: true },
    { label: "Avg response time", value: responseHours > 0 ? `${responseHours}h` : "—", pct: Math.max(0, 100 - responseHours * 10), target: 4, bench: BENCHMARK.responseHours, good: responseHours > 0 && responseHours <= 4, icon: MessageSquare, invert: true },
    { label: "Buyer rating", value: rating > 0 ? rating.toFixed(1) : "—", pct: (rating / 5) * 100, target: 4.5, bench: 4.4, good: rating >= 4.5, icon: Star },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground">Your account health, fulfilment quality, and responsiveness</p>
        </div>

        {/* Overall score hero */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-6">
          <div className="absolute -top-10 end-8 h-40 w-40 rounded-full bg-primary/15 blur-[80px]" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Award className="h-4 w-4 text-primary" /> Account health score</div>
              <p className="mt-2 text-5xl font-bold font-mono tracking-tighter">{overallScore}<span className="text-2xl text-muted-foreground">/100</span></p>
              <p className="text-sm text-muted-foreground mt-1">
                {overallScore >= 85 ? "Excellent standing — eligible for reduced commission tiers." : overallScore >= 60 ? "Good standing — keep it up." : "Needs attention — review fulfilment & responsiveness."}
              </p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground">Reviews</p>
              <p className="text-2xl font-bold font-mono">{seller.reviewCount}</p>
              {rating > 0 && <p className="text-sm flex items-center gap-1 justify-end"><Star className="h-3.5 w-3.5 text-amber-400 fill-current" /> {rating.toFixed(1)}</p>}
            </div>
          </div>
        </div>

        {/* Metric bars */}
        <div className="grid sm:grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><m.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{m.label}</span></div>
                <span className={`text-lg font-bold font-mono ${m.good ? "text-success" : "text-amber-600 dark:text-amber-400"}`}>{m.value}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full ${m.good ? "bg-gradient-to-r from-primary-500 to-accent-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, Math.max(4, m.pct))}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Target {m.invert ? "≤" : "≥"} {m.target}{m.label.includes("rate") || m.label.includes("delivery") ? "%" : m.label.includes("response") ? "h" : ""}</span>
                <span>Platform avg {m.bench}{m.label.includes("rate") || m.label.includes("delivery") ? "%" : m.label.includes("response") ? "h" : ""}</span>
              </div>
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
