import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@avenick/utils";
import { CreditCard, TrendingUp, Percent, Info } from "lucide-react";

export const metadata = { title: "Commission" };

const COMMISSION_HISTORY = [
  { id: "c1", period: "Nov 2024", grossSales: 48200, rate: 5.0, commission: 2410, handling: 320, net: 45470, status: "CURRENT" },
  { id: "c2", period: "Oct 2024", grossSales: 52100, rate: 5.0, commission: 2605, handling: 340, net: 49155, status: "PAID" },
  { id: "c3", period: "Sep 2024", grossSales: 41800, rate: 5.0, commission: 2090, handling: 280, net: 39430, status: "PAID" },
  { id: "c4", period: "Aug 2024", grossSales: 38900, rate: 5.5, commission: 2140, handling: 260, net: 36500, status: "PAID" },
];

const RATE_TIERS = [
  { tier: "Standard", range: "Default rate", rate: "6.0%", active: false },
  { tier: "Verified", range: "Verified suppliers", rate: "5.5%", active: false },
  { tier: "Gold", range: "Gold-tier suppliers", rate: "5.0%", active: true },
  { tier: "Volume", range: "Orders > AED 50k", rate: "3.5%", active: false },
];

export default async function CommissionPage() {
  const { seller } = await requireSellerSession();
  const ytdCommission = COMMISSION_HISTORY.reduce((s, c) => s + c.commission, 0);
  const ytdNet = COMMISSION_HISTORY.reduce((s, c) => s + c.net, 0);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commission</h1>
          <p className="text-sm text-muted-foreground">Your marketplace commission structure and history</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Your Commission Rate", value: "5.0%", color: "text-primary", bg: "bg-primary/5 border-primary/20", icon: Percent },
            { label: "Commission Paid (YTD)", value: formatCurrency(ytdCommission, "AED"), color: "text-red-600", bg: "bg-white border-border", icon: CreditCard },
            { label: "Net Earnings (YTD)", value: formatCurrency(ytdNet, "AED"), color: "text-green-700", bg: "bg-green-50 border-green-200", icon: TrendingUp },
            { label: "Tier", value: "GOLD", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: TrendingUp },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rate tiers */}
        <div className="bg-white rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Commission Rate Tiers</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {RATE_TIERS.map((t) => (
              <div key={t.tier} className={`rounded-xl border p-3 ${t.active ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{t.tier}</p>
                  {t.active && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold uppercase">You</span>}
                </div>
                <p className="text-lg font-bold text-primary">{t.rate}</p>
                <p className="text-xs text-muted-foreground">{t.range}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Maintain a performance score above 85 and AED 100k+ monthly GMV to qualify for reduced volume rates.</p>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">Commission History</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>{["Period", "Gross Sales", "Rate", "Commission", "Handling", "Net Payout", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {COMMISSION_HISTORY.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.period}</td>
                    <td className="px-4 py-3">{formatCurrency(c.grossSales, "AED")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.rate}%</td>
                    <td className="px-4 py-3 text-red-600 font-medium">−{formatCurrency(c.commission, "AED")}</td>
                    <td className="px-4 py-3 text-red-600">−{formatCurrency(c.handling, "AED")}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(c.net, "AED")}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.status === "PAID" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{c.status === "PAID" ? "Paid" : "Current"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
