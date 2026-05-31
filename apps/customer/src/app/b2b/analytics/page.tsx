import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";
import { db } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { TrendingUp, Wallet, Clock, Building2, BarChart3 } from "lucide-react";

export const metadata = { title: "Spend Analytics — Avenick for Business" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function SpendAnalyticsPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Spend Analytics">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to view spend.</p>
        </div>
      </B2BShell>
    );
  }

  const [pos, members] = await Promise.all([
    db.purchaseOrder.findMany({ where: { companyId: ctx.companyId }, select: { total: true, status: true, requesterId: true, createdAt: true } }),
    db.companyMember.findMany({ where: { companyId: ctx.companyId }, select: { userId: true, department: true } }),
  ]);
  const deptOf = new Map(members.map((m) => [m.userId, m.department ?? "Unassigned"]));

  const committed = pos.filter((p) => p.status === "ORDERED" || p.status === "APPROVED");
  const totalSpend = committed.reduce((s, p) => s + Number(p.total), 0);
  const pendingValue = pos.filter((p) => p.status === "PENDING_APPROVAL").reduce((s, p) => s + Number(p.total), 0);

  const now = new Date();
  const monthSpend = committed.filter((p) => p.createdAt.getMonth() === now.getMonth() && p.createdAt.getFullYear() === now.getFullYear()).reduce((s, p) => s + Number(p.total), 0);

  // Spend by department
  const byDept = new Map<string, number>();
  for (const p of committed) {
    const d = deptOf.get(p.requesterId) ?? "Unassigned";
    byDept.set(d, (byDept.get(d) ?? 0) + Number(p.total));
  }
  const deptRows = [...byDept.entries()].map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend);
  const deptMax = Math.max(1, ...deptRows.map((d) => d.spend));

  // Monthly trend (last 6 months)
  const trend: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = committed.filter((p) => p.createdAt.getMonth() === d.getMonth() && p.createdAt.getFullYear() === d.getFullYear()).reduce((s, p) => s + Number(p.total), 0);
    trend.push({ label: MONTHS[d.getMonth()]!, value: v });
  }
  const trendMax = Math.max(1, ...trend.map((t) => t.value));

  const kpis = [
    { label: "Committed spend", value: formatCurrency(totalSpend, "AED"), icon: Wallet },
    { label: "This month", value: formatCurrency(monthSpend, "AED"), icon: TrendingUp },
    { label: "Awaiting approval", value: formatCurrency(pendingValue, "AED"), icon: Clock },
  ];

  const empty = committed.length === 0;

  return (
    <B2BShell title="Spend Analytics" description={`Approved & ordered purchasing across ${ctx.company.nameEn}.`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><k.icon className="h-4 w-4" /></span>
            <p className="mt-4 text-2xl font-bold font-mono tracking-tight">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {empty ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No committed spend yet</p>
          <p className="text-sm text-muted-foreground mt-1">Approve and place purchase orders to see analytics here.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* By department */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-4">Spend by department</p>
            <div className="space-y-4">
              {deptRows.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium">{d.name}</span>
                    <span className="font-mono text-muted-foreground">{formatCurrency(d.spend, "AED")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${(d.spend / deptMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold mb-4">Monthly spend trend</p>
            <div className="flex items-end justify-between gap-3 h-40">
              {trend.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                    <div className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-primary-600 to-accent-500" style={{ height: `${Math.max(4, (m.value / trendMax) * 100)}%` }} title={formatCurrency(m.value, "AED")} />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </B2BShell>
  );
}
