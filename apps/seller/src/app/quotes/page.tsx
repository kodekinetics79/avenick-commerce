import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { formatCurrency, isRecordId, isSupportedCurrency } from "@avenick/utils";
import { groupAcceptedValueByCurrency } from "./accepted-value";
import Link from "next/link";
import { redirect } from "next/navigation";
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

export const metadata = { title: "Quote History" };

// Enum → label map. The tone is one of the four semantic states, not a hue per
// status: only "the buyer still owes you a decision" is warning, and only a
// refusal is danger.
const STATUS: Record<string, { label: string; tone: PillTone; icon: typeof CheckCircle }> = {
  QUOTED: { label: "Awaiting response", tone: "warning", icon: Clock },
  NEGOTIATING: { label: "Negotiating", tone: "primary", icon: Clock },
  UNDER_REVIEW: { label: "Under review", tone: "neutral", icon: Clock },
  SUBMITTED: { label: "Submitted", tone: "neutral", icon: Clock },
  ACCEPTED: { label: "Accepted", tone: "success", icon: CheckCircle },
  REJECTED: { label: "Declined", tone: "danger", icon: XCircle },
  EXPIRED: { label: "Expired", tone: "neutral", icon: Clock },
  CANCELLED: { label: "Cancelled", tone: "neutral", icon: XCircle },
  DRAFT: { label: "Draft", tone: "neutral", icon: Clock },
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default async function QuoteHistoryPage({ searchParams }: { searchParams?: { rfq?: string } }) {
  const { membership, userRole } = await requireSellerPermission("rfqs.view");
  // The inbox and thread pages link here with ?rfq=<id> for an RFQ this
  // seller has already quoted. This page is the history list and has no
  // per-RFQ view, so the seller landed on the list with no sign of the RFQ
  // they clicked. Send a well-formed id on to the RFQ page; anything else
  // falls through to the list rather than being forwarded.
  //
  // The RFQ page requires quotes.submit, while this list — and the "View
  // quote" links that point here — need only rfqs.view. Forwarding a member
  // who lacks the higher permission would turn a link the inbox showed them
  // into a permission error, so they stay on the list they can read.
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
          .map((t) => (isSupportedCurrency(t.currency) ? formatCurrency(t.total, t.currency) : `${t.currency} ${t.total.toFixed(2)}`))
          .join(" · ");
  const winRate = responded.length > 0 ? Math.round((accepted.length / responded.length) * 100) : 0;

  // What the whole page is a view of. The cap is stated once, at page rank,
  // rather than as a grey strip apologising above the table.
  const pageDateline = capped
    ? `Your ${SELLER_QUOTE_HISTORY_LIMIT} most recently updated quotations · every figure below describes these rows, not your lifetime total`
    : "Every quotation you have submitted to buyers";

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="RFQ / Quotes"
          title="Quote history"
          dateline={pageDateline}
          actions={
            <Button variant="secondary" size="sm" asChild>
              <Link href="/messages">
                <Inbox className="h-3.5 w-3.5" aria-hidden="true" /> RFQ inbox
              </Link>
            </Button>
          }
        />

        {/* One panel divided by hairlines. Four independently tinted boxes in
            four different hues carried no information the labels did not. */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label={capped ? `Listed (newest ${SELLER_QUOTE_HISTORY_LIMIT})` : "Total submitted"}
            value={rfqs.length}
            rank="section"
            icon={FileText}
            chip="neutral"
          />
          <Stat label="Accepted" value={accepted.length} icon={CheckCircle} chip={accepted.length > 0 ? "success" : "neutral"} />
          <Stat
            label="Win rate"
            value={responded.length > 0 ? winRate : "—"}
            unit={responded.length > 0 ? "%" : undefined}
            icon={TrendingUp}
            chip="neutral"
            dateline={responded.length > 0 ? `Accepted out of the ${responded.length} that received a decision` : undefined}
            // No decision has come back on anything listed, so there is nothing
            // to take a ratio of — say that rather than print a confident 0%.
            deltaWithheld={responded.length === 0 ? "No listed quote has received a decision yet" : undefined}
          />
          <Stat
            label={acceptedTotals.length > 1 ? "Accepted value by currency" : "Accepted value"}
            value={acceptedValueLabel}
            icon={TrendingUp}
            chip="neutral"
            dateline={acceptedTotals.length > 1 ? "Each currency as recorded · no conversion applied" : undefined}
          />
        </CellGrid>

        <LedgerTable
          rows={rfqs}
          getRowKey={(r) => r.id}
          stickyHead
          dateline={
            capped
              ? `The ${SELLER_QUOTE_HISTORY_LIMIT} most recently updated quotes; older quotes are not listed here yet.`
              : undefined
          }
          columns={[
            {
              key: "rfqNumber",
              label: "RFQ #",
              width: "140px",
              render: (r) => <span className="u-mono u-meta text-ink-2">{r.rfqNumber}</span>,
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (r) => <span className="block max-w-[220px] truncate">{r.company?.nameEn ?? "Direct buyer"}</span>,
            },
            { key: "items", label: "Items", numeric: true, render: (r) => r._count.items },
            {
              key: "total",
              label: "Quoted total",
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
              label: "Required by",
              hideOnMobile: true,
              render: (r) => <span className="u-meta whitespace-nowrap text-ink-2">{fmt(r.requiredBy)}</span>,
            },
            {
              key: "status",
              label: "Status",
              align: "end",
              render: (r) => {
                const st = STATUS[r.status] ?? STATUS.SUBMITTED!;
                return (
                  <StatusPill tone={st.tone} className="whitespace-nowrap">
                    <st.icon className="h-3 w-3" aria-hidden="true" />
                    {st.label}
                  </StatusPill>
                );
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="You have not submitted a quotation yet."
              body="RFQs routed to you arrive in your inbox; every quote you send from there is listed here."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/messages">Open the RFQ inbox</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
