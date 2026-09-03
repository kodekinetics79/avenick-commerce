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
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  PageHeader,
  Num,
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
  /**
   * How the buyer's own required-by date stands against today, or null when the
   * request carries no such date.
   *
   * This is presentation of a stored column, not a service level: the platform
   * publishes no response-time commitment, so the wording is "the date the buyer
   * asked for has passed", never "overdue" and never "late". `days` is whole
   * CALENDAR days from today, computed against the same clock for every row on
   * the page, so the day the buyer asked for reads as today rather than as past.
   */
  due: { days: number; passed: boolean } | null;
  posture: ReturnType<typeof sellerRfqPosture>;
}

/**
 * Whole CALENDAR days from today to a required-by day. One clock for the whole
 * render, and the comparison is day-to-day rather than instant-to-instant.
 *
 * That distinction is the whole of it. RFQRequest.requiredBy is written from an
 * `<input type="date">` on the buyer's side — `new Date("2026-09-03")`, which is
 * UTC MIDNIGHT of the chosen day. Comparing it against `now` as an instant makes
 * every request stamped "past the date the buyer asked for" from the small hours
 * of the very day the buyer asked for, in danger red, while the same row prints
 * that date as today directly beneath. It also made the "Required today" case
 * unreachable, which is the case a supplier most needs to see.
 *
 * Both dates are reduced to their local calendar day — the same local reading
 * date-fns uses to PRINT them a line above, so the badge and the date can never
 * disagree — and rounded rather than floored so a DST shift cannot move a day.
 */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function daysUntil(target: Date, now: Date): number {
  return Math.round((startOfLocalDay(target) - startOfLocalDay(now)) / 86_400_000);
}

