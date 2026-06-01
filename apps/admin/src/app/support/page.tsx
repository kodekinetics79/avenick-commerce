import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { setTicketStatus } from "./actions";
import { MessageSquare, Clock, AlertTriangle, CheckCircle, Activity, Scale, Gauge } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Support Tickets" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  IN_PROGRESS: { label: "In progress", cls: "bg-primary/15 text-primary", icon: Activity },
  RESOLVED: { label: "Resolved", cls: "bg-success/15 text-success", icon: CheckCircle },
  CLOSED: { label: "Closed", cls: "bg-secondary text-muted-foreground", icon: CheckCircle },
};

const PRIORITY: Record<string, string> = {
  URGENT: "bg-danger/15 text-danger",
  HIGH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  NORMAL: "bg-secondary text-muted-foreground",
  LOW: "bg-secondary text-muted-foreground",
};

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function SupportPage() {
  await requireAdminSession();

  const tickets = await db.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });

  const count = (s: string) => tickets.filter((t) => t.status === s).length;
  const stats = [
    { label: "Open", value: count("OPEN"), icon: Clock },
    { label: "In progress", value: count("IN_PROGRESS"), icon: Activity },
    { label: "Resolved", value: count("RESOLVED"), icon: CheckCircle },
    { label: "Total", value: tickets.length, icon: MessageSquare },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support &amp; Disputes</h1>
            <p className="text-muted-foreground text-sm">Customer tickets raised across the marketplace.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/disputes" className="flex items-center gap-1.5 text-sm border border-border bg-card hover:bg-secondary px-3 py-2 rounded-xl font-medium transition-colors">
              <Scale className="h-3.5 w-3.5" /> Disputes
            </Link>
            <Link href="/sla" className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-xl font-semibold transition-colors">
              <Gauge className="h-3.5 w-3.5" /> SLA Monitor
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2"><s.icon className="h-4 w-4" /><span className="text-[11px]">{s.label}</span></div>
              <p className="text-2xl font-bold font-mono tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {tickets.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No tickets yet</p>
              <p className="text-sm text-muted-foreground mt-1">Customer tickets will appear here as they're filed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    {["Ticket", "Subject", "Customer", "Category", "Priority", "Status", "Opened", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tickets.map((t) => {
                    const st = STATUS[t.status] ?? STATUS.OPEN!;
                    return (
                      <tr key={t.id} className="hover:bg-secondary/40 transition-colors align-top">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{t.ticketNumber}</td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="font-medium truncate">{t.subject}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
                          {t.orderRef && <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{t.orderRef}</p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium">{t.user.firstName} {t.user.lastName}</p>
                          <p className="text-xs text-muted-foreground">{t.user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{t.category}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PRIORITY[t.priority] ?? PRIORITY.NORMAL}`}>{t.priority}</span></td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(t.createdAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {t.status === "OPEN" && <form action={setTicketStatus.bind(null, t.id, "IN_PROGRESS")}><button type="submit" className="text-xs font-semibold text-primary hover:underline">Start</button></form>}
                            {t.status === "IN_PROGRESS" && <form action={setTicketStatus.bind(null, t.id, "RESOLVED")}><button type="submit" className="text-xs font-semibold text-success hover:underline">Resolve</button></form>}
                            {t.status !== "CLOSED" && <form action={setTicketStatus.bind(null, t.id, "CLOSED")}><button type="submit" className="text-xs font-medium text-muted-foreground hover:text-danger">Close</button></form>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
