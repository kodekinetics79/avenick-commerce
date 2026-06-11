import { requireSellerSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { LifeBuoy, Clock, CheckCircle, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Support Tickets" };

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string }> = {
  OPEN:        { icon: AlertCircle, color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  IN_PROGRESS: { icon: Clock,       color: "text-primary",                       bg: "bg-primary/10 border-primary/20" },
  RESOLVED:    { icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  CLOSED:      { icon: CheckCircle, color: "text-muted-foreground",              bg: "bg-muted border-border" },
};

export default async function TicketsPage() {
  const { seller } = await requireSellerSession();

  const tickets = await db.supportTicket.findMany({
    where: { userId: seller.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Support Tickets</h1>
              <p className="text-sm text-muted-foreground">Manage your support requests and get help</p>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> New Ticket
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{tickets.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Tickets</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{openCount}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Open</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{tickets.filter((t) => t.status === "RESOLVED").length}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Resolved</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-bold">{tickets.filter((t) => t.status === "CLOSED").length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Closed</p>
          </div>
        </div>

        {/* Ticket list */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {tickets.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <LifeBuoy className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">No support tickets yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create a ticket if you need help with your account or orders.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {tickets.map((ticket) => {
                const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.OPEN;
                const StatusIcon = cfg.icon;
                return (
                  <div key={ticket.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm truncate">{ticket.subject}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.color}`}>
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description ?? "No description"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Priority: <span className="font-medium">{ticket.priority}</span>
                        {ticket.createdAt && ` · Created ${new Date(ticket.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
