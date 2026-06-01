import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { CreditCard, TrendingUp, Percent, Info } from "lucide-react";

export const metadata = { title: "Commission" };

const RATE_TIERS = [
  { tier: "STANDARD", label: "Standard", range: "Default rate", rate: "6.0%" },
  { tier: "VERIFIED", label: "Verified", range: "Verified suppliers", rate: "5.5%" },
  { tier: "GOLD", label: "Gold", range: "Gold-tier suppliers", rate: "5.0%" },
  { tier: "PLATINUM", label: "Platinum", range: "Platinum suppliers", rate: "3.5%" },
];

export default async function CommissionPage() {
  const { seller } = await requireSellerSession();
  const defaultRate = Number(seller.commissionRate);

  const commissions = await db.commission.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
  });

  // Group by month
  const byMonth = new Map<string, { ts: number; commission: number; gross: number; settled: boolean }>();
  for (const c of commissions) {
    const key = c.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const amt = Number(c.amount);
    const r = Number(c.rate) || defaultRate;
    const gross = r > 0 ? (amt / r) * 100 : 0;
    const cur = byMonth.get(key) ?? { ts: c.createdAt.getTime(), commission: 0, gross: 0, settled: true };
    cur.commission += amt;
    cur.gross += gross;
    if (!c.settledAt) cur.settled = false;
    byMonth.set(key, cur);
  }
  const history = [...byMonth.entries()]
    .map(([period, v]) => ({ period, ...v, net: v.gross - v.commission, status: v.settled ? "PAID" : "CURRENT" }))
    .sort((a, b) => b.ts - a.ts);

  const yr = new Date().getFullYear();
  const ytd = commissions.filter((c) => c.createdAt.getFullYear() === yr);
  const ytdCommission = ytd.reduce((s, c) => s + Number(c.amount), 0);
  const ytdGross = ytd.reduce((s, c) => { const r = Number(c.rate) || defaultRate; return s + (r > 0 ? (Number(c.amount) / r) * 100 : 0); }, 0);
  const ytdNet = ytdGross - ytdCommission;

  const stats = [
    { label: "Your commission rate", value: `${defaultRate.toFixed(1)}%`, color: "text-primary", bg: "bg-primary/5 border-primary/20", icon: Percent },
    { label: "Commission paid (YTD)", value: formatCurrency(ytdCommission, "AED"), color: "text-danger", bg: "bg-card border-border", icon: CreditCard },
    { label: "Net earnings (YTD)", value: formatCurrency(ytdNet, "AED"), color: "text-success", bg: "bg-success/5 border-success/20", icon: TrendingUp },
    { label: "Tier", value: seller.tier, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5 border-amber-500/20", icon: TrendingUp },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commission</h1>
          <p className="text-sm text-muted-foreground">Your marketplace commission structure and history</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rate tiers */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Commission rate tiers</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {RATE_TIERS.map((t) => {
              const active = t.tier === seller.tier;
              return (
                <div key={t.tier} className={`rounded-xl border p-3 ${active ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm">{t.label}</p>
                    {active && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold uppercase">You</span>}
                  </div>
                  <p className="text-lg font-bold text-primary">{t.rate}</p>
                  <p className="text-xs text-muted-foreground">{t.range}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3 text-sm text-primary">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Maintain a performance score above 85 and AED 100k+ monthly GMV to qualify for reduced volume rates.</p>
          </div>
        </div>

        {/* History */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">Commission history</h2></div>
          {history.length === 0 ? (
            <div className="p-10 text-center">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No commission yet</p>
              <p className="text-sm text-muted-foreground mt-1">Commission is recorded as your orders are fulfilled.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>{["Period", "Gross sales", "Commission", "Net payout", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((c) => (
                    <tr key={c.period} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.period}</td>
                      <td className="px-4 py-3 font-mono">{formatCurrency(c.gross, "AED")}</td>
                      <td className="px-4 py-3 text-danger font-medium font-mono">−{formatCurrency(c.commission, "AED")}</td>
                      <td className="px-4 py-3 font-bold font-mono text-success">{formatCurrency(c.net, "AED")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.status === "PAID" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>{c.status === "PAID" ? "Settled" : "Current"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
