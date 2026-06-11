import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_CAMPAIGNS } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Megaphone, Mail, MessageSquare, Send, TrendingUp, Plus, ArrowLeft, Play, Pause, CheckCircle } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Campaigns" };

const CHANNEL_CONFIG: Record<string, { icon: typeof Mail; color: string }> = {
  EMAIL:    { icon: Mail,          color: "bg-primary/10 text-primary" },
  SMS:      { icon: MessageSquare, color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  WHATSAPP: { icon: Send,          color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Play }> = {
  ACTIVE:    { label: "Active",    color: "bg-green-500/10 text-green-700 dark:text-green-400",  icon: Play },
  SCHEDULED: { label: "Scheduled", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400",  icon: Pause },
  COMPLETED: { label: "Completed", color: "bg-muted text-muted-foreground",  icon: CheckCircle },
};

const TABS = ["All", "Active", "Scheduled", "Completed"] as const;

export default async function CampaignsPage() {
  await requireAdminSession();

  const active = MOCK_CAMPAIGNS.filter(c => c.status === "ACTIVE");
  const totalRevenue = MOCK_CAMPAIGNS.reduce((s, c) => s + c.revenue, 0);
  const totalConverted = MOCK_CAMPAIGNS.reduce((s, c) => s + c.converted, 0);
  const totalSent = MOCK_CAMPAIGNS.reduce((s, c) => s + c.sent, 0);
  const avgOpenRate = totalSent > 0
    ? Math.round((MOCK_CAMPAIGNS.reduce((s, c) => s + c.opened, 0) / totalSent) * 100)
    : 0;

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
              <span className="text-sm font-medium">Campaigns</span>
            </div>
            <h1 className="text-2xl font-bold">Campaign Manager</h1>
            <p className="text-sm text-muted-foreground">{active.length} active · multi-channel marketing campaigns</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Campaigns", value: active.length, color: "text-green-600", bg: "bg-green-500/10 border-green-500/20" },
            { label: "Total Sent", value: totalSent.toLocaleString(), color: "text-primary", bg: "bg-primary/10 border-primary/20" },
            { label: "Avg Open Rate", value: `${avgOpenRate}%`, color: "text-purple-600", bg: "bg-purple-500/10 border-purple-500/20" },
            { label: "Attributed Revenue", value: formatCurrency(totalRevenue, "AED"), color: "text-green-700", bg: "bg-card border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} type="button"
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "All" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Campaign cards */}
        <div className="space-y-3">
          {MOCK_CAMPAIGNS.map((c) => {
            const cc = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.EMAIL;
            const ChannelIcon = cc.icon;
            const sc = STATUS_CONFIG[c.status];
            const StatusIcon = sc.icon;
            const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
            const clickRate = c.opened > 0 ? Math.round((c.clicked / c.opened) * 100) : 0;
            const convRate = c.clicked > 0 ? Math.round((c.converted / c.clicked) * 100) : 0;

            return (
              <div key={c.id} className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cc.color}`}>
                      <ChannelIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold">{c.name}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.audience} · {c.channel} · {c.startDate} → {c.endDate}</p>
                    </div>
                  </div>
                  {c.revenue > 0 && (
                    <div className="text-end shrink-0">
                      <p className="font-bold text-green-700">{formatCurrency(c.revenue, "AED")}</p>
                      <p className="text-xs text-muted-foreground">revenue</p>
                    </div>
                  )}
                </div>

                {/* Funnel metrics */}
                {c.status !== "SCHEDULED" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Sent", value: c.sent.toLocaleString(), sub: "" },
                      { label: "Opened", value: c.opened.toLocaleString(), sub: `${openRate}% rate` },
                      { label: "Clicked", value: c.clicked.toLocaleString(), sub: `${clickRate}% CTR` },
                      { label: "Converted", value: c.converted.toLocaleString(), sub: `${convRate}% conv` },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="bg-muted rounded-xl p-3">
                        <p className="text-lg font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        {sub && <p className="text-xs text-green-600 font-medium">{sub}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
                    <p className="text-sm text-amber-700">Scheduled to launch on <strong>{c.startDate}</strong></p>
                    <div className="flex gap-2">
                      <button type="button" className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 font-medium transition-colors">Launch Now</button>
                      <button type="button" className="text-xs border border-border text-muted-foreground px-3 py-1 rounded-lg hover:bg-muted/30 font-medium transition-colors">Edit</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
