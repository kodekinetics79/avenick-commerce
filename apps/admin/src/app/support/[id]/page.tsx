import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSupportTicket } from "@avenick/database";
import { setTicketStatus } from "../actions";
import { ArrowLeft, Clock, User, AlertTriangle, CheckCircle, Activity, Package } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Ticket Detail" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", color: "bg-amber-100 text-amber-700", icon: Clock },
  IN_PROGRESS: { label: "In progress", color: "bg-blue-100 text-primary", icon: Activity },
  RESOLVED: { label: "Resolved", color: "bg-green-100 text-green-700", icon: CheckCircle },
  CLOSED: { label: "Closed", color: "bg-slate-100 text-muted-foreground", icon: CheckCircle },
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-amber-100 text-amber-700",
  NORMAL: "bg-slate-100 text-muted-foreground",
  LOW: "bg-slate-100 text-muted-foreground",
};

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  await requireAdminSession();

  const ticket = await getSupportTicket(params.id);
  if (!ticket) notFound();

  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG["OPEN"]!;
  const StatusIcon = cfg.icon;

  const transitions: Array<{ to: "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "OPEN"; label: string; style: string }> = [];
  if (ticket.status === "OPEN") {
    transitions.push({ to: "IN_PROGRESS", label: "Start working", style: "bg-primary text-white hover:bg-primary/90" });
  }
  if (["OPEN", "IN_PROGRESS"].includes(ticket.status)) {
    transitions.push({ to: "RESOLVED", label: "Mark resolved", style: "bg-green-600 text-white hover:bg-green-700" });
  }
  if (ticket.status === "RESOLVED") {
    transitions.push({ to: "CLOSED", label: "Close ticket", style: "bg-slate-800 text-white hover:bg-slate-700" });
    transitions.push({ to: "IN_PROGRESS", label: "Reopen", style: "border border-border text-muted-foreground hover:bg-muted" });
  }
  if (ticket.status === "CLOSED") {
    transitions.push({ to: "OPEN", label: "Reopen", style: "border border-border text-muted-foreground hover:bg-muted" });
  }

  return (
    <AdminLayout>
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center gap-2">
          <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Support
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{ticket.ticketNumber}</span>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">{ticket.subject}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Opened {formatDistanceToNow(ticket.createdAt, { addSuffix: true })} · {format(ticket.createdAt, "MMM d, yyyy HH:mm")}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${PRIORITY_COLOR[ticket.priority] ?? ""}`}>
                {ticket.priority}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                <StatusIcon className="h-3 w-3" /> {cfg.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1"><User className="h-3 w-3" /> Requester</p>
              <p className="font-medium">{ticket.user.firstName} {ticket.user.lastName}</p>
              <p className="text-xs text-muted-foreground">{ticket.user.email} · {ticket.user.role.replace(/_/g, " ")}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Category</p>
              <p className="font-medium">{ticket.category.replace(/_/g, " ")}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1 inline-flex items-center gap-1"><Package className="h-3 w-3" /> Order reference</p>
              <p className="font-medium font-mono text-xs">{ticket.orderRef ?? "—"}</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2">Description</h2>
            <div className="rounded-xl bg-slate-50 border border-border p-4 text-sm whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {transitions.map((t) => (
              <form
                key={t.to}
                action={async () => {
                  "use server";
                  await setTicketStatus(ticket.id, t.to);
                }}
              >
                <button type="submit" className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${t.style}`}>
                  {t.label}
                </button>
              </form>
            ))}
            <p className="text-xs text-muted-foreground ms-auto">
              Last updated {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })} · status changes are audit-logged
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
