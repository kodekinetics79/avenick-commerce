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
import { cn } from "@avenick/utils";
import {
  Button,
  buttonVariants,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { format } from "date-fns";
import { AlertCircle, ChevronRight, Clock, FileText, Inbox, Lock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { AiAssist } from "@/components/ai-assist";

export const metadata = { title: "Messages & RFQs" };
export const dynamic = "force-dynamic";

// Enum → label map, plus the semantic tone the pill is drawn in. Tones are the
// four states the system defines, not ten hues: a status that carries no
// urgency is neutral, and only "the buyer is waiting on you" is warning.
const RFQ_STATUS: Record<string, { label: string; tone: PillTone }> = {
  DRAFT:        { label: "Draft",        tone: "neutral" },
  SUBMITTED:    { label: "Open",         tone: "warning" },
  UNDER_REVIEW: { label: "Under review", tone: "warning" },
  QUOTED:       { label: "Quoted",       tone: "primary" },
  NEGOTIATING:  { label: "Negotiating",  tone: "primary" },
  ACCEPTED:     { label: "Accepted",     tone: "success" },
  REJECTED:     { label: "Declined",     tone: "danger" },
  EXPIRED:      { label: "Expired",      tone: "neutral" },
  CANCELLED:    { label: "Cancelled",    tone: "neutral" },
};

/**
 * The trigger for the draft assistant. <AiAssist> takes a class string rather
 * than a component, so the class comes from buttonVariants instead of being
 * hand-written: a second copy of the button recipe is a second thing to keep in
 * step with the primitive, and it is exactly how a portal grows its own dialect.
 * The height is applied here because <Button> sets it as an inline style.
 */
const ASSIST_TRIGGER = cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-control-sm");

interface RfqRowView {
  id: string;
  rfqNumber: string;
  status: string;
  buyerCompany: string;
  description: string;
  receivedAt: string;
  dueBy: string;
  posture: ReturnType<typeof sellerRfqPosture>;
}

/**
 * One request in the inbox.
 *
 * The 3px inline-start rule is the whole "needs a response" signal: it is
 * always present and only ever changes colour, so nothing reflows between a
 * pending row and a settled one, and it is correct in Arabic by construction.
 */
function RfqRow({ rfq, canQuote }: { rfq: RfqRowView; canQuote: boolean }) {
  // A status this map does not know is shown as its raw enum name rather than
  // relabelled "Open" — a wrong label would invite a response the RFQ may not
  // be waiting for.
  const sc = RFQ_STATUS[rfq.status] ?? { label: rfq.status, tone: "neutral" as PillTone };
  const isPending = rfq.posture === "open";
  // Ids come from the database, not the URL, but the same encode discipline as
  // the quote pages keeps the link builder safe if the id scheme ever widens.
  const rfqParam = encodeURIComponent(rfq.id);

  return (
    <li
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-s-[3px] px-4 py-3",
        isPending ? "border-warning" : "border-transparent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="u-mono u-micro text-ink-3">{rfq.rfqNumber}</span>
          <StatusPill tone={sc.tone}>{sc.label}</StatusPill>
        </div>
        <p className="u-ui mt-1 font-medium text-ink-1">{rfq.buyerCompany}</p>
        <p className="u-meta line-clamp-1 text-ink-2">{rfq.description}</p>
        <p className="u-meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" /> Received {rfq.receivedAt}
          </span>
          <span>Due {rfq.dueBy}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* /quotes?rfq= forwards to the RFQ page only for a member holding
            quotes.submit; everyone else lands on the history list. Name the
            destination each reader will actually get rather than promising a
            per-RFQ view to a viewer. */}
        {rfq.posture === "quoted" && (
          <Button variant="link" size="sm" asChild>
            <Link href={canQuote ? `/quotes?rfq=${rfqParam}` : "/quotes"}>
              {canQuote ? "View quote" : "Quote history"}
              <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        )}
        {rfq.posture === "open" && canQuote && (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/quotes/submit?rfq=${rfqParam}`}>
              Quote this RFQ
              <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </Button>
        )}
        {/* A member without quotes.submit gets no control here and no repeated
            apology: the gate is stated once, above the group, where it applies
            to every row in it. It is never hidden in a title attribute, which
            neither a keyboard nor a touch reader can reach.
            "closed" posture: the status badge is the whole story; no control. */}
      </div>
    </li>
  );
}

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
  const rfqInbox: RfqRowView[] = rawRfqs.map((r) => ({
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
  // Presentation-only partition: the rows are unchanged and their order within
  // each group is the order the query returned. What changes is that a supplier
  // scanning this page cannot miss the requests still waiting on them.
  const settledRfqs = rfqInbox.filter((r) => r.posture !== "open");
  const quotedRfqs = rfqInbox.filter((r) => r.posture === "quoted");
  const rfqCapped = rawRfqs.length >= SELLER_RFQ_INBOX_LIMIT;
  const threadsCapped = threads.length >= THREAD_INBOX_LIMIT;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} unreadMessages={unreadCount} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Sourcing"
          title="Messages & RFQs"
          description="Requests for quotation from buyers, and the threads those buyers opened with you."
          dateline="Open requests no supplier has claimed, plus every request assigned to this account"
          actions={<AiAssist kind="rfq" label="AI draft reply" seed={pendingRfqs[0]?.description ?? ""} buttonClass={ASSIST_TRIGGER} />}
        />

        <section aria-label="RFQ inbox" className="space-y-4">
          {/* One panel divided by hairlines rather than three floating tiles.
              The counts describe the rows below, which is why the dateline
              names the cap instead of leaving a full page to read as "all". */}
          <CellGrid cols={{ base: 1, sm: 3 }} density="compact">
            <Stat
              label="Awaiting your quote"
              value={pendingRfqs.length}
              rank="section"
              icon={AlertCircle}
              chip={pendingRfqs.length > 0 ? "warning" : "neutral"}
            />
            <Stat label="Quoted by you" value={quotedRfqs.length} icon={FileText} chip="neutral" />
            <Stat label="Requests listed" value={rfqInbox.length} icon={Inbox} chip="neutral" />
          </CellGrid>
          {rfqCapped && (
            <Dateline>
              Counts describe the {SELLER_RFQ_INBOX_LIMIT} newest of {rfqTotal} requests listed here; older ones are
              not listed yet.
            </Dateline>
          )}

          {rfqInbox.length === 0 ? (
            <Surface rung={1}>
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No requests for quotation have reached this account."
                body="Open RFQs and RFQs assigned to you appear here as buyers submit them."
              />
            </Surface>
          ) : (
            <div className="space-y-4">
              {pendingRfqs.length > 0 && (
                <div>
                  <Eyebrow as="h2" className="mb-2">Awaiting your quote — {pendingRfqs.length}</Eyebrow>
                  {/* Stated once for the whole group, as a fact about this
                      account rather than as fine print under each row. */}
                  {!canQuote && (
                    <FieldWell className="mb-2 flex items-start gap-2 px-3 py-2">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                      <p className="u-meta text-ink-2">
                        Your role can read these requests but not quote them. Ask a seller owner for the quotes.submit
                        permission.
                      </p>
                    </FieldWell>
                  )}
                  <Surface rung={1} className="overflow-hidden">
                    <ul className="divide-y divide-hairline">
                      {pendingRfqs.map((rfq) => (
                        <RfqRow key={rfq.id} rfq={rfq} canQuote={canQuote} />
                      ))}
                    </ul>
                  </Surface>
                </div>
              )}

              {settledRfqs.length > 0 && (
                <div>
                  <Eyebrow as="h2" className="mb-2">Quoted, declined or closed — {settledRfqs.length}</Eyebrow>
                  <Surface rung={1} className="overflow-hidden">
                    <ul className="divide-y divide-hairline">
                      {settledRfqs.map((rfq) => (
                        <RfqRow key={rfq.id} rfq={rfq} canQuote={canQuote} />
                      ))}
                    </ul>
                  </Surface>
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-label="Message threads" className="space-y-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <Eyebrow as="h2">Message threads — {threads.length}</Eyebrow>
            {unreadCount > 0 && (
              <StatusPill tone="primary" dot>
                {unreadCount} unread
              </StatusPill>
            )}
          </div>
          {threadsCapped && (
            <Dateline>
              The {THREAD_INBOX_LIMIT} most recently active threads; older threads are not listed here yet.
            </Dateline>
          )}

          {threads.length === 0 ? (
            <Surface rung={1}>
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No buyer has opened a conversation with you yet."
                body="Buyer messages and support threads appear here as they are raised."
                icon={<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </Surface>
          ) : (
            <Surface rung={1} className="overflow-hidden">
              <ul className="divide-y divide-hairline">
                {threads.map((thread) => {
                  const lastMsg = thread.messages[0];
                  const unread = thread._count.messages;
                  return (
                    <li key={thread.id}>
                      <Link
                        href={`/messages/${encodeURIComponent(thread.id)}`}
                        className={cn(
                          "u-focus flex items-start gap-3 border-s-[3px] px-4 py-3",
                          "transition-colors duration-press ease-standard hover:bg-ink-1/[0.03]",
                          unread > 0 ? "border-primary" : "border-transparent",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="u-ui truncate font-medium text-ink-1">{thread.subject ?? "Inquiry"}</p>
                            <span className="u-meta shrink-0 text-ink-3">
                              {lastMsg ? format(lastMsg.createdAt, "MMM d") : ""}
                            </span>
                          </div>
                          {lastMsg && (
                            <p className="u-meta truncate text-ink-2">
                              {lastMsg.senderType === "SELLER" ? "You: " : ""}
                              {lastMsg.body.substring(0, 100)}
                            </p>
                          )}
                          {(unread > 0 || !thread.isOpen) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              {unread > 0 && (
                                <StatusPill tone="primary" dot>
                                  {unread} new
                                </StatusPill>
                              )}
                              {!thread.isOpen && (
                                <StatusPill tone="neutral">
                                  <Lock className="h-3 w-3" aria-hidden="true" /> Closed
                                </StatusPill>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-3 rtl:rotate-180" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Surface>
          )}
        </section>
      </div>
    </SellerLayout>
  );
}
