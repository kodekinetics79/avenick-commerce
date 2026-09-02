import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { TrendingUp, ShoppingCart, Wallet, Package, BarChart3, ArrowUpRight } from "lucide-react";

export const metadata = { title: "Analytics" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function AnalyticsPage() {
  const { seller, membership } = await requireSellerPermission("analytics.view");

  const allItems = await db.orderItem.findMany({
    where: { sellerId: seller.id, order: { status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } } },
    include: {
      order: { select: { id: true, createdAt: true, currency: true } },
      product: { select: { nameEn: true, category: { select: { nameEn: true } } } },
    },
  });

  // Order lines carry the order's currency, and a GCC seller can sell in more
  // than one. Adding lines across currencies and calling the sum "AED" (what
  // this page used to do) produced a figure that exists in no ledger, so the
  // analytics are computed in the seller's most-used currency and the lines
  // left out are disclosed below the KPIs.
  const currencyCounts = new Map<string, number>();
  for (const i of allItems) currencyCounts.set(i.order.currency, (currencyCounts.get(i.order.currency) ?? 0) + 1);
  const currency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const items = currency ? allItems.filter((i) => i.order.currency === currency) : [];
  const excludedCount = allItems.length - items.length;
  const excludedCurrencies = [...currencyCounts.keys()].filter((c) => c !== currency).sort();
  const money = (n: number) => (currency ? formatCurrency(n, currency as never) : "—");

  const orderIds = new Set(items.map((i) => i.order.id));
  const totalRevenue = items.reduce((s, i) => s + Number(i.total), 0);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const aov = orderIds.size > 0 ? totalRevenue / orderIds.size : 0;

  const now = new Date();
  const thisMonthRev = items.filter((i) => i.order.createdAt.getMonth() === now.getMonth() && i.order.createdAt.getFullYear() === now.getFullYear()).reduce((s, i) => s + Number(i.total), 0);

  // Monthly revenue trend
  const trend: { label: string; value: number }[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const value = items.filter((i) => i.order.createdAt.getMonth() === d.getMonth() && i.order.createdAt.getFullYear() === d.getFullYear()).reduce((s, i) => s + Number(i.total), 0);
    trend.push({ label: MONTHS[d.getMonth()]!, value });
  }
  const trendMax = Math.max(1, ...trend.map((t) => t.value));

  // Top products
  const byProduct = new Map<string, { revenue: number; units: number }>();
  for (const i of items) {
    const k = i.product?.nameEn ?? i.nameEn;
    const cur = byProduct.get(k) ?? { revenue: 0, units: 0 };
    cur.revenue += Number(i.total);
    cur.units += i.quantity;
    byProduct.set(k, cur);
  }
  const topProducts = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const topMax = Math.max(1, ...topProducts.map((p) => p.revenue));

  // Revenue by category
  const byCat = new Map<string, number>();
  for (const i of items) {
    const k = i.product?.category?.nameEn ?? "Other";
    byCat.set(k, (byCat.get(k) ?? 0) + Number(i.total));
  }
  const categories = [...byCat.entries()].map(([name, revenue]) => ({ name, revenue, pct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0 })).sort((a, b) => b.revenue - a.revenue);

  const kpis = [
    { label: currency ? `Total revenue (${currency})` : "Total revenue", value: money(totalRevenue), icon: Wallet },
    { label: "This month", value: money(thisMonthRev), icon: TrendingUp },
    { label: "Orders", value: orderIds.size, icon: ShoppingCart },
    { label: "Avg order value", value: money(aov), icon: Package },
  ];

  const empty = items.length === 0;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Sales performance across your catalog</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><k.icon className="h-4 w-4" /></span>
              </div>
              <p className="mt-3 text-xl font-bold font-mono tracking-tight">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
        {excludedCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {excludedCount} order line{excludedCount === 1 ? "" : "s"} in {excludedCurrencies.join(", ")} {excludedCount === 1 ? "is" : "are"} not included; figures are in {currency} only and currencies are not converted.
          </p>
        )}

        {empty ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold">No sales data yet</p>
            <p className="text-sm text-muted-foreground mt-1">Analytics populate as your orders come in.</p>
          </div>
        ) : (
          <>
            {/* Revenue trend */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4"><TrendingUp className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Revenue trend</h2></div>
              <div className="flex items-end justify-between gap-3 h-44">
                {trend.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{m.value > 0 ? `${Math.round(m.value / 1000)}k` : ""}</span>
                    <div className="w-full flex items-end justify-center flex-1">
                      <div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-primary-600 to-accent-500" style={{ height: `${Math.max(4, (m.value / trendMax) * 100)}%` }} title={money(m.value)} />
                    </div>
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top products */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-4">Top products</h2>
                <div className="space-y-3.5">
                  {topProducts.map((p, i) => (
                    <div key={p.name}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium truncate flex items-center gap-2"><span className="text-xs text-muted-foreground w-4">{i + 1}</span>{p.name}</span>
                        <span className="font-mono text-muted-foreground shrink-0">{money(p.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${(p.revenue / topMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue by category */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-4">Revenue by category</h2>
                <div className="space-y-3.5">
                  {categories.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium">{c.name}</span>
                        <span className="font-mono text-muted-foreground">{money(c.revenue)} · {c.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${c.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">{totalUnits.toLocaleString()} units sold across {categories.length} categor{categories.length !== 1 ? "ies" : "y"}.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </SellerLayout>
  );
}
