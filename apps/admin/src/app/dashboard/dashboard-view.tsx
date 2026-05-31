"use client";

import * as React from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { PageHeader, MetricCard, SectionHeader, AIInsightCard } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import {
  TrendingUp, Building2, Users, Store, ShoppingCart, Coins, Scale, Truck,
  Boxes, FileQuestion, Activity, ArrowRight, Brain, Plus, UserPlus, Megaphone,
  AlertTriangle, ChevronRight, Star, TrendingDown, PieChart, Tag,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingDown, Truck, FileQuestion, ShoppingCart, Boxes, Coins,
};

const QUICK_ACTIONS = [
  { label: "Create RFQ", icon: Plus, href: "/rfqs", variant: "primary" },
  { label: "Invite Supplier", icon: UserPlus, href: "/sellers/pending", variant: "default" },
  { label: "Launch Campaign", icon: Megaphone, href: "/campaigns", variant: "default" },
  { label: "Review Delayed Orders", icon: AlertTriangle, href: "/orders?status=PROCESSING", variant: "default" },
  { label: "Open Warehouse Queue", icon: Boxes, href: "/warehouse/pickpack", variant: "default" },
  { label: "View AI Insights", icon: Brain, href: "/ai-insights", variant: "accent" },
];

const SEV: Record<string, { dot: string; text: string; bg: string }> = {
  danger:  { dot: "bg-red-500",   text: "text-red-600",   bg: "hover:bg-red-50" },
  warning: { dot: "bg-amber-500", text: "text-amber-600", bg: "hover:bg-amber-50" },
};

interface ExecData {
  kpis: Record<string, number>;
  revenueSplit: { b2b: number; b2c: number };
  rfqFunnel: { stage: string; count: number; color: string }[];
  orderLifecycle: { stage: string; count: number; color: string }[];
  topCategories: { name: string; gmv: number; share: number }[];
  topSuppliers: { name: string; gmv: number; orders: number; rating: number; tier: string }[];
  aiRecommendations: { icon: string; iconStyle: string; title: string; description: string; confidence: number; tag: string; tagStyle: string; actionLabel: string; actionHref: string }[];
  operationalHealth: { label: string; value: number; severity: string; href: string }[];
}

interface TopCustomer { id: string; name: string; totalOrders: number; totalSpent: number; type: string }

export interface DashboardViewProps {
  exec: ExecData;
  topCustomers: TopCustomer[];
  gmvMonth: number;
  activeCompanies: number;
  activeSuppliers: number;
  pendingCount: number;
}

