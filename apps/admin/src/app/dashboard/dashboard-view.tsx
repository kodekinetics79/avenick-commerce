"use client";

import * as React from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import { AIInsightCard } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";
import {
  TrendingUp, Building2, Users, Store, ShoppingCart, Coins, Scale, Truck,
  Boxes, FileQuestion, ArrowRight, Brain, Plus, UserPlus, Megaphone,
  AlertTriangle, ChevronRight, Star, TrendingDown, PieChart, Tag,
  ArrowUpRight, ArrowDownRight, Sparkles,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingDown, Truck, FileQuestion, ShoppingCart, Boxes, Coins,
};

const QUICK_ACTIONS = [
  { label: "Create RFQ", icon: Plus, href: "/rfqs" },
  { label: "Invite supplier", icon: UserPlus, href: "/sellers/pending" },
  { label: "Launch campaign", icon: Megaphone, href: "/campaigns" },
  { label: "Warehouse queue", icon: Boxes, href: "/warehouse/pickpack" },
];

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

/* ── Reusable bits ─────────────────────────────────────── */
function Trend({ value, up }: { value: string; up: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {value}
    </span>
  );
}

function Bars({ ratio, gradient = true }: { ratio: number; gradient?: boolean }) {
  const filled = Math.max(1, Math.round(ratio * 20));
  return (
    <div className="flex gap-0.5 h-2">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 rounded-full ${i < filled ? (gradient ? "bg-gradient-to-r from-primary-500 to-accent-500" : "bg-primary") : "bg-secondary"}`}
        />
      ))}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-card ${className}`}>{children}</div>;
}

