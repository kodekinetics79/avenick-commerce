import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_SYSTEM_HEALTH } from "@avenick/database";
import { Settings, Activity, CheckCircle, AlertTriangle, Globe, DollarSign, Bell, Shield, Server } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Settings" };

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  OPERATIONAL: { color: "text-green-600", dot: "bg-green-500", label: "Operational" },
  DEGRADED:    { color: "text-amber-600", dot: "bg-amber-500", label: "Degraded" },
  DOWN:        { color: "text-red-600",   dot: "bg-red-500",   label: "Down" },
};

const MARKETPLACE_SETTINGS = [
  { group: "General", icon: Globe, items: [
    { label: "Marketplace Name", value: "Avenick Commerce" },
    { label: "Default Currency", value: "AED (UAE Dirham)" },
    { label: "Supported Countries", value: "AE, SA, QA, KW, OM, BH" },
    { label: "Default Language", value: "English / العربية" },
  ]},
  { group: "Commerce", icon: DollarSign, items: [
    { label: "Default B2C Commission", value: "5.0%" },
    { label: "Default B2B Commission", value: "5.5%" },
    { label: "VAT Rate (UAE)", value: "5%" },
    { label: "VAT Rate (KSA)", value: "15%" },
    { label: "Free Shipping Threshold", value: "AED 200" },
  ]},
  { group: "Notifications", icon: Bell, items: [
    { label: "Order Confirmations", value: "Email + SMS" },
    { label: "Seller Payout Alerts", value: "Email" },
    { label: "Low Stock Alerts", value: "Dashboard + Email" },
    { label: "Dispute Notifications", value: "Email + WhatsApp" },
  ]},
  { group: "Security", icon: Shield, items: [
    { label: "Two-Factor Auth (Admin)", value: "Required" },
    { label: "Session Timeout", value: "30 minutes" },
    { label: "Password Policy", value: "Min 12 chars, complexity" },
    { label: "Audit Log Retention", value: "7 years" },
  ]},
];

export default async function SettingsPage() {
  await requireAdminSession();
  const h = MOCK_SYSTEM_HEALTH;
  const degraded = h.services.filter(s => s.status !== "OPERATIONAL").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Marketplace Settings</h1>
            <p className="text-muted-foreground text-sm">Platform configuration and system health</p>
          </div>
          <Link href="/audit" className="flex items-center gap-1.5 text-sm border border-border bg-white text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
            <Activity className="h-3.5 w-3.5" /> Audit Trail
          </Link>
        </div>

        {/* System health */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold">System Health</h2>
            </div>
            <div className="flex items-center gap-2">
              {degraded > 0
                ? <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> {degraded} service degraded</span>
                : <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle className="h-3.5 w-3.5" /> All systems operational</span>}
            </div>
          </div>

          {/* Health summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-border">
            {[
              { label: "Uptime (30d)", value: `${h.uptime}%`, color: "text-green-600" },
              { label: "Avg Response", value: `${h.avgResponseMs}ms`, color: "text-blue-600" },
              { label: "API Status", value: STATUS_CONFIG[h.apiStatus]?.label ?? h.apiStatus, color: STATUS_CONFIG[h.apiStatus]?.color ?? "" },
              { label: "Last Deploy", value: h.lastDeployment.split(" ")[0], color: "text-slate-800" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Services list */}
          <div className="divide-y divide-border">
            {h.services.map((svc) => {
              const sc = STATUS_CONFIG[svc.status] ?? STATUS_CONFIG.OPERATIONAL;
              return (
                <div key={svc.name} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${sc.dot} ${svc.status !== "OPERATIONAL" ? "animate-pulse" : ""}`} />
                    <p className="font-medium text-sm">{svc.name}</p>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <span className="text-muted-foreground">{svc.latency}</span>
                    <span className="text-muted-foreground w-16 text-end">{svc.uptime}% up</span>
                    <span className={`font-semibold w-24 text-end ${sc.color}`}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings groups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MARKETPLACE_SETTINGS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.group} className="bg-white rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-500" />
                    <h2 className="font-semibold">{group.group}</h2>
                  </div>
                  <button type="button" className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                </div>
                <div className="divide-y divide-border">
                  {group.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="bg-slate-50 border border-border rounded-2xl p-4 flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Changes to marketplace settings are logged in the <Link href="/audit" className="text-blue-600 hover:underline font-medium">audit trail</Link> and may require Super Admin approval.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
