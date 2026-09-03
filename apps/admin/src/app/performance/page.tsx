import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSupplierPerformance } from "@avenick/database";
import { TrendingUp, Star, RotateCcw, Award, AlertTriangle, Store } from "lucide-react";

export const metadata = { title: "Supplier Performance" };
export const dynamic = "force-dynamic";

const scoreColor = (s: number) => (s >= 85 ? "text-green-600" : s >= 70 ? "text-amber-600" : "text-red-600");
const barColor = (s: number) => (s >= 85 ? "bg-green-500" : s >= 70 ? "bg-amber-500" : "bg-red-500");

// GMV is SUM(order total) as recorded in each order's own currency; nothing is
// converted, so no currency symbol is attached to the figure.
const amount = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });

const TIER_COLORS: Record<string, string> = {
  PLATINUM: "bg-purple-100 text-purple-700",
  GOLD: "bg-yellow-100 text-yellow-700",
  VERIFIED: "bg-blue-100 text-primary",
  STANDARD: "bg-gray-100 text-gray-600",
};

export default async function PerformancePage() {
  await requireAdminSession();

  const suppliers = await getSupplierPerformance();
  const avg = suppliers.length > 0 ? Math.round(suppliers.reduce((s, x) => s + x.score, 0) / suppliers.length) : 0;
  const atRisk = suppliers.filter((s) => s.score < 70).length;
  const withOnTime = suppliers.filter((s) => s.onTimePct !== null);
  const avgOnTime = withOnTime.length > 0 ? Math.round(withOnTime.reduce((s, x) => s + (x.onTimePct ?? 0), 0) / withOnTime.length) : null;
  const avgReturn = suppliers.length > 0 ? Math.round((suppliers.reduce((s, x) => s + x.returnRate, 0) / suppliers.length) * 10) / 10 : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Performance</h1>
          <p className="text-sm text-muted-foreground">
            Scorecards computed from live orders, shipments, returns, reviews, and listing health (weights: health 40 · on-time 30 · rating 20 · returns 10).
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Avg supplier score", value: suppliers.length > 0 ? `${avg}/100` : "—", color: suppliers.length > 0 ? scoreColor(avg) : "text-muted-foreground", bg: "bg-white border-border", icon: Award },
            { label: "Avg on-time delivery", value: avgOnTime !== null ? `${avgOnTime}%` : "—", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: TrendingUp },
            { label: "Avg return rate", value: `${avgReturn}%`, color: "text-primary", bg: "bg-blue-50 border-blue-200", icon: RotateCcw },
            { label: "Suppliers at risk", value: atRisk, color: atRisk > 0 ? "text-red-600" : "text-muted-foreground", bg: atRisk > 0 ? "bg-red-50 border-red-200" : "bg-white border-border", icon: AlertTriangle },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {atRisk > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{atRisk} supplier{atRisk === 1 ? "" : "s"}</span> scoring below 70 — review listing health, delivery reliability, and return rates.
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Supplier", "Tier", "Score", "GMV (as recorded)", "Orders", "On-time", "Return rate", "Listing health", "Rating"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Store className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No active suppliers yet.</p>
                    </td>
                  </tr>
                )}
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${TIER_COLORS[s.tier] ?? "bg-slate-100 text-muted-foreground"}`}>
                        {s.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[8rem]">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor(s.score)}`} style={{ width: `${s.score}%` }} />
                        </div>
                        <span className={`text-sm font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{amount(s.gmv)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.orders}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.onTimePct !== null ? `${s.onTimePct}%` : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.returnRate}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.health !== null ? `${s.health}/100` : "—"}</td>
                    <td className="px-4 py-3">
                      {s.rating !== null ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> {s.rating}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
