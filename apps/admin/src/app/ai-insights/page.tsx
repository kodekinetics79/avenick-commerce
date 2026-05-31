import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Brain, TrendingUp, AlertTriangle, Package, Users, ArrowRight, BarChart2, Zap, ShieldAlert, Star, Clock } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "AI Insights" };

const INSIGHT_TABS = ["Commerce", "B2B", "Operations", "Risk"] as const;

const INSIGHTS = {
  Commerce: [
    {
      icon: TrendingUp,
      iconBg: "bg-blue-100",
      iconColor: "text-primary",
      title: "Price Optimization Opportunity",
      description: "3 high-volume SKUs are priced 10–18% above market average based on competitor analysis. Adjusting prices could recover an estimated AED 8,200 monthly in lost conversions.",
      confidence: 91,
      action: "View Products",
      href: "/products",
      tag: "Revenue",
      tagColor: "bg-blue-100 text-primary",
    },
    {
      icon: BarChart2,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      title: "Category Growth Signal",
      description: "Safety & PPE category views increased 34% week-over-week. Inventory levels may not meet projected demand surge. Consider activating backup suppliers.",
      confidence: 78,
      action: "View Inventory",
      href: "/warehouse",
      tag: "Trending",
      tagColor: "bg-purple-100 text-purple-700",
    },
    {
      icon: Star,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      title: "Bundle Recommendation",
      description: "85% of buyers purchasing Safety Helmets also buy Nitrile Gloves within 7 days. Creating a bundle could increase cart value by 22%.",
      confidence: 85,
      action: "Create Bundle",
      href: "/products",
      tag: "Upsell",
      tagColor: "bg-amber-100 text-amber-700",
    },
    {
      icon: Users,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      title: "High-LTV Segment Identified",
      description: "A segment of 142 B2C buyers has placed 4+ orders in 90 days with zero returns. Targeting them with early access deals could drive 15% higher engagement.",
      confidence: 88,
      action: "View CRM",
      href: "/crm",
      tag: "CRM",
      tagColor: "bg-green-100 text-green-700",
    },
  ],
  B2B: [
    {
      icon: AlertTriangle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      title: "RFQ Response Gap",
      description: "3 open RFQs from high-value B2B companies have received no supplier response in 48+ hours. Proactively inviting backup suppliers could prevent churn.",
      confidence: 94,
      action: "View RFQs",
      href: "/rfqs",
      tag: "Urgent",
      tagColor: "bg-red-100 text-red-700",
    },
    {
      icon: Users,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      title: "VIP Company Inactivity Alert",
      description: "5 B2B companies with combined GMV of AED 410,000 have been inactive for 30+ days. A targeted outreach campaign is recommended before they explore competitors.",
      confidence: 89,
      action: "View CRM",
      href: "/crm",
      tag: "Retention",
      tagColor: "bg-amber-100 text-amber-700",
    },
    {
      icon: TrendingUp,
      iconBg: "bg-blue-100",
      iconColor: "text-primary",
      title: "Credit Limit Upgrade Opportunity",
      description: "12 B2B accounts have consistently utilized >80% of their credit limit without any payment delays. Proactively offering a limit increase may grow their order frequency.",
      confidence: 82,
      action: "View Companies",
      href: "/companies",
      tag: "Finance",
      tagColor: "bg-blue-100 text-primary",
    },
    {
      icon: BarChart2,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      title: "Quote-to-Order Conversion Lag",
      description: "Average time from quote acceptance to purchase order submission is 6.4 days — industry benchmark is 2.1 days. Adding a 1-click PO generation flow could cut this by 60%.",
      confidence: 76,
      action: "View Quotes",
      href: "/quotes",
      tag: "Efficiency",
      tagColor: "bg-indigo-100 text-indigo-700",
    },
  ],
  Operations: [
    {
      icon: Package,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      title: "Inventory Risk: Critical SKU",
      description: "SKU-PPE-0042 (Safety Helmet Pro X200) has only 3 days of stock remaining based on current velocity. Initiate emergency replenishment immediately.",
      confidence: 97,
      action: "Replenish Stock",
      href: "/warehouse",
      tag: "Critical",
      tagColor: "bg-red-100 text-red-700",
    },
    {
      icon: Clock,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      title: "Fulfillment SLA Risk",
      description: "14 orders are at risk of missing their promised delivery date due to a Seller A processing delay. Customer satisfaction scores may drop if not intervened.",
      confidence: 88,
      action: "View Orders",
      href: "/orders",
      tag: "SLA",
      tagColor: "bg-amber-100 text-amber-700",
    },
    {
      icon: Zap,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      title: "Warehouse Optimization",
      description: "Zone B utilization is at 94% while Zone D is only 38% utilized. Redistributing fast-moving SKUs from Zone B to Zone D could improve pick-pack speed by 18%.",
      confidence: 73,
      action: "View Warehouse",
      href: "/warehouse",
      tag: "Efficiency",
      tagColor: "bg-green-100 text-green-700",
    },
  ],
  Risk: [
    {
      icon: ShieldAlert,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      title: "Supplier Document Expiry",
      description: "2 active suppliers have compliance documents expiring within 14 days. Failure to renew could result in automatic listing suspension per platform policy.",
      confidence: 99,
      action: "Manage Compliance",
      href: "/compliance",
      tag: "Compliance",
      tagColor: "bg-red-100 text-red-700",
    },
    {
      icon: AlertTriangle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      title: "Payment Anomaly Detected",
      description: "3 invoices over AED 50,000 have been outstanding for 45+ days. Risk scoring indicates 2 of these may default. Escalation to finance team recommended.",
      confidence: 81,
      action: "View Finance",
      href: "/finance",
      tag: "Finance Risk",
      tagColor: "bg-amber-100 text-amber-700",
    },
    {
      icon: Users,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      title: "Seller Quality Decline",
      description: "Seller 'Gulf Industrial Co' has seen a 22% increase in return rate over 60 days. Proactive review before it impacts platform NPS is recommended.",
      confidence: 84,
      action: "Review Seller",
      href: "/sellers",
      tag: "Quality",
      tagColor: "bg-purple-100 text-purple-700",
    },
  ],
};

