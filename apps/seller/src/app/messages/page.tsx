import { requireSellerSession } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { format } from "date-fns";
import { MessageSquare, ClipboardList, AlertCircle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AiAssist } from "@/components/ai-assist";

export const metadata = { title: "Messages & RFQs" };

const RFQ_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Pending",  color: "bg-amber-100 text-amber-700" },
  QUOTED:   { label: "Quoted",   color: "bg-blue-100 text-primary" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700" },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-700" },
};

export default async function MessagesPage() {
  const { seller } = await requireSellerSession();

  const threads = await db.messageThread.findMany({
    where: { sellerId: seller.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const unreadCount = threads.flatMap((t) => t.messages).filter((m) => !m.isRead && m.senderType === "BUYER").length;

  const rawRfqs = await db.rFQRequest.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { company: { select: { nameEn: true } }, items: { take: 1, select: { nameEn: true } }, _count: { select: { items: true } } },
  });
  const NORMALIZE: Record<string, string> = {
    SUBMITTED: "PENDING", UNDER_REVIEW: "PENDING", DRAFT: "PENDING",
    QUOTED: "QUOTED", NEGOTIATING: "QUOTED",
    ACCEPTED: "ACCEPTED", REJECTED: "DECLINED", EXPIRED: "DECLINED", CANCELLED: "DECLINED",
  };
  const fmtD = (d: Date | null) => (d ? format(d, "MMM d, yyyy") : "—");
  const rfqInbox = rawRfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    buyerCompany: r.company?.nameEn ?? "Direct buyer",
    description: r.items[0]?.nameEn ?? `${r._count.items} item${r._count.items !== 1 ? "s" : ""}`,
    status: NORMALIZE[r.status] ?? "PENDING",
    receivedAt: format(r.createdAt, "MMM d, yyyy"),
    dueBy: fmtD(r.requiredBy),
  }));
  const pendingRfqs = rfqInbox.filter((r) => r.status === "PENDING");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} unreadMessages={unreadCount}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Messages & RFQs</h1>
            <p className="text-sm text-muted-foreground">RFQ requests from buyers and message threads</p>
          </div>
          <div className="flex items-center gap-2">
            {pendingRfqs.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl font-medium">
                <AlertCircle className="h-4 w-4" />
                {pendingRfqs.length} need response
              </div>
            )}
            <AiAssist kind="rfq" label="AI draft reply" seed={pendingRfqs[0]?.description ?? ""} />
          </div>
        </div>

        {/* RFQ Inbox */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">RFQ Inbox</h2>
            {pendingRfqs.length > 0 && (
              <span className="ms-auto flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingRfqs.length} pending
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {rfqInbox.map((rfq) => {
              const sc = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.PENDING!;
              const isPending = rfq.status === "PENDING";
              return (
                <div key={rfq.id} className={`flex items-start justify-between px-5 py-4 hover:bg-slate-50 transition-colors ${isPending ? "bg-amber-50/40" : ""}`}>
                  <div className="flex-1 min-w-0 pe-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground font-semibold">{rfq.rfqNumber}</span>
                      {isPending && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Needs Response</span>}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{rfq.buyerCompany}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{rfq.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Received: {rfq.receivedAt}</span>
                      <span className="font-medium text-muted-foreground">Due: {rfq.dueBy}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                    {isPending ? (
                      <Link href={`/quotes/submit?rfq=${rfq.id}`}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-1">
                        Submit Quote <ChevronRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <button type="button" className="text-xs text-primary hover:underline font-medium">View Quote</button>
                    )}
                  </div>
                </div>
              );
            })}
            {rfqInbox.length === 0 && (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No RFQ requests yet</p>
                <p className="text-sm">RFQs assigned to you will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Message threads */}
        <div>
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Message Threads {unreadCount > 0 && <span className="ms-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount} new</span>}
          </h2>
          {threads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center">
              <MessageSquare className="h-10 w-10 mx-auto text-slate-200 mb-3" />
              <p className="font-semibold text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">Buyer messages and support threads appear here.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {threads.map((thread) => {
                const lastMsg = thread.messages[0];
                const hasUnread = lastMsg && !lastMsg.isRead && lastMsg.senderType === "BUYER";
                return (
                  <div key={thread.id} className={`p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${hasUnread ? "bg-blue-50/40" : ""}`}>
                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="font-semibold text-sm">{thread.subject ?? "Inquiry"}</p>
                        <span className="text-xs text-muted-foreground">{lastMsg ? format(lastMsg.createdAt, "MMM d") : ""}</span>
                      </div>
                      {lastMsg && <p className="text-sm text-muted-foreground truncate">{lastMsg.body.substring(0, 100)}</p>}
                      {hasUnread && (
                        <span className="inline-block text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full mt-1 font-medium">New message</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
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
