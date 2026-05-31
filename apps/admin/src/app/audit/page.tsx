import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_AUDIT_LOGS } from "@avenick/database";
import { ScrollText, Search, Download, Shield, User, DollarSign, Package, Scale, Plug, Zap, LifeBuoy, Lock } from "lucide-react";

export const metadata = { title: "Audit Trail" };

const CATEGORY_CONFIG: Record<string, { color: string; icon: typeof Shield }> = {
  SELLER:      { color: "bg-orange-100 text-orange-700", icon: Package },
  PRICING:     { color: "bg-green-100 text-green-700",   icon: DollarSign },
  DISPUTE:     { color: "bg-purple-100 text-purple-700", icon: Scale },
  PRODUCT:     { color: "bg-cyan-100 text-cyan-700",     icon: Package },
  FINANCE:     { color: "bg-green-100 text-green-700",   icon: DollarSign },
  USER:        { color: "bg-blue-100 text-primary",     icon: User },
  SECURITY:    { color: "bg-red-100 text-red-700",       icon: Lock },
  INTEGRATION: { color: "bg-slate-100 text-muted-foreground",   icon: Plug },
  SUPPORT:     { color: "bg-amber-100 text-amber-700",   icon: LifeBuoy },
  AUTOMATION:  { color: "bg-indigo-100 text-indigo-700", icon: Zap },
};

const ACTION_COLOR: Record<string, string> = {
  APPROVED: "text-green-600", UPDATED: "text-primary", RESOLVED: "text-green-600",
  REJECTED: "text-red-600", PROCESSED: "text-green-600", SUSPENDED: "text-red-600",
  AUTO_FLAGGED: "text-amber-600", ESCALATED: "text-amber-600", CREATED: "text-purple-600",
};

const TABS = ["All", "Seller", "Pricing", "Finance", "User", "Security", "Support"] as const;

export default async function AuditPage() {
  await requireAdminSession();
  const logs = MOCK_AUDIT_LOGS;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Trail</h1>
            <p className="text-muted-foreground text-sm">Immutable log of all administrative and system actions</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 border border-border bg-white text-muted-foreground hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Download className="h-3.5 w-3.5" /> Export Log
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Events (24h)", value: logs.length, color: "text-foreground" },
            { label: "Admin Actions", value: logs.filter(l => l.role !== "SYSTEM").length, color: "text-primary" },
            { label: "System Events", value: logs.filter(l => l.role === "SYSTEM").length, color: "text-purple-600" },
            { label: "Security Flags", value: logs.filter(l => l.category === "SECURITY").length, color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-border p-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Search by actor, action, or target..."
              className="flex-1 text-sm text-muted-foreground placeholder:text-muted-foreground outline-none bg-transparent" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab} type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${tab === "All" ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400"}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Log table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Timestamp","Actor","Action","Target","Category","IP Address"].map(h => (
                    <th key={h} className="px-5 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const cc = CATEGORY_CONFIG[log.category] ?? { color: "bg-slate-100 text-muted-foreground", icon: ScrollText };
                  const CatIcon = cc.icon;
                  return (
                    <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${log.category === "SECURITY" ? "bg-red-50/30" : ""}`}>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{log.time}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-sm">{log.actor}</p>
                        <p className="text-xs text-muted-foreground">{log.role}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold ${ACTION_COLOR[log.action] ?? "text-muted-foreground"}`}>{log.action.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-5 py-3 text-sm max-w-[260px]">
                        <p className="line-clamp-2">{log.target}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cc.color}`}>
                          <CatIcon className="h-3 w-3" /> {log.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{log.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border bg-slate-50 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Audit logs are immutable and retained for 7 years per compliance policy</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