/** One day count, one derived reading — so the badge and the rule cannot diverge. */
function passedOrDue(days: number): { days: number; passed: boolean } {
  return { days, passed: days < 0 };
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

  /**
   * The buyer's own required-by date, read against today. It is shown only on a
   * request still open to a quote — on a settled row the date is history and
   * marking it "passed" would be scolding a supplier for something already done.
   *
   * Wording is deliberate: "required by … — that date has passed" states the
   * record. "Overdue" and "late" would imply a commitment the platform has never
   * published, which is the same class of claim as an invented response time.
   */
  const due = isPending ? rfq.due : null;

  return (
    <li
      className={cn(
        "u-state-wash flex flex-wrap items-start justify-between gap-3 border-s-[3px] px-4 py-3",
        // Always 3px, only the colour changes, so a request whose date has passed
        // cannot be a different width from one that has not. Danger is reserved
        // for the passed case; open-but-in-time is the warning it always was.
        isPending ? (due?.passed ? "border-danger" : "border-warning") : "border-transparent",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="u-mono u-micro text-ink-3">{rfq.rfqNumber}</span>
          <StatusPill tone={sc.tone}>{sc.label}</StatusPill>
          {due?.passed && (
            <StatusPill tone="danger">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Required-by date passed
            </StatusPill>
          )}
          {due && !due.passed && due.days <= 2 && (
            <StatusPill tone="warning">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {due.days === 0 ? "Required today" : due.days === 1 ? "Required tomorrow" : `Required in ${due.days} days`}
            </StatusPill>
          )}
        </div>
        <p className="u-ui mt-1 font-medium text-ink-1">{rfq.buyerCompany}</p>
        <p className="u-meta line-clamp-1 text-ink-2">{rfq.description}</p>
        <Dateline className="mt-1">
          Received {rfq.receivedAt} · buyer required by {rfq.dueBy}
        </Dateline>
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

  // One clock for the whole render, so every row's required-by reading is taken
  // at the same instant.
  const now = new Date();
  const fmtD = (d: Date | null) => (d ? format(d, "MMM d, yyyy") : "not stated");
  const rfqInbox: RfqRowView[] = rawRfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    status: r.status,
    buyerCompany: r.company?.nameEn ?? "Direct buyer",
    description: r.items[0]?.nameEn ?? `${r.items.length} item${r.items.length !== 1 ? "s" : ""}`,
    receivedAt: format(r.createdAt, "MMM d, yyyy"),
    dueBy: fmtD(r.requiredBy),
    // Null when the request carries no required-by date, which is a real state:
    // a buyer is not obliged to name one, and inventing a window for them would
    // be exactly the kind of fiction this codebase spent a programme removing.
    // `passed` is derived from the same day count, never from an instant
    // comparison: a date is past when its DAY is behind today, not when its
    // UTC-midnight timestamp is behind this second.
    due: r.requiredBy ? passedOrDue(daysUntil(r.requiredBy, now)) : null,
    posture: sellerRfqPosture(r, seller.id),
  }));
  const pendingRfqs = rfqInbox.filter((r) => r.posture === "open");
  // Counted from the same rows the list below renders, so the masthead figure can
  // never claim a number the page cannot show.
  const pastDueRfqs = pendingRfqs.filter((r) => r.due?.passed);
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
          {/* ══ NEEDS RESPONSE, AT SCALE ══
              This was three equal cells: "awaiting your quote", "quoted by you"
              and "requests listed", all the same size, so the one number a
              supplier opens this page for sat beside two that merely describe the
              list. It is now the page's one large figure — hero rank, 46px
              against 12px metadata — and the two counts that qualify it are
              metadata beside it, which is what "qualify" is supposed to look
              like.

              Both figures are counted from the rows rendered below, so the
              masthead can never claim a number the page cannot show; where the
              inbox is capped the dateline says so rather than letting a full page
              read as "all".

              The ruling sits on an inner element rather than on the plate: the
              shoulder and the ruling are both drawn by a ::before, and an element
              has only one, so `rim` and [data-rule-ground] on the same node lose
              the shoulder silently. */}
          <Surface rung={2} rim className="overflow-hidden">
            <div data-rule-ground="" className="p-5 [&>*]:relative">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="min-w-0">
                  <Eyebrow className="flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    Awaiting your quote
                  </Eyebrow>
                  <div className="mt-1">
                    <Num value={pendingRfqs.length} rank="hero" />
                  </div>
                  {pastDueRfqs.length > 0 && (
                    <StatusPill tone="danger" className="mt-2">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {pastDueRfqs.length} past the date the buyer asked for
                    </StatusPill>
                  )}
                </div>

                {/* The qualifying counts, as metadata rather than as peers. */}
                <dl className="flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <dt>
                      <Eyebrow className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        Quoted by you
                      </Eyebrow>
                    </dt>
                    <dd className="mt-0.5">
                      <Num value={quotedRfqs.length} />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Eyebrow className="flex items-center gap-1.5">
                        <Inbox className="h-3 w-3" aria-hidden="true" />
                        Requests listed
                      </Eyebrow>
                    </dt>
                    <dd className="mt-0.5">
                      <Num value={rfqInbox.length} />
                    </dd>
                  </div>
                </dl>
              </div>

              <Dateline className="mt-3">
                {rfqCapped
                  ? `Counted from the ${SELLER_RFQ_INBOX_LIMIT} newest of ${rfqTotal} requests visible to this account; older ones are not listed yet · the platform publishes no response-time commitment, so a required-by date is the buyer's own and nothing here is a service level`
                  : "Counted from the requests listed below · the platform publishes no response-time commitment, so a required-by date is the buyer's own and nothing here is a service level"}
              </Dateline>
            </div>
          </Surface>

          {rfqInbox.length === 0 ? (
            // The certificate, because this is the page's primary empty region
            // and it is the surface a new supplier looks at longest. It says what
            // the inbox actually contains — open unclaimed requests plus this
            // account's own — and gives the one real thing there is to do while
            // it is empty, which is to make the catalogue findable.
            <EmptyState
              variant="certificate"
              glyph={<Inbox />}
              eyebrow="Nothing recorded"
              headline="No request for quotation has reached this account."
              body="This inbox holds every open request no supplier has claimed, plus every request assigned to you. Nothing is being withheld and nothing is queued behind a filter — no buyer has submitted one that reaches this account yet."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/products">Review your listings</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {pendingRfqs.length > 0 && (
                <div>
                  {/* The count lives in the masthead above at hero rank;
                      repeating it in the group heading is how a figure stops
                      reading as the answer and starts reading as decoration. */}
                  <Eyebrow as="h2" className="mb-2">Awaiting your quote</Eyebrow>
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

              {/* Settled requests fold away. They are the majority of a working
                  inbox and none of them wants anything, so leaving them expanded
                  buries the rows that do — the single reason "needs response" was
                  missable here. <details>/<summary> means this costs no client
                  component, keeps the rows in the DOM for browser find-in-page,
                  and the chevron is drawn from two rotated borders so there is
                  nothing to mirror in Arabic. It opens by default only when there
                  is nothing waiting, so a supplier with a clear queue still lands
                  on something to read. */}
              {settledRfqs.length > 0 && (
                <Surface
                  rung={1}
                  as="details"
                  className="u-facet overflow-hidden px-4"
                  {...(pendingRfqs.length === 0 ? { open: true } : {})}
                >
                  <summary className="u-focus">
                    <Eyebrow as="span">Quoted, declined or closed — {settledRfqs.length}</Eyebrow>
                    <span className="u-facet__chev" aria-hidden="true" />
                  </summary>
                  <ul className="-mx-4 divide-y divide-hairline border-t border-hairline">
                    {settledRfqs.map((rfq) => (
                      <RfqRow key={rfq.id} rfq={rfq} canQuote={canQuote} />
                    ))}
                  </ul>
                </Surface>
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
            // The plain editorial blank, not a second certificate: the budget is
            // one composed plate per empty REGION, and two of them stacked on one
            // page is two objects competing to be the thing you look at.
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
