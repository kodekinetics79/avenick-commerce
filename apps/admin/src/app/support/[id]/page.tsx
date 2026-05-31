import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_TICKET_THREAD, MOCK_ADMIN_SUPPORT_TICKETS } from "@avenick/database";
import { ArrowLeft, Clock, User, Package, AlertTriangle, CheckCircle, Send, Lock, Paperclip, ArrowUpCircle } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Ticket Detail" };

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  await requireAdminSession();

  // Use the rich thread mock; fall back to list lookup for header meta
  const listTicket = MOCK_ADMIN_SUPPORT_TICKETS.find(t => t.id === params.id);
  const t = MOCK_TICKET_THREAD;
  const buyer = listTicket?.buyer ?? t.buyer;
  const issue = listTicket?.issue ?? t.issue;
  const type = listTicket?.type ?? t.type;
  const status = listTicket?.status ?? t.status;
  const slaRemaining = listTicket?.slaRemaining ?? t.slaRemaining;

  const STATUS_COLOR: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-700", IN_PROGRESS: "bg-amber-100 text-amber-700",
    ESCALATED: "bg-red-100 text-red-700", CLOSED: "bg-green-100 text-green-700",
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Tickets
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium font-mono">{params.id}</span>
        </div>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{issue}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[status] ?? STATUS_COLOR.OPEN}`}>{status.replace(/_/g, " ")}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {buyer}</span>
                <span>{type}</span>
                <span className="flex items-center gap-1"><Package className="h-3 w-3" /> Order {t.orderRef}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Opened {t.createdAt}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="flex items-center gap-1.5 text-xs border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-medium transition-colors">
                <ArrowUpCircle className="h-3.5 w-3.5" /> Escalate
              </button>
              <button type="button" className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium transition-colors">
                <CheckCircle className="h-3.5 w-3.5" /> Resolve
              </button>
            </div>
          </div>
        </div>

        {/* SLA bar */}
        <div className={`rounded-2xl border p-4 flex items-center justify-between ${slaRemaining.includes("m") || slaRemaining === "1h" ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
          <div className="flex items-center gap-3">
            <Clock className={`h-5 w-5 shrink-0 ${slaRemaining.includes("m") || slaRemaining === "1h" ? "text-red-600" : "text-slate-500"}`} />
            <div>
              <p className="text-sm font-semibold">SLA: {slaRemaining} remaining</p>
              <p className="text-xs text-muted-foreground">Target resolution: {t.slaTotal} · Assigned to {t.assignedTo}</p>
            </div>
          </div>
          <span className={`text-xs font-semibold ${slaRemaining.includes("m") || slaRemaining === "1h" ? "text-red-600" : "text-green-600"}`}>
            {slaRemaining.includes("m") || slaRemaining === "1h" ? "At risk of breach" : "On track"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Conversation */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">Conversation</h2>
              </div>
              <div className="p-5 space-y-4">
                {t.messages.map((m) => {
                  const isAgent = m.from === "AGENT";
                  return (
                    <div key={m.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${isAgent ? "items-end" : "items-start"}`}>
                        <div className={`rounded-2xl px-4 py-2.5 ${isAgent ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"}`}>
                          <p className="text-sm">{m.body}</p>
                        </div>
                        <p className={`text-xs text-muted-foreground mt-1 ${isAgent ? "text-end" : ""}`}>{m.author} · {m.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Reply box */}
              <div className="px-5 py-4 border-t border-border bg-slate-50">
                <textarea placeholder="Type your reply to the customer..." rows={2}
                  className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none" />
                <div className="flex items-center justify-between mt-2">
                  <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border px-2.5 py-1.5 rounded-lg transition-colors">
                    <Paperclip className="h-3 w-3" /> Attach
                  </button>
                  <button type="button" className="flex items-center gap-1.5 text-sm bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 font-medium transition-colors">
                    <Send className="h-3.5 w-3.5" /> Send Reply
                  </button>
                </div>
              </div>
            </div>

            {/* Internal notes */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                <h2 className="font-semibold text-sm text-amber-800">Internal Notes (not visible to customer)</h2>
              </div>
              <div className="p-5 space-y-3">
                {t.internalNotes.map((n) => (
                  <div key={n.id} className="bg-white rounded-xl p-3 border border-amber-100">
                    <p className="text-sm text-slate-700">{n.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.author} · {n.time}</p>
                  </div>
                ))}
                <input type="text" placeholder="Add internal note..."
                  className="w-full text-sm border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3">Ticket Details</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Ticket ID", params.id],
                  ["Type", type],
                  ["Priority", t.priority],
                  ["Order", t.orderRef],
                  ["Assigned", t.assignedTo],
                  ["Customer", t.email],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-xs">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { label: "Reassign agent", color: "text-blue-600" },
                  { label: "Convert to dispute", color: "text-purple-600" },
                  { label: "Issue refund", color: "text-green-600" },
                  { label: "Close ticket", color: "text-slate-600" },
                ].map(({ label, color }) => (
                  <button key={label} type="button" className={`w-full text-start text-sm ${color} hover:underline py-1`}>{label} →</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
