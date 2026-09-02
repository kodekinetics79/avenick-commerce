import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";
import {
  countSellerUnreadMessages,
  db,
  getRFQsForSeller,
  listSellerThreads,
  sellerRfqPosture,
  SELLER_MESSAGING_PERMISSION,
  SELLER_RFQ_INBOX_LIMIT,
  SELLER_RFQ_INBOX_WHERE,
  THREAD_INBOX_LIMIT,
} from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { format } from "date-fns";
import { MessageSquare, ClipboardList, AlertCircle, Clock, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { AiAssist } from "@/components/ai-assist";

export const metadata = { title: "Messages & RFQs" };
export const dynamic = "force-dynamic";

const RFQ_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:        { label: "Draft",        color: "bg-secondary text-muted-foreground" },
  SUBMITTED:    { label: "Open",         color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  UNDER_REVIEW: { label: "Under review", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  QUOTED:       { label: "Quoted",       color: "bg-primary/10 text-primary" },
  NEGOTIATING:  { label: "Negotiating",  color: "bg-primary/10 text-primary" },
  ACCEPTED:     { label: "Accepted",     color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  REJECTED:     { label: "Declined",     color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  EXPIRED:      { label: "Expired",      color: "bg-secondary text-muted-foreground" },
  CANCELLED:    { label: "Cancelled",    color: "bg-secondary text-muted-foreground" },
};

export default async function MessagesPage() {
  const { seller, membership, userRole } = await requireSellerPermission(SELLER_MESSAGING_PERMISSION);
  // The submit page requires quotes.submit. A member who only holds rfqs.view
  // is told so on the row instead of being sent to a page that throws.
  const canQuote = sellerHasPermission({ user: { role: userRole }, membership }, "quotes.submit");

  const [threads, unreadCount, rawRfqs, rfqTotal] = await Promise.all([
    listSellerThreads(seller.id),
    countSellerUnreadMessages(seller.id),
    // Same visibility as the quote pages: open unclaimed RFQs plus this
    // seller's own. The old query listed only claimed RFQs, so an inbox with
    // nothing to quote in it was the normal state.
    getRFQsForSeller(seller.id),
    // getRFQsForSeller returns the newest SELLER_RFQ_INBOX_LIMIT rows. The
    // count uses the same predicate, so the notice below can say how much of
    // the inbox is off-screen instead of letting a full page read as "all".
    db.rFQRequest.count({ where: SELLER_RFQ_INBOX_WHERE(seller.id) }),
  ]);

  const fmtD = (d: Date | null) => (d ? format(d, "MMM d, yyyy") : "—");
  const rfqInbox = rawRfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    status: r.status,
    buyerCompany: r.company?.nameEn ?? "Direct buyer",
    description: r.items[0]?.nameEn ?? `${r.items.length} item${r.items.length !== 1 ? "s" : ""}`,
    receivedAt: format(r.createdAt, "MMM d, yyyy"),
    dueBy: fmtD(r.requiredBy),
    posture: sellerRfqPosture(r, seller.id),
  }));
  const pendingRfqs = rfqInbox.filter((r) => r.posture === "open");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} unreadMessages={unreadCount} permissions={membership.permissions}>
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
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">RFQ Inbox</h2>
            {pendingRfqs.length > 0 && (
              <span className="ms-auto flex items-center gap-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingRfqs.length} pending
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            {rawRfqs.length >= SELLER_RFQ_INBOX_LIMIT && (
              <p className="px-5 py-2 text-xs text-muted-foreground bg-secondary/40">
                Showing the {SELLER_RFQ_INBOX_LIMIT} newest of {rfqTotal} requests; older ones are not listed here yet.
              </p>
            )}
            {rfqInbox.map((rfq) => {
              // A status this map does not know is shown as its raw enum name
              // rather than relabelled "Open" — a wrong label would invite a
              // response the RFQ may not be waiting for.
              const sc = RFQ_STATUS[rfq.status] ?? { label: rfq.status, color: "bg-secondary text-muted-foreground" };
              const isPending = rfq.posture === "open";
              // Ids come from the database, not the URL, but the same encode
              // discipline as the quote pages keeps the link builder safe if
              // the id scheme ever widens.
              const rfqParam = encodeURIComponent(rfq.id);
              return (
                <div key={rfq.id} className={`flex items-start justify-between px-5 py-4 hover:bg-muted/30 transition-colors ${isPending ? "bg-amber-500/5" : ""}`}>
                  <div className="flex-1 min-w-0 pe-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground font-semibold">{rfq.rfqNumber}</span>
                      {isPending && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Needs Response</span>}
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
                    {/* /quotes?rfq= forwards to the RFQ page only for a member
                        holding quotes.submit; everyone else lands on the history
                        list. Name the destination each reader will actually get
                        rather than promising a per-RFQ view to a viewer. */}
                    {rfq.posture === "quoted" && (
                      <Link href={canQuote ? `/quotes?rfq=${rfqParam}` : "/quotes"} className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                        {canQuote ? "View quote" : "Quote history"} <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {rfq.posture === "open" && canQuote && (
                      <Link href={`/quotes/submit?rfq=${rfqParam}`}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-1">
                        Quote this RFQ <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    {rfq.posture === "open" && !canQuote && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1" title="Ask your seller owner for the quotes.submit permission">
                        <Lock className="h-3 w-3" /> Quoting needs the quotes.submit permission
                      </span>
                    )}
                    {/* "closed" posture: the status badge is the whole story; no control. */}
                  </div>
                </div>
              );
            })}
            {rfqInbox.length === 0 && (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No RFQ requests yet</p>
                <p className="text-sm">Open RFQs and RFQs assigned to you will appear here.</p>
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
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">Buyer messages and support threads appear here.</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {threads.length >= THREAD_INBOX_LIMIT && (
                <p className="px-4 py-2 text-xs text-muted-foreground bg-secondary/40">
                  Showing the {THREAD_INBOX_LIMIT} most recently active threads; older threads are not listed here yet.
                </p>
              )}
              {threads.map((thread) => {
                const lastMsg = thread.messages[0];
                const unread = thread._count.messages;
                return (
                  <Link
                    key={thread.id}
                    href={`/messages/${encodeURIComponent(thread.id)}`}
                    className={`p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors ${unread > 0 ? "bg-primary/5" : ""}`}
                  >
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5 gap-2">
                        <p className="font-semibold text-sm truncate">{thread.subject ?? "Inquiry"}</p>
                        <span className="text-xs text-muted-foreground shrink-0">{lastMsg ? format(lastMsg.createdAt, "MMM d") : ""}</span>
                      </div>
                      {lastMsg && (
                        <p className="text-sm text-muted-foreground truncate">
                          {lastMsg.senderType === "SELLER" ? "You: " : ""}{lastMsg.body.substring(0, 100)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {unread > 0 && (
                          <span className="inline-block text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                            {unread} new
                          </span>
                        )}
                        {!thread.isOpen && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Closed</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
