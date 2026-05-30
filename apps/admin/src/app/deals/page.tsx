import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Percent, Plus, Calendar, Tag, TrendingUp, CheckCircle, Clock } from "lucide-react";

export const metadata = { title: "Deals & Promotions" };

const DEALS = [
  { id: "d1", name: "Q4 Safety Equipment Sale", scope: "Safety & PPE category", discount: "Up to 25% off", type: "CATEGORY", status: "ACTIVE", redemptions: 412, revenue: 142000, ends: "Dec 31, 2024" },
  { id: "d2", name: "Bulk Order Bonus", scope: "Orders over 500 units", discount: "Extra 8% off", type: "VOLUME", status: "ACTIVE", redemptions: 64, revenue: 89000, ends: "Ongoing" },
  { id: "d3", name: "New Customer Welcome", scope: "First B2C order", discount: "AED 50 off", type: "WELCOME", status: "ACTIVE", redemptions: 218, revenue: 31000, ends: "Ongoing" },
  { id: "d4", name: "Black Friday Industrial", scope: "All categories", discount: "Up to 40% off", type: "SITEWIDE", status: "ENDED", redemptions: 1240, revenue: 412000, ends: "Nov 29, 2024" },
  { id: "d5", name: "Ramadan B2B Promo", scope: "All B2B companies", discount: "12% off + Net 60", type: "CATEGORY", status: "SCHEDULED", redemptions: 0, revenue: 0, ends: "Mar 20, 2025" },
];

const STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  ACTIVE:    { label: "Active",    color: "bg-green-100 text-green-700", icon: CheckCircle },
  SCHEDULED: { label: "Scheduled", color: "bg-amber-100 text-amber-700", icon: Clock },
  ENDED:     { label: "Ended",     color: "bg-slate-100 text-slate-500", icon: Clock },
};

export default async function DealsPage() {
  await requireAdminSession();
  const active = DEALS.filter((d) => d.status === "ACTIVE");
  const totalRevenue = DEALS.reduce((s, d) => s + d.revenue, 0);
  const totalRedemptions = DEALS.reduce((s, d) => s + d.redemptions, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deals &amp; Promotions</h1>
            <p className="text-sm text-muted-foreground">{active.length} active promotions driving marketplace sales</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Create Promotion
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Promotions", value: active.length, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Total Redemptions", value: totalRedemptions.toLocaleString(), color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: "Promo Revenue", value: `AED ${(totalRevenue / 1000).toFixed(0)}k`, color: "text-green-700", bg: "bg-white border-border" },
            { label: "Avg Order Uplift", value: "+18%", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {DEALS.map((d) => {
            const sc = STATUS[d.status] ?? STATUS.ENDED;
            const StatusIcon = sc.icon;
            return (
              <div key={d.id} className="bg-card rounded-2xl border border-border shadow-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Percent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold">{d.name}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {d.scope}</span>
                        <span className="font-medium text-primary">{d.discount}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {d.ends}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    {d.revenue > 0 && <p className="font-bold text-green-700">AED {(d.revenue / 1000).toFixed(0)}k</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                      <TrendingUp className="h-3 w-3" /> {d.redemptions} redemptions
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
