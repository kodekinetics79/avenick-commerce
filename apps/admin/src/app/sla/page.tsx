import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_SLA_METRICS } from "@avenick/database";
import { Gauge, ArrowLeft, Clock, Zap, AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "SLA Monitor" };

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   "bg-red-500/10 text-red-700 dark:text-red-400",
  MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  LOW:    "bg-primary/10 text-primary",
};

function complianceColor(pct: number): string {
  return pct >= 90 ? "bg-green-500" : pct >= 80 ? "bg-amber-500" : "bg-red-500";
}
function complianceText(pct: number): string {
  return pct >= 90 ? "text-green-600" : pct >= 80 ? "text-amber-600" : "text-red-600";
}

export default async function SLAPage() {
  await requireAdminSession();
  const m = MOCK_SLA_METRICS;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Support
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">SLA Monitor</span>
            </div>
            <h1 className="text-2xl font-bold">SLA Monitor</h1>
            <p className="text-sm text-muted-foreground">Service-level performance and breach tracking</p>
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4">
            <Zap className="h-4 w-4 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{m.avgFirstResponse}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg First Response</p>
            <p className="text-xs text-green-600 mt-1">Target: {m.firstResponseTarget} ✓</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4">
            <Clock className="h-4 w-4 text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{m.avgResolution}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Avg Resolution</p>
            <p className="text-xs text-green-600 mt-1">Target: {m.resolutionTarget} ✓</p>
          </div>
          <div className={`rounded-2xl border p-4 ${m.complianceRate >= 90 ? "bg-green-500/10 border-green-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
            <Gauge className={`h-4 w-4 mb-2 ${complianceText(m.complianceRate)}`} />
            <p className={`text-2xl font-bold ${complianceText(m.complianceRate)}`}>{m.complianceRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">SLA Compliance</p>
          </div>
          <div className={`rounded-2xl border p-4 ${m.breachesThisWeek > 0 ? "bg-red-500/10 border-red-500/20" : "bg-card border-border"}`}>
            <AlertTriangle className={`h-4 w-4 mb-2 ${m.breachesThisWeek > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${m.breachesThisWeek > 0 ? "text-red-600" : "text-foreground"}`}>{m.breachesThisWeek}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Breaches This Week</p>
          </div>
        </div>

        {/* Compliance gauge */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Overall SLA Health</h2>
            <span className="text-sm text-muted-foreground">{m.ticketsInSla} in SLA · {m.ticketsBreached} breached</span>
          </div>
          <div className="flex gap-0.5 h-4 mb-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`flex-1 rounded-full ${i < Math.round(m.complianceRate / 5) ? complianceColor(m.complianceRate) : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{m.complianceRate}% of tickets resolved within SLA</span>
            <span>{100 - m.complianceRate}% breached</span>
          </div>
        </div>

        {/* By type */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Performance by Ticket Type</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  {["Type","Volume","Target","Avg Resolution","Compliance",""].map(h => (
                    <th key={h} className="px-5 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {m.byType.map((row) => (
                  <tr key={row.type} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{row.type}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.volume}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.target}</td>
                    <td className="px-5 py-3">
                      <span className={row.compliance < 80 ? "text-red-600 font-medium" : "text-muted-foreground"}>{row.avgResolution}</span>
                    </td>
                    <td className="px-5 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5 w-20 h-1.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className={`flex-1 rounded-full ${i < Math.round(row.compliance / 10) ? complianceColor(row.compliance) : "bg-muted"}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-bold ${complianceText(row.compliance)}`}>{row.compliance}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {row.compliance < 80 && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Below target</span>}
                      {row.compliance >= 90 && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Excellent</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent breaches */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold">Recent SLA Breaches</h2>
            <span className="ms-auto text-xs bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">{m.breaches.length} this week</span>
          </div>
          <div className="divide-y divide-border">
            {m.breaches.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Link href={`/support/${b.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{b.id}</Link>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_COLOR[b.severity]}`}>{b.severity}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{b.type}</span>
                  </div>
                  <p className="text-sm font-medium">{b.buyer}</p>
                  <p className="text-xs text-muted-foreground">Agent: {b.agent}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-bold text-red-600">+{b.breachedBy} over</p>
                  <Link href={`/support/${b.id}`} className="text-xs text-primary hover:underline font-medium">Resolve now →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
