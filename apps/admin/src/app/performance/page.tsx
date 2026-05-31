import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_EXECUTIVE } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { TrendingUp, Star, Clock, RotateCcw, Award, AlertTriangle } from "lucide-react";

export const metadata = { title: "Supplier Performance" };

const SUPPLIER_SCORES = [
  { name: "Gulf Industrial Supplies", tier: "GOLD", score: 92, onTime: 96, returnRate: 1.4, responseTime: "2.1h", trend: 3 },
  { name: "SafeGuard AE", tier: "GOLD", score: 89, onTime: 94, returnRate: 1.9, responseTime: "2.8h", trend: 1 },
  { name: "MediSafe Gulf", tier: "GOLD", score: 88, onTime: 93, returnRate: 2.0, responseTime: "3.0h", trend: 2 },
  { name: "FireShield LLC", tier: "VERIFIED", score: 81, onTime: 88, returnRate: 3.2, responseTime: "4.5h", trend: -2 },
  { name: "OfficeZone KW", tier: "VERIFIED", score: 76, onTime: 84, returnRate: 4.1, responseTime: "6.2h", trend: -4 },
];

const scoreColor = (s: number) => (s >= 85 ? "text-green-600" : s >= 70 ? "text-amber-600" : "text-red-600");
const barColor = (s: number) => (s >= 85 ? "bg-green-500" : s >= 70 ? "bg-amber-500" : "bg-red-500");

export default async function PerformancePage() {
  await requireAdminSession();
  const avg = Math.round(SUPPLIER_SCORES.reduce((s, x) => s + x.score, 0) / SUPPLIER_SCORES.length);
  const atRisk = SUPPLIER_SCORES.filter((s) => s.score < 80).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supplier Performance</h1>
          <p className="text-sm text-muted-foreground">Marketplace-wide supplier scorecards and SLA tracking</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Avg Supplier Score", value: `${avg}/100`, color: scoreColor(avg), bg: "bg-white border-border", icon: Award },
            { label: "Avg On-Time Delivery", value: "91%", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: TrendingUp },
            { label: "Avg Return Rate", value: "2.5%", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: RotateCcw },
            { label: "Suppliers At Risk", value: atRisk, color: atRisk > 0 ? "text-red-600" : "text-slate-500", bg: atRisk > 0 ? "bg-red-50 border-red-200" : "bg-white border-border", icon: AlertTriangle },
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
            <p className="font-semibold text-red-800 text-sm">{atRisk} supplier{atRisk !== 1 ? "s" : ""} below the 80-point performance threshold — review before it impacts marketplace NPS.</p>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">Supplier Scorecards</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>{["Supplier", "Tier", "Overall Score", "On-Time", "Return Rate", "Response", "Trend"].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SUPPLIER_SCORES.map((s) => (
                  <tr key={s.name} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.tier === "GOLD" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{s.tier}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5 w-16 h-1.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className={`flex-1 rounded-full ${i < Math.round(s.score / 10) ? barColor(s.score) : "bg-gray-200"}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-bold ${scoreColor(s.score)}`}>{s.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.onTime}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.returnRate}%</td>
                    <td className="px-4 py-3 flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {s.responseTime}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${s.trend >= 0 ? "text-green-600" : "text-red-600"}`}>
                        <TrendingUp className={`h-3 w-3 ${s.trend < 0 ? "rotate-180" : ""}`} /> {s.trend >= 0 ? "+" : ""}{s.trend}
                      </span>
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
