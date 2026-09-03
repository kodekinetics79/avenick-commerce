import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { Building2, FileText, Lock, Package } from "lucide-react";
import { isRecordId } from "@avenick/utils";
import {
  countSellerUnreadMessages,
  getSellerThread,
  markThreadRead,
  MESSAGE_BODY_MAX_LENGTH,
  sellerRfqPosture,
  SELLER_MESSAGING_PERMISSION,
} from "@avenick/database";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  PageHeader,
  SectionHeader,
  StatusPill,
  Surface,
} from "@avenick/ui";
import { SellerLayout } from "@/components/layout/seller-layout";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";
import { ReplyForm } from "./reply-form";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("thread.metaTitle") };
}
export const dynamic = "force-dynamic";

// The RFQ enum values this page knows a label for. The KEYS are the Prisma
// enum and are never translated; the labels live under sellerRelations.rfqStatus.
const KNOWN_RFQ_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "NEGOTIATING",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export default async function SellerThreadPage({ params }: { params: { id: string } }) {
  // params.id is URL-decoded by Next; the same record-id guard the quote pages
  // use keeps anything that is not a record id out of the query entirely.
  if (!isRecordId(params.id)) notFound();
  const { seller, membership, userId, userRole } = await requireSellerPermission(SELLER_MESSAGING_PERMISSION);
  const t = await getTranslations("sellerRelations");

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

  const buyerLabel = thread.buyer?.displayName ?? t("thread.buyer");
  const senderLabel = (m: (typeof thread.messages)[number]) => {
    switch (m.senderType) {
      case "BUYER":
        return buyerLabel;
      case "SELLER":
        return `${m.sender.firstName} ${m.sender.lastName}`.trim() || t("thread.yourTeam");
      case "ADMIN":
        return t("thread.platformTeam");
      default:
        return t("thread.system");
    }
  };

  const subject = thread.subject ?? t("common.inquiry");
  const messageCount = thread.messages.length;

  // Group the thread by calendar day so the conversation carries a dateline per
  // day rather than repeating the full date on every bubble. The messages come
  // back ascending, so a single pass preserves their order exactly.
  const days: Array<{ key: string; label: string; items: typeof thread.messages }> = [];
  for (const m of thread.messages) {
    const label = format(m.createdAt, "EEEE, MMM d, yyyy");
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(m);
    else days.push({ key: m.id, label, items: [m] });
  }

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} unreadMessages={unreadElsewhere} permissions={membership.permissions}>
      <div className="max-w-3xl space-y-block">
        <PageHeader
          breadcrumbs={[{ label: t("inbox.title"), href: "/messages" }, { label: subject }]}
          linkComponent={Link}
          title={subject}
          dateline={t("thread.openedDateline", {
            date: format(thread.createdAt, "MMM d, yyyy"),
            count: messageCount,
            n: String(messageCount),
          })}
          actions={
            thread.isOpen ? (
              <StatusPill tone="success" dot>
                {t("thread.open")}
              </StatusPill>
            ) : (
              <StatusPill tone="neutral">
                <Lock className="h-3 w-3" aria-hidden="true" /> {t("common.closed")}
              </StatusPill>
            )
          }
        />

        {/* Who this conversation is with. Recessed, because it is context. */}
        <FieldWell className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
          <span className="u-ui font-medium text-ink-1">{buyerLabel}</span>
          {thread.buyer?.companyName && (
            <span className="u-meta inline-flex items-center gap-1.5 text-ink-2">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {thread.buyer.companyName}
            </span>
          )}
        </FieldWell>

        {/* What the conversation hangs off — also context, so also recessed. */}
        {(rfq || thread.order) && (
          <FieldWell className="divide-y divide-hairline">
            {rfq && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                <Eyebrow className="me-1">{t("thread.request")}</Eyebrow>
                <span className="u-mono u-ui font-medium text-ink-1">{rfq.rfqNumber}</span>
                <StatusPill tone="neutral">
                  {(KNOWN_RFQ_STATUSES as readonly string[]).includes(rfq.status)
                    ? t(`rfqStatus.${rfq.status}`)
                    : rfq.status}
                </StatusPill>
                {rfqHref && (
                  <Button variant="link" size="sm" asChild className="ms-auto">
                    <Link href={rfqHref}>
                      {rfqPosture === "quoted"
                        ? canQuote
                          ? t("inbox.row.viewQuote")
                          : t("inbox.row.quoteHistory")
                        : t("inbox.row.quoteThisRfq")}
                    </Link>
                  </Button>
                )}
                {/* The gate is stated in the row, not in a title attribute that
                    no keyboard or touch reader can reach. */}
                {rfqPosture === "open" && !canQuote && (
                  <span className="u-meta ms-auto inline-flex items-center gap-1 text-ink-3">
                    <Lock className="h-3 w-3" aria-hidden="true" /> {t("thread.quotingNeedsPermission", { permission: "quotes.submit" })}
                  </span>
                )}
              </div>
            )}
            {thread.order && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <Package className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                <Eyebrow className="me-1">{t("thread.order")}</Eyebrow>
                <span className="u-mono u-ui font-medium text-ink-1">{thread.order.orderNumber}</span>
                {thread.order.sellerHasLines ? (
                  <Button variant="link" size="sm" asChild className="ms-auto">
                    <Link href={`/orders/${encodeURIComponent(thread.order.id)}`}>{t("thread.viewOrder")}</Link>
                  </Button>
                ) : (
                  <span className="u-meta ms-auto text-ink-3">{t("thread.noLinesOfYours")}</span>
                )}
              </div>
            )}
          </FieldWell>
        )}

        {/* The conversation itself: a recessed well the messages sit on, so a
            message reads as a thing said rather than as another page panel. */}
        <section aria-label={t("thread.conversation")}>
          <SectionHeader title={t("thread.conversation")} count={messageCount} />
          {messageCount === 0 ? (
            <Surface rung={1}>
              <EmptyState
                eyebrow={t("common.nothingRecorded")}
                headline={t("thread.empty.headline")}
                body={t("thread.empty.body")}
              />
            </Surface>
          ) : (
            <Surface rung={1} className="px-4 py-4">
              <div className="space-y-4">
                {days.map((day) => (
                  <div key={day.key}>
                    {/* The day rule, not a date stamped on every bubble. */}
                    <div className="flex items-center gap-3 pb-3">
                      <span className="h-px flex-1 bg-hairline" />
                      <span className="u-micro text-ink-3">{day.label}</span>
                      <span className="h-px flex-1 bg-hairline" />
                    </div>
                    <ol className="space-y-2">
                      {day.items.map((m, i) => {
                        const prev = i > 0 ? day.items[i - 1] : null;
                        const label = senderLabel(m);
                        // Consecutive messages in the same voice do not repeat
                        // the name — that is what makes a list of rows read as a
                        // conversation rather than as an audit log.
                        const showSender = !prev || senderLabel(prev) !== label;
                        const mine = m.senderType === "SELLER";
                        return (
                          <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                            <Surface rung={2} tone={mine ? "accent" : "default"} className="max-w-[85%] px-4 py-2.5">
                              {showSender && (
                                <Eyebrow tone={mine ? "accent" : "muted"} className="mb-1">
                                  {label}
                                </Eyebrow>
                              )}
                              <p className="u-body whitespace-pre-wrap break-words text-ink-1">{m.body}</p>
                              <p className="u-meta mt-1 text-ink-3">{format(m.createdAt, "HH:mm")}</p>
                              {m.attachments.length > 0 && (
                                <Dateline className="mt-2">
                                  {t("thread.attachmentsUnavailable", {
                                    count: m.attachments.length,
                                    n: String(m.attachments.length),
                                  })}
                                </Dateline>
                              )}
                            </Surface>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            </Surface>
          )}
        </section>

        <Surface rung={2} className="p-5">
          <SectionHeader title={t("thread.replyHeading")} className="mb-3" />
          <ReplyForm threadId={thread.id} isOpen={thread.isOpen} hasRfq={rfq !== null} maxLength={MESSAGE_BODY_MAX_LENGTH} />
        </Surface>
      </div>
    </SellerLayout>
  );
}