const RECOMMENDED_ACTIONS = [
  { priority: "P1", label: "Invite backup suppliers for 3 unanswered RFQs", color: "bg-red-100 text-red-700 border-red-200", href: "/rfqs" },
  { priority: "P1", label: "Renew expiring compliance docs before 14-day deadline", color: "bg-red-100 text-red-700 border-red-200", href: "/compliance" },
  { priority: "P2", label: "Run reactivation campaign for 5 inactive VIP B2B accounts", color: "bg-amber-100 text-amber-700 border-amber-200", href: "/crm" },
  { priority: "P2", label: "Replenish SKU-PPE-0042 — 3 days stock remaining", color: "bg-amber-100 text-amber-700 border-amber-200", href: "/warehouse" },
  { priority: "P3", label: "Adjust pricing on 3 overpriced SKUs to improve conversion", color: "bg-blue-100 text-primary border-blue-200", href: "/products" },
];

export default async function AIInsightsPage() {
  await requireAdminSession();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Commerce Advisor</h1>
            <p className="text-muted-foreground text-sm">Real-time intelligence powered by platform data. Last updated: 5 min ago.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main insight panels */}
          <div className="lg:col-span-2 space-y-5">
            {(Object.keys(INSIGHTS) as Array<keyof typeof INSIGHTS>).map((tab) => (
              <div key={tab}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-semibold text-muted-foreground">{tab} Insights</h2>
                  <span className="text-xs bg-slate-100 text-muted-foreground px-2 py-0.5 rounded-full">{INSIGHTS[tab].length} signals</span>
                </div>
                <div className="space-y-3">
                  {INSIGHTS[tab].map((insight, idx) => {
                    const Icon = insight.icon;
                    return (
                      <div key={idx} className="bg-white rounded-2xl border border-border p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start gap-3">
                          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", insight.iconBg)}>
                            <Icon className={cn("h-4 w-4", insight.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-sm text-foreground">{insight.title}</h3>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", insight.tagColor)}>{insight.tag}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{insight.description}</p>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-xs text-muted-foreground">Confidence</span>
                                <div className="flex gap-0.5 flex-1 max-w-[120px] h-1.5">
                                  {Array.from({ length: 10 }).map((_, i) => (
                                    <div key={i} className={cn("flex-1 rounded-full", i < Math.round(insight.confidence / 10) ? (insight.confidence >= 90 ? "bg-green-500" : insight.confidence >= 75 ? "bg-amber-500" : "bg-blue-500") : "bg-slate-100")} />
                                  ))}
                                </div>
                                <span className={cn("text-xs font-semibold", insight.confidence >= 90 ? "text-green-600" : insight.confidence >= 75 ? "text-amber-600" : "text-primary")}>
                                  {insight.confidence}%
                                </span>
                              </div>
                              <Link
                                href={insight.href}
                                className="flex items-center gap-1 text-xs text-primary hover:text-blue-800 font-medium whitespace-nowrap"
                              >
                                {insight.action} <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Recommended Actions Panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-border overflow-hidden sticky top-4">
              <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-800 to-slate-700">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <h2 className="font-semibold text-white text-sm">Recommended Actions</h2>
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">AI-prioritized next steps</p>
              </div>
              <div className="divide-y divide-slate-100">
                {RECOMMENDED_ACTIONS.map((action, idx) => (
                  <Link key={idx} href={action.href} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                    <span className={cn("shrink-0 text-xs font-bold px-1.5 py-0.5 rounded border font-mono", action.color)}>
                      {action.priority}
                    </span>
                    <p className="text-sm text-muted-foreground group-hover:text-foreground leading-snug flex-1">{action.label}</p>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
                  </Link>
                ))}
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                <p className="text-xs text-muted-foreground">Actions generated from live platform data. Dismiss or snooze from action menu.</p>
              </div>
            </div>

            {/* Model info */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-4 text-white">
              <Brain className="h-5 w-5 text-indigo-300 mb-2" />
              <p className="font-semibold text-sm mb-1">AI Model Status</p>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between"><span>Model version</span><span className="text-indigo-300 font-mono">v2.4.1</span></div>
                <div className="flex justify-between"><span>Data freshness</span><span className="text-green-400">Live (5 min lag)</span></div>
                <div className="flex justify-between"><span>Signals analyzed</span><span>1,247</span></div>
                <div className="flex justify-between"><span>Actions surfaced</span><span>18 today</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
