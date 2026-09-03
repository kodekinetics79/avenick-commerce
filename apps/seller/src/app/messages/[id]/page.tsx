import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Building2, FileText, Lock, MessageSquare, Package } from "lucide-react";
import { isRecordId } from "@avenick/utils";
import {
  countSellerUnreadMessages,
  getSellerThread,
  markThreadRead,
  MESSAGE_BODY_MAX_LENGTH,
  sellerRfqPosture,
  SELLER_MESSAGING_PERMISSION,
} from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";
import { ReplyForm } from "./reply-form";

export const metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

const RFQ_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Open",
  UNDER_REVIEW: "Under review",
  QUOTED: "Quoted",
  NEGOTIATING: "Negotiating",
  ACCEPTED: "Accepted",
  REJECTED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export default async function SellerThreadPage({ params }: { params: { id: string } }) {
  // params.id is URL-decoded by Next; the same record-id guard the quote pages
  // use keeps anything that is not a record id out of the query entirely.
  if (!isRecordId(params.id)) notFound();
  const { seller, membership, userId, userRole } = await requireSellerPermission(SELLER_MESSAGING_PERMISSION);

  // Scoped lookup: a thread that belongs to another seller is a 404, not a
  // "forbidden" — the id must not leak that the conversation exists.
  const thread = await getSellerThread(params.id, seller.id);
  if (!thread) notFound();

  if (thread.unreadCount > 0) {
    // Opening the conversation is the read receipt. The service re-checks the
    // member inside its transaction; the page already passed the same check,
    // so a failure here means the grant changed mid-request — render the
    // conversation anyway (reading is what the page is for) and leave the
    // badge honest rather than hide the thread.
    await markThreadRead(thread.id, seller.id, userId).catch(() => 0);
  }
  const unreadElsewhere = await countSellerUnreadMessages(seller.id);

  const canQuote = sellerHasPermission({ user: { role: userRole }, membership }, "quotes.submit");
  const rfq = thread.rfq;
  const rfqPosture = rfq ? sellerRfqPosture(rfq, seller.id) : null;
  // /quotes?rfq= only forwards to the per-RFQ page for a member holding
  // quotes.submit; without it the seller lands on the unfiltered history list.
  // Send each reader where they will actually arrive, and label it that way.
  const rfqHref =
    rfq && rfqPosture === "quoted"
      ? canQuote
        ? `/quotes?rfq=${encodeURIComponent(rfq.id)}`
        : "/quotes"
      : rfq && rfqPosture === "open" && canQuote
        ? `/quotes/submit?rfq=${encodeURIComponent(rfq.id)}`
        : null;

  const buyerLabel = thread.buyer?.displayName ?? "Buyer";
  const senderLabel = (m: (typeof thread.messages)[number]) => {
    switch (m.senderType) {
      case "BUYER":
        return buyerLabel;
      case "SELLER":
        return `${m.sender.firstName} ${m.sender.lastName}`.trim() || "Your team";
      case "ADMIN":
        return "Platform team";
      default:
        return "System";
    }
  };

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} unreadMessages={unreadElsewhere} permissions={membership.permissions}>
      <div className="space-y-6 max-w-3xl">
        <div>
          <Link href="/messages" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Messages & RFQs
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{thread.subject ?? "Inquiry"}</h1>
              <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span>{buyerLabel}</span>
                {thread.buyer?.companyName && (
                  <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {thread.buyer.companyName}</span>
                )}
                <span>· Opened {format(thread.createdAt, "MMM d, yyyy")}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {thread.isOpen ? (
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">Open</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> Closed</span>
              )}
            </div>
          </div>
        </div>

        {(rfq || thread.order) && (
          <div className="flex flex-wrap gap-2">
            {rfq && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-semibold">{rfq.rfqNumber}</span>
                <span className="text-xs text-muted-foreground">{RFQ_STATUS_LABEL[rfq.status] ?? rfq.status}</span>
                {rfqHref && (
                  <Link href={rfqHref} className="text-xs text-primary hover:underline font-medium">
                    {rfqPosture === "quoted" ? (canQuote ? "View quote" : "Quote history") : "Quote this RFQ"}
                  </Link>
                )}
                {rfqPosture === "open" && !canQuote && (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1" title="Ask your seller owner for the quotes.submit permission">
                    <Lock className="h-3 w-3" /> Quoting needs the quotes.submit permission
                  </span>
                )}
              </div>
            )}
            {thread.order && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-semibold">{thread.order.orderNumber}</span>
                {thread.order.sellerHasLines ? (
                  <Link href={`/orders/${encodeURIComponent(thread.order.id)}`} className="text-xs text-primary hover:underline font-medium">View order</Link>
                ) : (
                  <span className="text-xs text-muted-foreground">No lines of yours on this order</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Conversation</h2>
            <span className="ms-auto text-xs text-muted-foreground">{thread.messages.length} message{thread.messages.length === 1 ? "" : "s"}</span>
          </div>
          {thread.messages.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No messages on this thread yet.</div>
          ) : (
            <ol className="p-5 space-y-3">
              {thread.messages.map((m) => {
                const mine = m.senderType === "SELLER";
                return (
                  <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${mine ? "bg-primary/10" : "bg-secondary/60"}`}>
                      <p className="text-xs text-muted-foreground mb-1">
                        <span className="font-semibold text-foreground">{senderLabel(m)}</span> · {format(m.createdAt, "MMM d, yyyy HH:mm")}
                      </p>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.attachments.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {m.attachments.length} attachment{m.attachments.length === 1 ? "" : "s"} — attachment viewing is not available in this portal yet.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-sm mb-3">Reply</h2>
          <ReplyForm threadId={thread.id} isOpen={thread.isOpen} hasRfq={rfq !== null} maxLength={MESSAGE_BODY_MAX_LENGTH} />
        </div>
      </div>
    </SellerLayout>
  );
}
