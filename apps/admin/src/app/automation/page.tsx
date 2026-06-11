import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Zap, Plus, CheckCircle, Pause, FileEdit, Play, Clock, User } from "lucide-react";

export const metadata = { title: "Automation Center" };

type RuleStatus = "ACTIVE" | "PAUSED" | "DRAFT";

const AUTOMATION_RULES: Array<{
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  status: RuleStatus;
  lastRun: string;
  owner: string;
  runCount: number;
}> = [
  {
    id: "rul_001",
    name: "Supplier Doc Expiry Alert",
    trigger: "Document expiry date < 30 days",
    condition: "Document status = APPROVED",
    action: "Send email to supplier + create compliance task",
    status: "ACTIVE",
    lastRun: "2 hours ago",
    owner: "System",
    runCount: 48,
  },
  {
    id: "rul_002",
    name: "B2B Quote Follow-up",
    trigger: "Quote accepted, no PO after 3 days",
    condition: "Quote status = ACCEPTED and PO = null",
    action: "Send follow-up email to buyer account manager",
    status: "ACTIVE",
    lastRun: "6 hours ago",
    owner: "CRM Team",
    runCount: 22,
  },
  {
    id: "rul_003",
    name: "Abandoned Cart Recovery",
    trigger: "Cart inactive for 24 hours",
    condition: "Cart value > AED 200 and user has email",
    action: "Send WhatsApp + email reminder with cart link",
    status: "ACTIVE",
    lastRun: "1 hour ago",
    owner: "Marketing",
    runCount: 310,
  },
  {
    id: "rul_004",
    name: "Order SLA Breach Warning",
    trigger: "Order fulfillment > 80% of SLA window",
    condition: "Order status = PROCESSING or CONFIRMED",
    action: "Alert dispatch team + seller Slack notification",
    status: "ACTIVE",
    lastRun: "3 hours ago",
    owner: "Operations",
    runCount: 89,
  },
  {
    id: "rul_005",
    name: "Low Stock Reorder Alert",
    trigger: "SKU quantity below reorder point",
    condition: "Active SKU with velocity > 5/day",
    action: "Create procurement task + notify warehouse manager",
    status: "ACTIVE",
    lastRun: "30 min ago",
    owner: "System",
    runCount: 127,
  },
  {
    id: "rul_006",
    name: "New Seller Onboarding Nudge",
    trigger: "Seller registered but inactive for 5 days",
    condition: "Seller status = PENDING and product count = 0",
    action: "Send onboarding guide + schedule call with seller success",
    status: "ACTIVE",
    lastRun: "1 day ago",
    owner: "Seller Team",
    runCount: 14,
  },
  {
    id: "rul_007",
    name: "RFQ No-response Escalation",
    trigger: "RFQ open for 48 hours with 0 quotes",
    condition: "RFQ status = SUBMITTED",
    action: "Notify admin + auto-invite 2 backup suppliers",
    status: "PAUSED",
    lastRun: "3 days ago",
    owner: "B2B Team",
    runCount: 7,
  },
  {
    id: "rul_008",
    name: "VIP Buyer Reactivation",
    trigger: "VIP B2B account inactive 30+ days",
    condition: "Account GMV > AED 50,000 lifetime",
    action: "Create CRM task + send personalized promo code",
    status: "ACTIVE",
    lastRun: "2 days ago",
    owner: "CRM Team",
    runCount: 31,
  },
  {
    id: "rul_009",
    name: "Payment Overdue Escalation",
    trigger: "Invoice overdue by 14+ days",
    condition: "Invoice status = OUTSTANDING and amount > AED 10,000",
    action: "Send overdue notice + create finance escalation task",
    status: "DRAFT",
    lastRun: "—",
    owner: "Finance",
    runCount: 0,
  },
  {
    id: "rul_010",
    name: "Return Rate Spike Alert",
    trigger: "Seller return rate > 5% in 7-day window",
    condition: "Minimum 10 orders in period",
    action: "Alert admin + flag seller for performance review",
    status: "ACTIVE",
    lastRun: "5 hours ago",
    owner: "System",
    runCount: 3,
  },
];

const STATUS_CONFIG: Record<RuleStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  ACTIVE: { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle },
  PAUSED: { label: "Paused", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Pause },
  DRAFT: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileEdit },
};

export default async function AutomationPage() {
  await requireAdminSession();

  const active = AUTOMATION_RULES.filter((r) => r.status === "ACTIVE").length;
  const paused = AUTOMATION_RULES.filter((r) => r.status === "PAUSED").length;
  const draft = AUTOMATION_RULES.filter((r) => r.status === "DRAFT").length;
  const totalRuns = AUTOMATION_RULES.reduce((s, r) => s + r.runCount, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Automation Center</h1>
              <p className="text-muted-foreground text-sm">Workflow rules that run your platform intelligently</p>
            </div>
          </div>
          <button type="button" className="flex items-center gap-2 bg-primary hover:bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" /> New Rule
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Rules", value: active, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20" },
            { label: "Paused", value: paused, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
            { label: "Draft", value: draft, color: "text-muted-foreground", bg: "bg-card border-border" },
            { label: "Executions This Month", value: totalRuns.toLocaleString(), color: "text-primary", bg: "bg-primary/10 border-primary/20" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-4 ${stat.bg}`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Rules table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Workflow Rules</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Auto-refreshes every 5 minutes</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <tr>
                  <th className="text-start px-5 py-3">Rule Name</th>
                  <th className="text-start px-5 py-3 hidden md:table-cell">Trigger</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Action</th>
                  <th className="text-start px-5 py-3">Status</th>
                  <th className="text-start px-5 py-3 hidden sm:table-cell">Last Run</th>
                  <th className="text-start px-5 py-3 hidden lg:table-cell">Owner</th>
                  <th className="text-start px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {AUTOMATION_RULES.map((rule) => {
                  const cfg = STATUS_CONFIG[rule.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={rule.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{rule.id}</p>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <p className="text-xs text-muted-foreground max-w-[180px] line-clamp-2">{rule.trigger}</p>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <p className="text-xs text-muted-foreground max-w-[200px] line-clamp-2">{rule.action}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell text-xs text-muted-foreground">{rule.lastRun}</td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {rule.owner}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {rule.status === "ACTIVE" ? (
                            <button type="button" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
                              <Pause className="h-3 w-3" /> Pause
                            </button>
                          ) : rule.status === "PAUSED" ? (
                            <button type="button" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                              <Play className="h-3 w-3" /> Activate
                            </button>
                          ) : (
                            <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1">
                              <FileEdit className="h-3 w-3" /> Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
