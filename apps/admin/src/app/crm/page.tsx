import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_CRM_ACTIVITIES, MOCK_CRM_ACCOUNTS, MOCK_LIFECYCLE_STAGES } from "@avenick/database";
import { Users, AlertCircle, TrendingDown, Clock, Building2, User, Megaphone, PieChart, Heart, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "CRM Overview" };

const SMART_ALERTS = [
  { id: 1, severity: "HIGH",   icon: Clock,        message: "2 VIP B2B companies inactive for 30+ days", sub: "Kuwait Office Solutions, Doha Facilities", action: "View retention", href: "/retention" },
  { id: 2, severity: "MEDIUM", icon: TrendingDown, message: "High-value buyer opened quote but did not convert", sub: "Majid Al Futtaim · RFQ-2024-0041 · AED 98k potential", action: "Follow up", href: "/crm" },
  { id: 3, severity: "HIGH",   icon: AlertCircle,  message: "2 supplier delays affecting VIP buyers", sub: "May impact Gulf Industrial & Al Barsha orders", action: "Resolve", href: "/orders" },
  { id: 4, severity: "LOW",    icon: Users,        message: "214 new customers this month — onboarding opportunity", sub: "Send welcome series to drive first repeat order", action: "Launch campaign", href: "/campaigns" },
];

const SEVERITY_CONFIG: Record<string, { dot: string; badge: string; border: string }> = {
  HIGH:   { dot: "bg-red-500",   badge: "bg-red-100 text-red-700",     border: "border-l-red-400" },
  MEDIUM: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700", border: "border-l-amber-400" },
  LOW:    { dot: "bg-blue-500",  badge: "bg-blue-100 text-primary",   border: "border-l-blue-400" },
};

const STAGE_COLORS: Record<string, string> = {
  slate: "bg-slate-400", blue: "bg-blue-500", green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500",
};

const HEALTH_COLOR = (h: number) => h >= 75 ? "text-green-600" : h >= 50 ? "text-amber-600" : "text-red-600";
const HEALTH_BAR = (h: number) => h >= 75 ? "bg-green-500" : h >= 50 ? "bg-amber-500" : "bg-red-500";

export default async function CRMPage() {
  await requireAdminSession();

  const totalLifecycle = MOCK_LIFECYCLE_STAGES.reduce((s, l) => s + l.count, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">CRM &amp; Growth</h1>
            <p className="text-muted-foreground text-sm">Customer intelligence, retention, and pipeline</p>
          </div>
          <div className="flex gap-2">
            <Link href="/campaigns" className="flex items-center gap-1.5 text-sm border border-border bg-white text-muted-foreground hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
              <Megaphone className="h-3.5 w-3.5" /> Campaigns
            </Link>
            <Link href="/segments" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <PieChart className="h-3.5 w-3.5" /> Segments
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "B2C Customers", value: "4,821", trend: "+142 this month", icon: User, color: "text-primary" },
            { label: "B2B Companies", value: "287", trend: "+18 this month", icon: Building2, color: "text-purple-600" },
            { label: "Active This Week", value: "1,203", trend: "Unique sessions", icon: Users, color: "text-green-600" },
            { label: "At-Risk Accounts", value: "36", trend: "Needs attention", icon: Heart, color: "text-red-600" },
          ].map(({ label, value, trend, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-border p-4">
              <Icon className={`h-4 w-4 ${color} mb-2`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              <p className={`text-xs mt-1 ${trend.includes("+") ? "text-green-600" : "text-muted-foreground"}`}>{trend}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Smart alerts — main column */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold">Smart Alerts</h2>
              <span className="ms-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{SMART_ALERTS.length} insights</span>
            </div>
            <div className="divide-y divide-border">
              {SMART_ALERTS.map((alert) => {
                const Icon = alert.icon;
                const sc = SEVERITY_CONFIG[alert.severity];
                return (
                  <div key={alert.id} className={`flex items-center gap-3 px-5 py-3.5 border-l-4 ${sc.border}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${sc.badge}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">{alert.sub}</p>
                    </div>
                    <Link href={alert.href} className="text-xs text-primary hover:underline shrink-0 font-medium whitespace-nowrap">{alert.action} →</Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lifecycle pipeline */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Lifecycle Pipeline</h2>
              <p className="text-xs text-muted-foreground">{totalLifecycle.toLocaleString()} total accounts</p>
            </div>
            <div className="p-5 space-y-3">
              {MOCK_LIFECYCLE_STAGES.map((stage) => {
                const pct = Math.round((stage.count / totalLifecycle) * 100);
                return (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{stage.stage}</span>
                      <span className="text-muted-foreground text-xs">{stage.count.toLocaleString()} · {pct}%</span>
                    </div>
                    <div className="flex gap-0.5 h-2">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className={`flex-1 rounded-full ${i < Math.max(1, Math.round(pct / 5)) ? STAGE_COLORS[stage.color] : "bg-gray-100"}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top accounts */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Top Accounts</h2>
              <Link href="/segments" className="text-xs text-primary hover:underline font-medium">View segments →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    {["Account","Type","Orders","Lifetime Value","Health","Last Activity"].map(h => (
                      <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {MOCK_CRM_ACCOUNTS.slice(0, 6).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.contact}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-primary"}`}>{c.type}</span>
                      </td>
                      <td className="px-5 py-3 font-medium">{c.totalOrders}</td>
                      <td className="px-5 py-3 font-bold text-green-700">AED {c.totalSpent.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5 w-12 h-1.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className={`flex-1 rounded-full ${i < Math.round(c.health / 20) ? HEALTH_BAR(c.health) : "bg-gray-200"}`} />
                            ))}
                          </div>
                          <span className={`text-xs font-bold ${HEALTH_COLOR(c.health)}`}>{c.health}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{c.lastActivity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border">
              {MOCK_CRM_ACTIVITIES.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                    activity.type === "ORDER" ? "bg-green-500" :
                    activity.type === "RFQ" ? "bg-blue-500" :
                    activity.type === "REGISTRATION" ? "bg-purple-500" :
                    activity.type === "QUOTE_VIEW" ? "bg-amber-500" :
                    "bg-red-500"
                  }`}>
                    {activity.type.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{activity.customer}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{activity.detail}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border bg-slate-50">
              <Link href="/retention" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                View retention dashboard <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
