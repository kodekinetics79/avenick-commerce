import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { TrendingUp, Wallet, Building2, ArrowUpRight, Download } from "lucide-react";

export const metadata = { title: "Spend Analytics — Avenick for Business" };

const DEPARTMENTS = [
  { name: "Operations", spend: 142000, budget: 160000 },
  { name: "Medical", spend: 88500, budget: 90000 },
  { name: "Facilities", spend: 41200, budget: 60000 },
  { name: "HR", spend: 22750, budget: 40000 },
  { name: "Admin", spend: 9680, budget: 20000 },
];

const CATEGORIES = [
  { name: "Safety & PPE", share: 38 },
  { name: "Industrial supplies", share: 27 },
  { name: "Medical", share: 19 },
  { name: "Office & facilities", share: 11 },
  { name: "Other", share: 5 },
];

const MONTHLY = [
  { m: "Dec", v: 210 }, { m: "Jan", v: 248 }, { m: "Feb", v: 232 },
  { m: "Mar", v: 276 }, { m: "Apr", v: 298 }, { m: "May", v: 304 },
];

export default function SpendAnalyticsPage() {
  const totalSpend = DEPARTMENTS.reduce((s, d) => s + d.spend, 0);
  const totalBudget = DEPARTMENTS.reduce((s, d) => s + d.budget, 0);
  const budgetPct = Math.round((totalSpend / totalBudget) * 100);
  const monthMax = Math.max(...MONTHLY.map((m) => m.v));

  const kpis = [
    { label: "Spend this month", value: formatCurrency(304000, "AED"), icon: TrendingUp, trend: "+2.1%" },
    { label: "Quarter to date", value: formatCurrency(878000, "AED"), icon: Wallet, trend: "+11%" },
    { label: "Budget utilization", value: `${budgetPct}%`, icon: Building2, trend: "on track" },
  ];

  return (
    <B2BShell
      title="Spend Analytics"
      description="Track spend against budget by department, category and period."
      actions={
        <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border bg-card text-sm font-semibold hover:bg-secondary transition-colors">
          <Download className="h-4 w-4" /> Export
        </button>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><k.icon className="h-4 w-4" /></span>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-success"><ArrowUpRight className="h-3.5 w-3.5" />{k.trend}</span>
            </div>
            <p className="mt-4 text-2xl font-bold font-mono tracking-tight">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Spend vs budget by department */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Spend vs budget · by department</p>
          <div className="space-y-4">
            {DEPARTMENTS.map((d) => {
              const pct = Math.round((d.spend / d.budget) * 100);
              const over = pct >= 95;
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium">{d.name}</span>
                    <span className="font-mono text-muted-foreground">{formatCurrency(d.spend, "AED")} / {formatCurrency(d.budget, "AED")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full ${over ? "bg-danger" : "bg-gradient-to-r from-primary-500 to-accent-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category mix */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Spend by category</p>
          <div className="space-y-4">
            {CATEGORIES.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium">{c.name}</span>
                  <span className="font-mono text-muted-foreground">{c.share}%</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${c.share * 2.6}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-4">Monthly spend trend</p>
        <div className="flex items-end justify-between gap-3 h-40">
          {MONTHLY.map((m) => (
            <div key={m.m} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                <div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-primary-600 to-accent-500" style={{ height: `${(m.v / monthMax) * 100}%` }} title={`AED ${m.v}k`} />
              </div>
              <span className="text-xs text-muted-foreground">{m.m}</span>
            </div>
          ))}
        </div>
      </div>
    </B2BShell>
  );
}
