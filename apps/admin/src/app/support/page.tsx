import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_ADMIN_SUPPORT_TICKETS } from "@avenick/database";
import { MessageSquare, Clock, AlertTriangle, CheckCircle, Activity, Scale, Gauge, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Support Tickets" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN:        { label: "Open",        color: "bg-blue-100 text-primary",     icon: Clock },
  IN_PROGRESS: { label: "In Progress", color: "bg-amber-100 text-amber-700",   icon: Activity },
  ESCALATED:   { label: "Escalated",   color: "bg-red-100 text-red-700",       icon: AlertTriangle },
  CLOSED:      { label: "Closed",      color: "bg-green-100 text-green-700",   icon: CheckCircle },
};

const TYPE_COLOR: Record<string, string> = {
  DELIVERY: "bg-cyan-100 text-cyan-700",
  REFUND:   "bg-purple-100 text-purple-700",
  BILLING:  "bg-amber-100 text-amber-700",
  QUALITY:  "bg-orange-100 text-orange-700",
  ACCOUNT:  "bg-slate-100 text-muted-foreground",
};

const TABS = ["All", "Open", "In Progress", "Escalated", "Closed"] as const;

function slaIsUrgent(remaining: string): boolean {
  return remaining.includes("m") || remaining === "1h";
}

export default async function SupportPage() {
  await requireAdminSession();
  const tickets = MOCK_ADMIN_SUPPORT_TICKETS;

  const open      = tickets.filter(t => t.status === "OPEN").length;
  const inProgress= tickets.filter(t => t.status === "IN_PROGRESS").length;
  const escalated = tickets.filter(t => t.status === "ESCALATED").length;
  const closed    = tickets.filter(t => t.status === "CLOSED").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Support &amp; Disputes</h1>
            <p className="text-muted-foreground text-sm">Customer issues, disputes, and SLA monitoring</p>
          </div>
          <div className="flex gap-2">
            <Link href="/disputes" className="flex items-center gap-1.5 text-sm border border-border bg-white text-muted-foreground hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
              <Scale className="h-3.5 w-3.5" /> Disputes
            </Link>
            <Link href="/sla" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <Gauge className="h-3.5 w-3.5" /> SLA Monitor
            </Link>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open", value: open, color: "text-primary", bg: "bg-blue-50 border-blue-200" },
            { label: "In Progress", value: inProgress, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Escalated", value: escalated, color: "text-red-600", bg: escalated > 0 ? "bg-red-50 border-red-200" : "bg-white border-border" },
            { label: "Closed", value: closed, color: "text-green-600", bg: "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Escalated alert */}
        {escalated > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="font-semibold text-red-800 text-sm">{escalated} escalated ticket{escalated !== 1 ? "s" : ""} need immediate attention — some near SLA breach</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} type="button"
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "All" ? "bg-slate-900 text-white" : "text-muted-foreground hover:text-foreground hover:bg-slate-50"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Tickets table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Ticket ID","Buyer","Issue","Type","Status","SLA Remaining","Opened","Action"].map(h => (
                    <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tickets.map((ticket) => {
                  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.OPEN;
                  const Icon = cfg.icon;
                  const isEscalated = ticket.status === "ESCALATED";
                  const urgent = ticket.slaRemaining !== "—" && slaIsUrgent(ticket.slaRemaining);
                  return (
                    <tr key={ticket.id} className={`hover:bg-slate-50 transition-colors ${isEscalated ? "bg-red-50/30" : ""}`}>
                      <td className="px-5 py-3 font-mono text-xs font-semibold text-muted-foreground">{ticket.id}</td>
                      <td className="px-5 py-3 font-medium">{ticket.buyer}</td>
                      <td className="px-5 py-3 max-w-[220px] truncate">{ticket.issue}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[ticket.type] ?? "bg-slate-100 text-muted-foreground"}`}>{ticket.type}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                          <Icon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-xs font-semibold ${ticket.slaRemaining === "—" ? "text-muted-foreground" : urgent ? "text-red-600" : "text-foreground"}`}>
                        {ticket.slaRemaining !== "—" && urgent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse me-1" />}
                        {ticket.slaRemaining}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{ticket.createdAt}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <Link href={`/support/${ticket.id}`} className="text-xs text-primary hover:underline font-medium">View</Link>
                          {ticket.status !== "CLOSED" && (
                            <button type="button" className="text-xs text-green-600 hover:underline font-medium">Resolve</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-5 py-3 border-t border-border bg-slate-50">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{tickets.length} tickets total</p>
            <Link href="/sla" className="text-xs text-primary hover:underline font-medium ms-auto flex items-center gap-1">SLA performance <ArrowRight className="h-3 w-3" /></Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
