import Link from "next/link";
import { ArrowLeft, CheckSquare, AlertTriangle, Clock, User, FileText, CheckCircle, XCircle } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency } from "@avenick/utils";

export const metadata = { title: "Approval Center — Avenick Commerce" };

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type Urgency = "critical" | "high" | "normal";

const MOCK_APPROVALS: Array<{
  id: string; orderRef: string; description: string; requester: string;
  department: string; amount: number; currency: string; submittedAt: string;
  dueBy: string; urgency: Urgency; status: ApprovalStatus; items: number;
  notes: string;
}> = [
  { id: "a1", orderRef: "PO-2024-0831", description: "Safety Helmets EN397 × 200 units for Site B", requester: "Khalid Al-Rashid", department: "Operations", amount: 8400, currency: "AED", submittedAt: "2 hours ago", dueBy: "Today", urgency: "high", status: "PENDING", items: 2, notes: "Urgently needed before site inspection on Dec 1." },
  { id: "a2", orderRef: "PO-2024-0829", description: "Nitrile Examination Gloves × 500 boxes", requester: "Fatima Hassan", department: "Medical", amount: 19500, currency: "AED", submittedAt: "1 day ago", dueBy: "Nov 30", urgency: "normal", status: "PENDING", items: 1, notes: "Monthly restocking order." },
  { id: "a3", orderRef: "PO-2024-0818", description: "Office Chairs Ergonomic × 15 units", requester: "Omar Khalil", department: "HR", amount: 12750, currency: "AED", submittedAt: "3 days ago", dueBy: "Dec 5", urgency: "normal", status: "APPROVED", items: 1, notes: "" },
  { id: "a4", orderRef: "PO-2024-0812", description: "Fire Extinguishers CO2 5kg × 30 units", requester: "Sara Al-Nouri", department: "Facilities", amount: 4200, currency: "AED", submittedAt: "5 days ago", dueBy: "Nov 28", urgency: "critical", status: "REJECTED", items: 1, notes: "Rejected: Budget allocation exceeded for Q4. Resubmit in January." },
];

const URGENCY_CONFIG: Record<Urgency, { label: string; color: string; border: string }> = {
  critical: { label: "Critical", color: "text-red-500 bg-red-500/10",   border: "border-red-500/30" },
  high:     { label: "Urgent",   color: "text-amber-500 bg-amber-500/10", border: "border-amber-500/30" },
  normal:   { label: "Normal",   color: "text-muted-foreground bg-secondary", border: "border-border" },
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:  { label: "Pending Approval", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  APPROVED: { label: "Approved",         color: "bg-primary/15 text-primary",   icon: CheckCircle },
  REJECTED: { label: "Rejected",         color: "bg-danger/15 text-danger",       icon: XCircle },
};

const TABS = ["All", "Pending", "Approved", "Rejected"] as const;
const pending = MOCK_APPROVALS.filter((a) => a.status === "PENDING");

export default function ApprovalsPage() {
  return (
    <B2BShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/b2b" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to B2B Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckSquare className="h-5 w-5 text-amber-500" />
              <h1 className="text-2xl font-bold">Approval Center</h1>
              {pending.length > 0 && (
                <span className="h-6 w-6 bg-amber-500 text-white rounded-full text-xs flex items-center justify-center font-bold">{pending.length}</span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">Review and approve purchase orders from your team</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Awaiting Approval</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{MOCK_APPROVALS.filter(a => a.status === "APPROVED").length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Approved (All Time)</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-lg font-bold text-primary">{formatCurrency(pending.reduce((s, a) => s + a.amount, 0), "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending Value</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-5 w-fit">
          {TABS.map((tab) => (
            <button key={tab} type="button"
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "All" ? "bg-primary text-primary-foreground shadow-glow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}>
              {tab}
              {tab === "Pending" && pending.length > 0 && (
                <span className="ms-1.5 h-4 w-4 bg-amber-500 text-white text-xs rounded-full inline-flex items-center justify-center">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders list */}
        <div className="space-y-4">
          {MOCK_APPROVALS.map((approval) => {
            const uc = URGENCY_CONFIG[approval.urgency];
            const sc = STATUS_CONFIG[approval.status];
            const StatusIcon = sc.icon;
            return (
              <div key={approval.id} className={`bg-card rounded-2xl border-2 overflow-hidden ${approval.status === "PENDING" ? uc.border : "border-border"}`}>
                {/* Top bar */}
                <div className={`px-5 py-2.5 flex items-center justify-between border-b ${approval.status === "PENDING" && approval.urgency !== "normal" ? `bg-${approval.urgency === "critical" ? "red" : "amber"}-500/10 border-${approval.urgency === "critical" ? "red" : "amber"}-500/20` : "bg-secondary/35 border-border"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground font-medium">{approval.orderRef}</span>
                    {approval.urgency !== "normal" && (
                      <span className={`flex items-center gap-1 text-xs font-semibold ${uc.color} px-2 py-0.5 rounded-full`}>
                        <AlertTriangle className="h-3 w-3" /> {uc.label}
                      </span>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${sc.color}`}>
                    <StatusIcon className="h-3 w-3" /> {sc.label}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 pe-4">
                      <h3 className="font-semibold mb-1 text-foreground">{approval.description}</h3>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {approval.requester}</span>
                        <span>{approval.department}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {approval.items} item{approval.items !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Submitted {approval.submittedAt}</span>
                        <span className="font-medium text-foreground">Due: {approval.dueBy}</span>
                      </div>
                      {approval.notes && (
                        <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2 border border-border">{approval.notes}</p>
                      )}
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-xl font-bold text-primary mb-3">{formatCurrency(approval.amount, approval.currency as "AED")}</p>
                      {approval.status === "PENDING" && (
                        <div className="flex gap-2 justify-end">
                          <button type="button" className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/95 transition-colors font-semibold">
                            <CheckCircle className="h-4 w-4" /> Approve
                          </button>
                          <button type="button" className="flex items-center gap-1.5 text-sm border border-border text-muted-foreground px-4 py-2 rounded-xl hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors font-medium">
                            <XCircle className="h-4 w-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </B2BShell>
  );
}