export function DashboardView({ exec, topCustomers, gmvMonth, activeCompanies, activeSuppliers, pendingCount }: DashboardViewProps) {
  const k = exec.kpis;

  const kpis = [
    { label: "Gross Merchandise Value", value: formatCurrency(gmvMonth, "AED"), icon: TrendingUp, trend: `+${k.gmvTrend}%`, trendUp: true, sub: "this month", iconColor: "bg-blue-100 text-blue-600" },
    { label: "B2B Revenue", value: formatCurrency(k.b2bRevenue, "AED"), icon: Building2, trend: `+${k.b2bTrend}%`, trendUp: true, sub: "this month", iconColor: "bg-indigo-100 text-indigo-600" },
    { label: "B2C Revenue", value: formatCurrency(k.b2cRevenue, "AED"), icon: ShoppingCart, trend: `+${k.b2cTrend}%`, trendUp: true, sub: "this month", iconColor: "bg-cyan-100 text-cyan-600" },
    { label: "Marketplace Commission", value: formatCurrency(k.commission, "AED"), icon: Coins, trend: `+${k.commissionTrend}%`, trendUp: true, sub: "this month", iconColor: "bg-green-100 text-green-600" },
    { label: "Active Companies", value: activeCompanies || k.activeCompanies, icon: Building2, trend: `+${k.companiesTrend}%`, trendUp: true, sub: "B2B accounts", iconColor: "bg-purple-100 text-purple-600" },
    { label: "Active B2C Customers", value: k.activeCustomers.toLocaleString(), icon: Users, trend: `+${k.customersTrend}%`, trendUp: true, sub: "this month", iconColor: "bg-blue-100 text-blue-600" },
    { label: "Active Suppliers", value: activeSuppliers || k.activeSuppliers, icon: Store, trend: `+${k.suppliersTrend}%`, trendUp: true, sub: "verified", iconColor: "bg-teal-100 text-teal-600" },
    { label: "RFQ Conversion Rate", value: `${k.rfqConversion}%`, icon: FileQuestion, trend: `+${k.rfqConversionTrend}%`, trendUp: true, sub: "quote → order", iconColor: "bg-amber-100 text-amber-600" },
    { label: "Order Fulfillment Rate", value: `${k.fulfillmentRate}%`, icon: TrendingUp, trend: `+${k.fulfillmentTrend}%`, trendUp: true, sub: "on-time", iconColor: "bg-green-100 text-green-600" },
    { label: "Warehouse Utilization", value: `${k.warehouseUtilization}%`, icon: Boxes, trend: `${k.warehouseTrend}%`, trendUp: false, sub: "capacity used", iconColor: "bg-slate-100 text-slate-600" },
    { label: "Open Disputes", value: k.openDisputes, icon: Scale, sub: "need mediation", urgent: k.openDisputes > 0, iconColor: "bg-red-100 text-red-600" },
    { label: "Delayed Orders", value: k.delayedOrders, icon: AlertTriangle, sub: "past SLA", urgent: k.delayedOrders > 0, iconColor: "bg-orange-100 text-orange-600" },
  ];

  const revTotal = exec.revenueSplit.b2b + exec.revenueSplit.b2c;
  const b2bPct = Math.round((exec.revenueSplit.b2b / revTotal) * 100);
  const rfqMax = Math.max(...exec.rfqFunnel.map((s) => s.count));
  const lifeMax = Math.max(...exec.orderLifecycle.map((s) => s.count));

  return (
    <AdminLayout pendingCount={pendingCount}>
      <PageHeader
        eyebrow="Avenick Commerce · Modern Trade OS"
        title="Executive Command Center"
        description="Real-time view of marketplace performance across B2B and B2C — revenue, suppliers, fulfillment, and AI-driven actions."
        linkComponent={Link}
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border rounded-lg px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Live
            </span>
            <Link href="/ai-insights" className="flex items-center gap-1.5 bg-accent text-accent-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-accent/90 transition-colors">
              <Brain className="h-3.5 w-3.5" /> AI Insights
            </Link>
          </div>
        }
      />

      <div className="space-y-8">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, icon: Icon, href, variant }) => (
            <Link
              key={label}
              href={href}
              className={
                variant === "primary"
                  ? "flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
                  : variant === "accent"
                  ? "flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
                  : "flex items-center gap-1.5 bg-card border border-border text-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-secondary transition-colors"
              }
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </div>

        {/* Executive KPI grid */}
        <section>
          <SectionHeader title="Marketplace KPIs" description="Performance snapshot · this month" icon={Activity} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
              <MetricCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                trend={kpi.trend}
                trendUp={kpi.trendUp}
                sub={kpi.sub}
                icon={kpi.icon}
                iconColor={kpi.iconColor}
                urgent={kpi.urgent}
              />
            ))}
          </div>
        </section>

        {/* AI recommendations + operational health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <SectionHeader
              title="AI Recommendations"
              description="Prioritized actions from the commerce intelligence engine"
              icon={Brain}
              action={<Link href="/ai-insights" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exec.aiRecommendations.map((rec) => (
                <AIInsightCard
                  key={rec.title}
                  icon={ICON_MAP[rec.icon] ?? Brain}
                  iconStyle={rec.iconStyle}
                  title={rec.title}
                  description={rec.description}
                  confidence={rec.confidence}
                  tag={rec.tag}
                  tagStyle={rec.tagStyle}
                  actionLabel={rec.actionLabel}
                  actionHref={rec.actionHref}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="Operational Health" description="Items needing attention" icon={Activity} />
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden divide-y divide-border">
              {exec.operationalHealth.map((item) => {
                const s = SEV[item.severity] ?? SEV.warning;
                return (
                  <Link key={item.label} href={item.href} className={`flex items-center justify-between px-4 py-3.5 transition-colors ${s.bg}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                      <span className="text-sm text-foreground truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold ${s.text}`}>{item.value}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
            {pendingCount > 0 && (
              <Link href="/sellers/pending" className="mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100/60 transition-colors">
                <div>
                  <p className="font-semibold text-amber-800 text-sm">{pendingCount} supplier{pendingCount !== 1 ? "s" : ""} awaiting review</p>
                  <p className="text-xs text-amber-600">Approve or reject pending applications</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-600" />
              </Link>
            )}
          </section>
        </div>

        {/* Visual row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <SectionHeader title="Revenue Split" description="B2B vs B2C" icon={PieChart} />
            <div className="flex items-end gap-2 mb-4">
              <p className="text-3xl font-bold text-foreground">{formatCurrency(revTotal, "AED")}</p>
              <p className="text-xs text-muted-foreground mb-1.5">total</p>
            </div>
            <div className="flex gap-0.5 h-3 mb-3">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className={`flex-1 rounded-full ${i < Math.round((b2bPct / 100) * 20) ? "bg-indigo-500" : "bg-cyan-500"}`} />
              ))}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> B2B</span>
                <span className="font-semibold">{formatCurrency(exec.revenueSplit.b2b, "AED")} · {b2bPct}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> B2C</span>
                <span className="font-semibold">{formatCurrency(exec.revenueSplit.b2c, "AED")} · {100 - b2bPct}%</span>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <SectionHeader title="RFQ Funnel" description="Created → accepted" icon={FileQuestion}
              action={<Link href="/rfqs" className="text-xs text-primary hover:underline font-medium">View</Link>} />
            <div className="space-y-2.5">
              {exec.rfqFunnel.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.stage}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                  <div className="flex gap-0.5 h-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className={`flex-1 rounded-full ${i < Math.round((s.count / rfqMax) * 20) ? s.color : "bg-slate-100"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <SectionHeader title="Order Lifecycle" description="Active pipeline" icon={ShoppingCart}
              action={<Link href="/orders" className="text-xs text-primary hover:underline font-medium">View</Link>} />
            <div className="space-y-2.5">
              {exec.orderLifecycle.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.stage}</span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                  <div className="flex gap-0.5 h-2">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className={`flex-1 rounded-full ${i < Math.max(1, Math.round((s.count / lifeMax) * 20)) ? s.color : "bg-slate-100"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visual row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border"><SectionHeader title="Top Categories" icon={Tag} className="mb-0" /></div>
            <div className="p-5 space-y-3">
              {exec.topCategories.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{formatCurrency(c.gmv, "AED")}</span>
                  </div>
                  <div className="flex gap-0.5 h-1.5">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className={`flex-1 rounded-full ${i < Math.round((c.share / 30) * 20) ? "bg-blue-500" : "bg-slate-100"}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <SectionHeader title="Top Suppliers" icon={Store} className="mb-0" />
              <Link href="/sellers" className="text-xs text-primary hover:underline font-medium">All</Link>
            </div>
            <div className="divide-y divide-border">
              {exec.topSuppliers.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-current" /> {s.rating} · {s.orders} orders
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-700 shrink-0">{formatCurrency(s.gmv, "AED")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <SectionHeader title="Top Customers" icon={Users} className="mb-0" />
              <Link href="/crm" className="text-xs text-primary hover:underline font-medium">CRM</Link>
            </div>
            <div className="divide-y divide-border">
              {topCustomers.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.totalOrders} orders</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-semibold text-green-700">{formatCurrency(c.totalSpent, "AED")}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${c.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{c.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
