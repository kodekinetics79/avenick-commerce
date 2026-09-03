import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle, XCircle, Clock, Store, MessageSquare, ClipboardList } from "lucide-react";
import {
  Button,
  Dateline,
  EmptyState,
  Eyebrow,
  FieldWell,
  LedgerTable,
  Num,
  PageHeader,
  StatusPill,
  Surface,
  TierMark,
} from "@avenick/ui";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import { RFQ_STATUS } from "@/components/b2b/rfq-status";
import { toneRule } from "@/components/b2b/rules";
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey, B2BT } from "@/components/b2b/messages";
import type { RFQStatus } from "@avenick/database";
import { RECORD_ID } from "@avenick/utils";
import { platformName } from "@avenick/utils/portal-config";
import { fetchB2BJson } from "@/lib/b2b";
import { acceptRFQQuote, rejectRFQQuote } from "../actions";

export async function generateMetadata() {
  return b2bMetadata("rfq.eyebrow");
}
export const dynamic = "force-dynamic";

/**
 * Who wrote a thread message, in the buyer's terms. The stored value is the
 * MessageSenderType enum, which read as "BUYER"/"SELLER" on the page. The
 * supplier is named when the RFQ has been routed to one; a platform message
 * is labelled with the configured platform name rather than "ADMIN", and an
 * automated one says so. Any value this page does not know is shown as a
 * neutral "Participant" instead of leaking the raw enum.
 */
function senderLabel(senderType: string, supplierName: string | null, t: B2BT): string {
  switch (senderType) {
    case "BUYER": return t("rfq.sender.you");
    case "SELLER": return supplierName ?? t("rfq.sender.supplier");
    case "ADMIN": return platformName();
    case "SYSTEM": return t("rfq.sender.automated", { platform: platformName() });
    default: return t("rfq.sender.participant");
  }
}

/**
 * Seller tiers, as stored. STANDARD is deliberately absent from the brass set:
 * brass has a hard ≤2% viewport budget and exactly three permitted uses, and a
 * gold award mark on every supplier — including one carrying the baseline tier —
 * is what turns a mark of distinction into wallpaper. A standard supplier's tier
 * is still stated; it is just stated in ink rather than in brass.
 */
const TIER_LABEL: Record<string, B2BKey> = {
  STANDARD: "rfq.tier.standard",
  VERIFIED: "rfq.tier.verified",
  GOLD: "rfq.tier.gold",
  PLATINUM: "rfq.tier.platinum",
};
const BRASS_TIERS = new Set(["VERIFIED", "GOLD", "PLATINUM"]);

