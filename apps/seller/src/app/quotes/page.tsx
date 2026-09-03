import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { formatCurrency, isRecordId, isSupportedCurrency } from "@avenick/utils";
import { groupAcceptedValueByCurrency } from "./accepted-value";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileText, CheckCircle, Clock, XCircle, TrendingUp, Inbox } from "lucide-react";
import {
  Button,
  CellGrid,
  EmptyState,
  LedgerTable,
  PageHeader,
  Stat,
  StatusPill,
  type PillTone,
} from "@avenick/ui";
import { SELLER_QUOTE_HISTORY_LIMIT } from "@avenick/database";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";

export async function generateMetadata() {
  const t = await getTranslations("sellerRelations");
  return { title: t("quotes.metaTitle") };
}

// Enum → tone and icon. The tone is one of the four semantic states, not a hue
// per status: only "the buyer still owes you a decision" is warning, and only a
// refusal is danger. The KEYS are the Prisma enum and are never translated; the
// labels live under sellerRelations.quoteStatus.*.
const STATUS: Record<string, { tone: PillTone; icon: typeof CheckCircle }> = {
  QUOTED: { tone: "warning", icon: Clock },
  NEGOTIATING: { tone: "primary", icon: Clock },
  UNDER_REVIEW: { tone: "neutral", icon: Clock },
  SUBMITTED: { tone: "neutral", icon: Clock },
  ACCEPTED: { tone: "success", icon: CheckCircle },
  REJECTED: { tone: "danger", icon: XCircle },
  EXPIRED: { tone: "neutral", icon: Clock },
  CANCELLED: { tone: "neutral", icon: XCircle },
  DRAFT: { tone: "neutral", icon: Clock },
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default async function QuoteHistoryPage({ searchParams }: { searchParams?: { rfq?: string } }) {
  const { membership, userRole } = await requireSellerPermission("rfqs.view");
  const t = await getTranslations("sellerRelations");
  // The inbox and thread pages link here with ?rfq=<id> for an RFQ this
  // seller has already quoted. This page is the history list and has no
  // per-RFQ view, so the seller landed on the list with no sign of the RFQ
  // they clicked. Send a well-formed id on to the RFQ page; anything else
  // falls through to the list rather than being forwarded.
  //
  // The RFQ page requires quotes.submit, while this list — and the
  // inbox.row.viewQuote links that point here — need only rfqs.view.
  // Forwarding a member who lacks the higher permission would turn a link the
  // inbox showed them into a permission error, so they stay on the list they
  // can read.
  const rfq = searchParams?.rfq;
  const canOpenRfq = sellerHasPermission({ user: { role: userRole }, membership }, "quotes.submit");
  if (rfq && isRecordId(rfq) && canOpenRfq) redirect(`/quotes/submit?rfq=${encodeURIComponent(rfq)}`);
  type RFQRow = {
    id: string;
    rfqNumber: string;
    status: string;
    /** The currency the quote was written in — a seller quotes SAR and AED buyers alike. */
    currency: string;
    totalQuoted: string | number | null;
    requiredBy: string | null;
    company: { nameEn: string } | null;
    _count: { items: number };
  };
  const data = await fetchSellerBackend<{
    seller: { businessNameEn: string; tier: string };
    history: RFQRow[];
  }>("/api/seller/rfqs");
  const seller = data.seller;
  const rfqs = data.history;
  // The API returns the most recently updated page of this seller's quotes, not
  // every quote ever submitted. The counters below are therefore about what is
  // listed, and the table says so — a capped list presented as a lifetime total
  // is the same lie whether the number is a count or a sum.
  const capped = rfqs.length >= SELLER_QUOTE_HISTORY_LIMIT;

  const accepted = rfqs.filter((r) => r.status === "ACCEPTED");
  const responded = rfqs.filter((r) => ["ACCEPTED", "REJECTED", "EXPIRED"].includes(r.status));
  // One figure per currency. Summing SAR into AED and labelling the result AED
  // was wrong by whatever the rate happened to be, with nothing on the card
  // saying more than one currency went into it.
  const acceptedTotals = groupAcceptedValueByCurrency(accepted);
  const acceptedValueLabel =
    acceptedTotals.length === 0
      ? "—"
      : acceptedTotals
          .map((t2) => (isSupportedCurrency(t2.currency) ? formatCurrency(t2.total, t2.currency) : `${t2.currency} ${t2.total.toFixed(2)}`))
          .join(" · ");
  const winRate = responded.length > 0 ? Math.round((accepted.length / responded.length) * 100) : 0;

  // What the whole page is a view of. The cap is stated once, at page rank,
  // rather than as a grey strip apologising above the table.
  const pageDateline = capped
    ? t("quotes.datelineCapped", { limit: String(SELLER_QUOTE_HISTORY_LIMIT) })
    : t("quotes.datelineAll");

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("quotes.eyebrow")}
          title={t("quotes.title")}
          dateline={pageDateline}
          actions={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/messages">
                <Inbox className="h-3.5 w-3.5" aria-hidden="true" /> {t("quotes.rfqInbox")}
              </Link>
            </Button>
          }
        />

        {/* One panel divided by hairlines. Four independently tinted boxes in
            four different hues carried no information the labels did not. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label={capped ? t("quotes.stats.listedNewest", { limit: String(SELLER_QUOTE_HISTORY_LIMIT) }) : t("quotes.stats.totalSubmitted")}
            value={rfqs.length}
            rank="section"
            icon={FileText}
            chip="neutral"
          />
          <Stat label={t("quotes.stats.accepted")} value={accepted.length} icon={CheckCircle} chip={accepted.length > 0 ? "success" : "neutral"} />
          <Stat
            label={t("quotes.stats.winRate")}
            value={responded.length > 0 ? winRate : "—"}
            unit={responded.length > 0 ? "%" : undefined}
            icon={TrendingUp}
            chip="neutral"
            dateline={responded.length > 0 ? t("quotes.stats.winRateBasis", { n: String(responded.length) }) : undefined}
            // No decision has come back on anything listed, so there is nothing
            // to take a ratio of — say that rather than print a confident 0%.
            deltaWithheld={responded.length === 0 ? t("quotes.stats.noDecisionYet") : undefined}
          />
          <Stat
            label={acceptedTotals.length > 1 ? t("quotes.stats.acceptedValueByCurrency") : t("quotes.stats.acceptedValue")}
            value={acceptedValueLabel}
            icon={TrendingUp}
            chip="neutral"
            dateline={acceptedTotals.length > 1 ? t("quotes.stats.noConversion") : undefined}
          />
        </CellGrid>

        <LedgerTable
          rows={rfqs}
          getRowKey={(r) => r.id}
          stickyHead
          dateline={capped ? t("quotes.tableCapped", { limit: String(SELLER_QUOTE_HISTORY_LIMIT) }) : undefined}
          columns={[
            {
              key: "rfqNumber",
              label: t("quotes.columns.rfqNumber"),
              width: "140px",
              render: (r) => <span className="u-mono u-meta text-ink-2">{r.rfqNumber}</span>,
            },
            {
              key: "buyer",
              label: t("quotes.columns.buyer"),
              render: (r) => <span className="block max-w-[220px] truncate">{r.company?.nameEn ?? t("common.directBuyer")}</span>,
            },
            { key: "items", label: t("quotes.columns.items"), numeric: true, render: (r) => r._count.items },
            {
              key: "total",
              label: t("quotes.columns.quotedTotal"),
              numeric: true,
              // Each quote in the currency it was written in. A supported
              // currency formats; anything else prints its raw code so a
              // reader is never shown a figure under the wrong symbol.
              render: (r) =>
                r.totalQuoted
                  ? isSupportedCurrency(r.currency)
                    ? formatCurrency(Number(r.totalQuoted), r.currency)
                    : `${r.currency} ${Number(r.totalQuoted).toFixed(2)}`
                  : "—",
            },
            {
              key: "requiredBy",
              label: t("quotes.columns.requiredBy"),
              hideOnMobile: true,
              render: (r) => <span className="u-meta whitespace-nowrap text-ink-2">{fmt(r.requiredBy)}</span>,
            },
            {
              key: "status",
              label: t("quotes.columns.status"),
              align: "end",
              render: (r) => {
                const known = r.status in STATUS;
                const st = STATUS[r.status] ?? STATUS.SUBMITTED!;
                return (
                  <StatusPill tone={st.tone} className="whitespace-nowrap">
                    <st.icon className="h-3 w-3" aria-hidden="true" />
                    {known ? t(`quoteStatus.${r.status}`) : t("quoteStatus.SUBMITTED")}
                  </StatusPill>
                );
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("common.nothingRecorded")}
              headline={t("quotes.empty.headline")}
              body={t("quotes.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/messages">{t("quotes.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
