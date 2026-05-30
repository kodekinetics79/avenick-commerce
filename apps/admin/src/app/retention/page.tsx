import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_RETENTION_RISKS, MOCK_LIFECYCLE_STAGES } from "@manzil/database";
import { formatCurrency } from "@manzil/utils";
import { Heart, ArrowLeft, AlertTriangle, TrendingDown, Phone, Mail, Gift, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Retention" };

const RISK_CONFIG: Record<string, { label: string; color: string; border: string; dot: string }> = {
  HIGH:   { label: "High Risk",   color: "bg-red-100 text-red-700",     border: "border-red-200",   dot: "bg-red-500" },
  MEDIUM: { label: "Medium Risk", color: "bg-amber-100 text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  LOW:    { label: "Low Risk",    color: "bg-blue-100 text-blue-700",   border: "border-blue-200",  dot: "bg-blue-500" },
};

const STAGE_COLORS: Record<string, string> = {
  slate: "text-slate-600 bg-slate-100", blue: "text-blue-600 bg-blue-100", green: "text-green-600 bg-green-100",
  amber: "text-amber-600 bg-amber-100", red: "text-red-600 bg-red-100",
};

export default async function RetentionPage() {
  await requireAdminSession();

  const highRisk = MOCK_RETENTION_RISKS.filter(r => r.risk === "HIGH");
  const atRiskValue = MOCK_RETENTION_RISKS.reduce((s, r) => s + r.lifetimeValue, 0);
  const churnedCount = MOCK_LIFECYCLE_STAGES.find(s => s.stage === "Churned")?.count ?? 0;
  const activeCount = MOCK_LIFECYCLE_STAGES.find(s => s.stage === "Active Customers")?.count ?? 0;
  const retentionRate = activeCount > 0 ? Math.round((activeCount / (activeCount + churnedCount)) * 100) : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/crm" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> CRM
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Retention</span>
            </div>
            <h1 className="text-2xl font-bold">Retention Dashboard</h1>
            <p className="text-sm text-muted-foreground">Churn risk monitoring and win-back actions</p>
          </div>
          <Link href="/campaigns" className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Gift className="h-3.5 w-3.5" /> Launch Win-Back
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Retention Rate", value: `${retentionRate}%`, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "High-Risk Accounts", value: highRisk.length, color: "text-red-600", bg: "bg-red-50 border-red-200" },
            { label: "At-Risk Value", value: formatCurrency(atRiskValue, "AED"), color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Churned (90d)", value: churnedCount, color: "text-slate-600", bg: "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* High risk alert */}
        {highRisk.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">{highRisk.length} high-value accounts at risk of churning</p>
                <p className="text-xs text-red-600">{formatCurrency(highRisk.reduce((s, r) => s + r.lifetimeValue, 0), "AED")} lifetime value at stake — act this week</p>
              </div>
            </div>
            <Link href="/campaigns" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium transition-colors whitespace-nowrap">Win-Back Campaign →</Link>
          </div>
        )}

        {/* Lifecycle funnel */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wide">Customer Lifecycle</h2>
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {MOCK_LIFECYCLE_STAGES.map((stage, i, arr) => (
              <div key={stage.stage} className="flex items-center shrink-0">
                <div className={`flex flex-col items-center rounded-xl px-5 py-3 min-w-[110px] text-center ${STAGE_COLORS[stage.color]}`}>
                  <p className="text-2xl font-bold">{stage.count.toLocaleString()}</p>
                  <p className="text-xs font-medium mt-0.5">{stage.stage}</p>
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-slate-300 mx-1 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Risk list */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold">Churn Risk Accounts</h2>
            <span className="ms-auto text-xs text-muted-foreground">Prioritized by risk &amp; value</span>
          </div>
          <div className="divide-y divide-border">
            {MOCK_RETENTION_RISKS.map((r) => {
              const rc = RISK_CONFIG[r.risk];
              return (
                <div key={r.id} className={`px-5 py-4 border-l-4 ${r.risk === "HIGH" ? "border-l-red-400" : r.risk === "MEDIUM" ? "border-l-amber-400" : "border-l-blue-400"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-sm">{r.account}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${rc.color}`}>{rc.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${r.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{r.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1.5">{r.reason}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {r.daysSinceOrder} days since last order</span>
                        <span className="text-muted-foreground">Owner: {r.owner}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                        <Gift className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <p className="text-xs font-medium text-slate-700">Recommended: {r.action}</p>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="font-bold text-green-700">{formatCurrency(r.lifetimeValue, "AED")}</p>
                      <p className="text-xs text-muted-foreground mb-2">lifetime value</p>
                      <div className="flex flex-col gap-1.5">
                        <button type="button" className="flex items-center gap-1 text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 font-medium transition-colors justify-center">
                          <Phone className="h-3 w-3" /> Call
                        </button>
                        <button type="button" className="flex items-center gap-1 text-xs border border-border text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors justify-center">
                          <Mail className="h-3 w-3" /> Email
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