function PanelHead({ title, sub, icon: Icon, action }: { title: string; sub?: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function DashboardView({ exec, topCustomers, gmvMonth, activeCompanies, activeSuppliers, pendingCount }: DashboardViewProps) {
  const k = exec.kpis;

  const heroKpis = [
    { label: "Gross merchandise value", value: formatCurrency(gmvMonth, "AED"), icon: TrendingUp, trend: `${k.gmvTrend}%`, up: true, hero: true },
    { label: "B2B revenue", value: formatCurrency(k.b2bRevenue, "AED"), icon: Building2, trend: `${k.b2bTrend}%`, up: true },
    { label: "B2C revenue", value: formatCurrency(k.b2cRevenue, "AED"), icon: ShoppingCart, trend: `${k.b2cTrend}%`, up: true },
    { label: "Commission", value: formatCurrency(k.commission, "AED"), icon: Coins, trend: `${k.commissionTrend}%`, up: true },
  ];

  const statKpis = [
    { label: "Active companies", value: activeCompanies || k.activeCompanies, icon: Building2, trend: `${k.companiesTrend}%`, up: true },
    { label: "B2C customers", value: k.activeCustomers.toLocaleString(), icon: Users, trend: `${k.customersTrend}%`, up: true },
    { label: "Active suppliers", value: activeSuppliers || k.activeSuppliers, icon: Store, trend: `${k.suppliersTrend}%`, up: true },
    { label: "RFQ conversion", value: `${k.rfqConversion}%`, icon: FileQuestion, trend: `${k.rfqConversionTrend}%`, up: true },
    { label: "Fulfillment rate", value: `${k.fulfillmentRate}%`, icon: TrendingUp, trend: `${k.fulfillmentTrend}%`, up: true },
    { label: "Warehouse use", value: `${k.warehouseUtilization}%`, icon: Boxes, trend: `${k.warehouseTrend}%`, up: false },
  ];

  const alerts = [
    { label: "Open disputes", value: k.openDisputes, sub: "need mediation", icon: Scale, href: "/disputes" },
    { label: "Delayed orders", value: k.delayedOrders, sub: "past SLA", icon: AlertTriangle, href: "/orders?status=PROCESSING" },
  ].filter((a) => a.value > 0);

  const revTotal = exec.revenueSplit.b2b + exec.revenueSplit.b2c;
  const b2bPct = Math.round((exec.revenueSplit.b2b / revTotal) * 100);
  const rfqMax = Math.max(...exec.rfqFunnel.map((s) => s.count));
  const lifeMax = Math.max(...exec.orderLifecycle.map((s) => s.count));
  const catMax = Math.max(...exec.topCategories.map((c) => c.share));

  return (
    <AdminLayout pendingCount={pendingCount}>
      {/* Hero band */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card mb-8">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute -top-16 end-10 h-56 w-56 rounded-full bg-primary/15 blur-[100px]" />
        <div className="relative px-6 py-7 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Database-backed marketplace overview
            </span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Executive Command Center</h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
              Real-time marketplace performance across B2B and B2C — revenue, suppliers, fulfillment, and AI-driven actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
              <Link key={label} href={href} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors">
                <Icon className="h-3.5 w-3.5" /> {label}
              </Link>
            ))}
            <Link href="/ai-insights" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 hover:shadow-glow-sm transition-all active:scale-[0.98]">
              <Brain className="h-3.5 w-3.5" /> AI Insights
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Hero KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {heroKpis.map((kpi) => (
            <div
              key={kpi.label}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all hover:-translate-y-0.5 ${
                kpi.hero
                  ? "border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 shadow-glow-sm"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${kpi.hero ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  <kpi.icon className="h-4 w-4" />
                </span>
                <Trend value={kpi.trend} up={kpi.up} />
              </div>
              <p className="mt-4 text-2xl font-bold font-mono tracking-tight">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Stat strip + alerts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statKpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-2 text-muted-foreground mb-2.5">
                <kpi.icon className="h-4 w-4" />
                <span className="text-[11px] truncate">{kpi.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <p className="text-xl font-bold font-mono tracking-tight">{kpi.value}</p>
                <Trend value={kpi.trend} up={kpi.up} />
              </div>
            </div>
          ))}
        </div>

        {alerts.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {alerts.map((a) => (
              <Link key={a.label} href={a.href} className="flex items-center justify-between rounded-2xl border border-danger/30 bg-danger/5 p-4 hover:bg-danger/10 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-danger/15 text-danger"><a.icon className="h-5 w-5" /></span>
                  <div>
                    <p className="font-semibold text-sm">{a.value} {a.label.toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">{a.sub}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}

        {/* AI recommendations + operational health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">AI recommendations</h2>
              </div>
              <Link href="/ai-insights" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">View all <ArrowRight className="h-3 w-3" /></Link>
            </div>
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
            <h2 className="text-base font-semibold mb-4">Operational health</h2>
            <Panel className="overflow-hidden divide-y divide-border">
              {exec.operationalHealth.map((item) => {
                const danger = item.severity === "danger";
                return (
                  <Link key={item.label} href={item.href} className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${danger ? "bg-danger" : "bg-warning"}`} />
                      <span className="text-sm truncate">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold font-mono ${danger ? "text-danger" : "text-warning"}`}>{item.value}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </Panel>
            {pendingCount > 0 && (
              <Link href="/sellers/pending" className="mt-3 flex items-center justify-between rounded-2xl border border-warning/30 bg-warning/5 p-4 hover:bg-warning/10 transition-colors">
                <div>
                  <p className="font-semibold text-sm">{pendingCount} supplier{pendingCount !== 1 ? "s" : ""} awaiting review</p>
                  <p className="text-xs text-muted-foreground">Approve or reject pending applications</p>
                </div>
                <ArrowRight className="h-4 w-4 text-warning" />
              </Link>
            )}
          </section>
        </div>

        {/* Charts bento */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel className="p-5">
            <PanelHead title="Revenue split" sub="B2B vs B2C" icon={PieChart} />
            <div className="p-0 pt-5">
              <div className="flex items-end gap-2 mb-4">
                <p className="text-3xl font-bold font-mono tracking-tight">{formatCurrency(revTotal, "AED")}</p>
                <p className="text-xs text-muted-foreground mb-1.5">total</p>
              </div>
              <div className="flex gap-0.5 h-3 mb-4 rounded-full overflow-hidden">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className={`flex-1 ${i < Math.round((b2bPct / 100) * 20) ? "bg-primary" : "bg-accent"}`} />
                ))}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> B2B</span>
                  <span className="font-semibold font-mono">{formatCurrency(exec.revenueSplit.b2b, "AED")} · {b2bPct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-accent" /> B2C</span>
                  <span className="font-semibold font-mono">{formatCurrency(exec.revenueSplit.b2c, "AED")} · {100 - b2bPct}%</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead title="RFQ funnel" sub="Created → accepted" icon={FileQuestion} action={<Link href="/rfqs" className="text-xs text-primary hover:underline font-medium">View</Link>} />
            <div className="space-y-3 pt-5">
              {exec.rfqFunnel.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.stage}</span>
                    <span className="font-semibold font-mono">{s.count}</span>
                  </div>
                  <Bars ratio={s.count / rfqMax} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHead title="Order lifecycle" sub="Active pipeline" icon={ShoppingCart} action={<Link href="/orders" className="text-xs text-primary hover:underline font-medium">View</Link>} />
            <div className="space-y-3 pt-5">
              {exec.orderLifecycle.map((s) => (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.stage}</span>
                    <span className="font-semibold font-mono">{s.count}</span>
                  </div>
                  <Bars ratio={s.count / lifeMax} />
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Tables bento */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel className="overflow-hidden">
            <PanelHead title="Top categories" icon={Tag} />
            <div className="p-5 space-y-3.5">
              {exec.topCategories.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs font-mono">{formatCurrency(c.gmv, "AED")}</span>
                  </div>
                  <Bars ratio={c.share / catMax} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHead title="Top suppliers" icon={Store} action={<Link href="/sellers" className="text-xs text-primary hover:underline font-medium">All</Link>} />
            <div className="divide-y divide-border">
              {exec.topSuppliers.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid place-items-center h-6 w-6 rounded-lg bg-secondary text-xs font-bold text-muted-foreground shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-current" /> {s.rating} · {s.orders} orders
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold font-mono shrink-0">{formatCurrency(s.gmv, "AED")}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHead title="Top customers" icon={Users} action={<Link href="/crm" className="text-xs text-primary hover:underline font-medium">CRM</Link>} />
            <div className="divide-y divide-border">
              {topCustomers.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.totalOrders} orders</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-sm font-semibold font-mono">{formatCurrency(c.totalSpent, "AED")}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${c.type === "B2B" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}>{c.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}
