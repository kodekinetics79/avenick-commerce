import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_DISPUTES } from "@manzil/database";
import { formatCurrency } from "@manzil/utils";
import { Scale, ArrowLeft, AlertTriangle, Clock, CheckCircle, FileText, User, Store } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Disputes" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN:            { label: "Open",             color: "bg-blue-100 text-blue-700",     icon: Clock },
  AWAITING_SELLER: { label: "Awaiting Seller",  color: "bg-amber-100 text-amber-700",   icon: Clock },
  UNDER_REVIEW:    { label: "Under Review",     color: "bg-purple-100 text-purple-700", icon: Scale },
  RESOLVED_BUYER:  { label: "Resolved (Buyer)", color: "bg-green-100 text-green-700",   icon: CheckCircle },
  RESOLVED_SELLER: { label: "Resolved (Seller)",color: "bg-green-100 text-green-700",   icon: CheckCircle },
};

const TYPE_LABEL: Record<string, string> = {
  ITEM_NOT_RECEIVED: "Item Not Received",
  NOT_AS_DESCRIBED:  "Not As Described",
  DAMAGED:           "Damaged Item",
  REFUND_REQUEST:    "Refund Request",
};

const TABS = ["All", "Open", "Awaiting Seller", "Under Review", "Resolved"] as const;

export default async function DisputesPage() {
  await requireAdminSession();

  const open = MOCK_DISPUTES.filter(d => ["OPEN","AWAITING_SELLER","UNDER_REVIEW"].includes(d.status));
  const disputedValue = open.reduce((s, d) => s + d.amount, 0);
  const awaitingSeller = MOCK_DISPUTES.filter(d => d.status === "AWAITING_SELLER").length;
  const resolved = MOCK_DISPUTES.filter(d => d.status.startsWith("RESOLVED")).length;

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
              <span className="text-sm font-medium">Disputes</span>
            </div>
            <h1 className="text-2xl font-bold">Disputes</h1>
            <p className="text-sm text-muted-foreground">Buyer–seller disputes requiring marketplace mediation</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open Disputes", value: open.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: "Disputed Value", value: formatCurrency(disputedValue, "AED"), color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Awaiting Seller", value: awaitingSeller, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
            { label: "Resolved", value: resolved, color: "text-green-600", bg: "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} type="button"
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "All" ? "bg-slate-900 text-white" : "text-muted-foreground hover:text-foreground hover:bg-slate-50"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Dispute cards */}
        <div className="space-y-3">
          {MOCK_DISPUTES.map((d) => {
            const sc = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.OPEN;
            const StatusIcon = sc.icon;
            const isResolved = d.status.startsWith("RESOLVED");
            const needsAction = d.status === "OPEN" || d.status === "UNDER_REVIEW";
            return (
              <div key={d.id} className={`bg-white rounded-2xl border-2 p-5 ${d.priority === "HIGH" && !isResolved ? "border-red-200" : "border-border"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Top row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-600">{d.id}</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                        <StatusIcon className="h-3 w-3" /> {sc.label}
                      </span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{TYPE_LABEL[d.type] ?? d.type}</span>
                      {d.priority === "HIGH" && !isResolved && (
                        <span className="flex items-center gap-0.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold uppercase">
                          <AlertTriangle className="h-2.5 w-2.5" /> High
                        </span>
                      )}
                    </div>

                    {/* Parties */}
                    <div className="flex flex-wrap items-center gap-4 text-sm mb-2">
                      <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-blue-500" /> <strong>{d.buyer}</strong></span>
                      <span className="text-muted-foreground">vs</span>
                      <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-purple-500" /> {d.seller}</span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Order {d.orderRef}</span>
                      <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {d.evidence} evidence file{d.evidence !== 1 ? "s" : ""}</span>
                      <span>Opened {d.openedAt}</span>
                      <span className={d.sellerResponded ? "text-green-600" : "text-amber-600"}>
                        {d.sellerResponded ? "✓ Seller responded" : "⏳ Awaiting seller response"}
                      </span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="text-end shrink-0">
                    <p className="font-bold text-green-700 mb-2">{formatCurrency(d.amount, d.currency as "AED")}</p>
                    {needsAction ? (
                      <div className="flex flex-col gap-1.5">
                        <button type="button" className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 font-medium transition-colors">Review Case</button>
                        <button type="button" className="text-xs border border-border text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors">Mediate</button>
                      </div>
                    ) : d.status === "AWAITING_SELLER" ? (
                      <button type="button" className="text-xs border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-medium transition-colors">Remind Seller</button>
                    ) : (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end"><CheckCircle className="h-3.5 w-3.5" /> Closed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