export default async function RFQDetailPage({ params }: { params: { id: string } }) {
  type RFQDetail = {
    id: string;
    rfqNumber: string;
    status: RFQStatus;
    currency: string;
    notes: string | null;
    totalQuoted: string | number | null;
    quoteVersion: number;
    createdAt: string;
    requiredBy: string | null;
    seller: { businessNameEn: string; tier: string } | null;
    items: Array<{
      id: string;
      nameEn: string;
      notes: string | null;
      quantity: number;
      unitQuoted: string | number | null;
    }>;
    /** The LATEST messages on the thread, not the whole history. */
    messages: Array<{
      id: string;
      senderType: string;
      body: string;
      createdAt: string;
    }>;
    /** Count of every message on the thread; present when the API paginates. */
    messageTotal?: number;
  };
  // params.id is URL-decoded by Next, so a crafted link can deliver path
  // separators here — and fetchB2BJson forwards the caller's cookies, making an
  // unencoded value a confused-deputy primitive against other authenticated
  // routes. Validate the id shape, then encode it.
  if (!RECORD_ID.test(params.id)) notFound();

  let rfq: RFQDetail;
  try {
    rfq = await fetchB2BJson<RFQDetail>(`/api/b2b/rfqs/${encodeURIComponent(params.id)}`);
  } catch (error) {
    if (error instanceof Error && error.message === "RFQ not found") notFound();
    redirect("/b2b/register");
  }

  const { t, f } = await getB2B();
  const cfg = RFQ_STATUS[rfq.status];
  const quoted = rfq.status === "QUOTED" || rfq.status === "NEGOTIATING";
  const quotedTotal = rfq.totalQuoted ? Number(rfq.totalQuoted) : null;
  const tierLabel = (tier: string) => (TIER_LABEL[tier] ? t(TIER_LABEL[tier]!) : tier);

  return (
    <B2BShell>
      {/* The page used to paint its own slate ground and its own centred column
          inside the portal shell, which meant an RFQ looked like a different
          product from the list it was opened from. It is now one measure of
          reading width on the portal's own ground. */}
      <div className="max-w-3xl space-y-block">
        <PageHeader
          breadcrumbs={[{ label: t("rfq.breadcrumb"), href: "/b2b/quotes" }, { label: rfq.rfqNumber }]}
          eyebrow={t("rfq.eyebrow")}
          title={rfq.rfqNumber}
          dateline={
            rfq.requiredBy
              ? t("rfq.requiredBy", { date: f.date(rfq.createdAt), required: f.date(rfq.requiredBy) })
              : t("rfq.noRequiredBy", { date: f.date(rfq.createdAt) })
          }
          actions={<StatusPill tone={cfg.tone}>{t(cfg.labelKey)}</StatusPill>}
          linkComponent={Link}
        />

        {rfq.notes && (
          <FieldWell padded>
            <Eyebrow className="mb-1">{t("rfq.notes")}</Eyebrow>
            <p className="u-body whitespace-pre-line text-ink-1">{rfq.notes}</p>
          </FieldWell>
        )}

        <Surface rung={2} className="flex items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-2">
            <Store className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            {rfq.seller ? (
              <>
                <p className="u-ui font-medium text-ink-1">{rfq.seller.businessNameEn}</p>
                <p className="u-meta flex flex-wrap items-center gap-2 text-ink-3">
                  {t("rfq.supplier.quoting")}
                  {/* The tier is the one the seller record actually carries —
                      brass marks a fact, it never decorates, and it only marks a
                      tier that is a distinction. The raw enum never reaches the
                      page: an unmapped value reads as its own label, not as
                      PLATINUM_PLUS. No `verified` prop, and therefore no seal:
                      this page holds the seller's TIER, not a reviewed
                      SellerDocument, and a brass arc travelling around a badge
                      with no cited document behind it is a fabricated trust
                      signal rendered in CSS. */}
                  {BRASS_TIERS.has(rfq.seller.tier) ? (
                    <TierMark tier={rfq.seller.tier} label={tierLabel(rfq.seller.tier)} />
                  ) : (
                    <span>· {tierLabel(rfq.seller.tier)}</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="u-ui font-medium text-ink-1">{t("rfq.supplier.none")}</p>
                <p className="u-meta text-ink-3">{t("rfq.supplier.noneBody")}</p>
              </>
            )}
          </div>
        </Surface>

        <LedgerTable
          title={t("rfq.items.title")}
          dateline={t("rfq.items.basis", { currency: rfq.currency })}
          rows={rfq.items}
          getRowKey={(item) => item.id}
          // A priced line and an unpriced one are two different states of the
          // same row, and the three pixels at the inline start say which before
          // the eye reaches the price column.
          rowProps={(item) => ({ className: toneRule(item.unitQuoted ? "accent" : "neutral") })}
          columns={[
            {
              key: "nameEn",
              label: t("rfq.col.item"),
              render: (item) => (
                <div className="py-1">
                  <p className="font-medium text-ink-1">{item.nameEn}</p>
                  {item.notes && <p className="u-meta text-ink-2">{item.notes}</p>}
                </div>
              ),
            },
            {
              key: "quantity",
              label: t("rfq.col.qty"),
              numeric: true,
              render: (item) => <Num value={item.quantity} />,
            },
            {
              key: "unitQuoted",
              label: t("rfq.col.unitQuote"),
              numeric: true,
              render: (item) =>
                item.unitQuoted ? (
                  <Money amount={Number(item.unitQuoted)} currency={rfq.currency} />
                ) : (
                  <span className="u-meta text-ink-3">{t("rfq.notPriced")}</span>
                ),
            },
            {
              key: "lineTotal",
              label: t("rfq.col.lineTotal"),
              numeric: true,
              render: (item) =>
                item.unitQuoted ? (
                  <Money amount={Number(item.unitQuoted) * item.quantity} currency={rfq.currency} />
                ) : (
                  <span className="u-meta text-ink-3">{t("common.none")}</span>
                ),
            },
          ]}
          footer={
            quotedTotal !== null ? (
              <span className="flex items-center justify-between gap-3">
                <Eyebrow as="span">{t("rfq.quotedTotal")}</Eyebrow>
                {/* The column sum, at column-sum rank. The figure the buyer is
                    actually committing to is set at hero rank in the decision
                    panel below — the same number in two different roles, and
                    the rank is what tells them apart. */}
                <Money amount={quotedTotal} currency={rfq.currency} rank="card" />
              </span>
            ) : (
              <span>{t("rfq.noQuotedTotal")}</span>
            )
          }
          empty={
            <EmptyState
              eyebrow={t("rfq.items.empty.eyebrow")}
              headline={t("rfq.items.empty.headline")}
              body={t("rfq.items.empty.body")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/b2b/quotes">{t("rfq.items.empty.action")}</Link>
                </Button>
              }
            />
          }
        />

        {quoted && (
          /* ══ THE DECISION ══════════════════════════════════════════════════
             The one enormous thing on this page, and it is the figure the buyer
             is being asked to accept — a number the supplier actually quoted,
             at 46px against 15px body.

             Round one put the two buttons in a recessed well under a 12px
             eyebrow, which made the most consequential control in the buyer
             suite the same size as the table above it. A recessed well is still
             right — these are the terms you are deciding on, not something you
             act on — and the one raised commit action sits on top of it.

             The paragraph under it is not fine print: it is the difference
             between "accepted" and "ordered", and it stays exactly as written. */
          <FieldWell className="overflow-hidden">
            <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
            <div className="p-5">
            <Eyebrow className="mb-1">{t("rfq.quotedTotal")}</Eyebrow>
            {quotedTotal !== null && (
              <div className="mb-4">
                <Money amount={quotedTotal} currency={rfq.currency} rank="hero" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <form action={acceptRFQQuote.bind(null, rfq.id, rfq.quoteVersion)}>
                <Button type="submit" variant="primary" size="md">
                  <CheckCircle className="h-4 w-4" aria-hidden="true" /> {t("rfq.decision.accept")}
                </Button>
              </form>
              <form action={rejectRFQQuote.bind(null, rfq.id, rfq.quoteVersion)}>
                <Button type="submit" variant="ghost" size="md" className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink">
                  <XCircle className="h-4 w-4" aria-hidden="true" /> {t("rfq.decision.decline")}
                </Button>
              </form>
            </div>
            <p className="u-meta mt-3 max-w-prose text-ink-2">
              {t("rfq.decision.note")}{" "}
              <Link href="/b2b/purchase-orders/new" className="u-focus rounded-nested text-primary-ink hover:underline">
                {t("rfq.decision.noteLink")}
              </Link>
              . {t("rfq.decision.repriced")}
            </p>
            </div>
          </FieldWell>
        )}

        {!quoted && rfq.status === "SUBMITTED" && (
          <Surface rung={1} tone="accent" className="flex items-start gap-2 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">{t("rfq.waiting")}</p>
          </Surface>
        )}

        {rfq.messages.length > 0 ? (
          <Surface rung={2} className="p-5">
            <h2 className="u-h3 inline-flex items-center gap-1.5 text-ink-1">
              <MessageSquare className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("rfq.messages")}
            </h2>
            {typeof rfq.messageTotal === "number" && rfq.messageTotal > rfq.messages.length && (
              <Dateline className="mt-0.5">
                {t("rfq.messages.window", { shown: rfq.messages.length, total: rfq.messageTotal })}
              </Dateline>
            )}
            <ul className="mt-4 space-y-3">
              {rfq.messages.map((m) => (
                // The buyer's own messages carry the primary rule; everybody
                // else's carry the same hairline the ledger tables draw. Three
                // pixels either way, so a thread never reflows as it grows.
                <li
                  key={m.id}
                  className={`ps-3 ${m.senderType === "BUYER" ? toneRule("primary") : "border-s-[3px] border-hairline"}`}
                >
                  <Eyebrow className="mb-0.5">
                    {senderLabel(m.senderType, rfq.seller?.businessNameEn ?? null, t)} · {f.dateTime(m.createdAt)}
                  </Eyebrow>
                  <p className="u-body text-ink-1">{m.body}</p>
                </li>
              ))}
            </ul>
          </Surface>
        ) : null}

        {/* An RFQ with no line items at all is the only genuinely empty state
            this page can reach, and the table above already carries it. There is
            deliberately no placeholder for an absent message thread: a thread
            nobody has written to is not a surface that needs an object. */}
        {rfq.items.length === 0 && rfq.messages.length === 0 && (
          <div className="flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/b2b/quotes">
                <ClipboardList className="h-4 w-4" aria-hidden="true" /> {t("rfq.items.empty.action")}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </B2BShell>
  );
}
