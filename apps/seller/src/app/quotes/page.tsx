import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { formatCurrency, isRecordId, isSupportedCurrency } from "@avenick/utils";
import { groupAcceptedValueByCurrency } from "./accepted-value";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";
import { SELLER_QUOTE_HISTORY_LIMIT } from "@avenick/database";
import { requireSellerPermission } from "@/lib/auth";
import { sellerHasPermission } from "@/lib/seller-permissions";

export const metadata = { title: "Quote History" };

const STATUS: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  QUOTED: { label: "Awaiting response", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  NEGOTIATING: { label: "Negotiating", cls: "bg-primary/15 text-primary", icon: Clock },
  UNDER_REVIEW: { label: "Under review", cls: "bg-secondary text-muted-foreground", icon: Clock },
  SUBMITTED: { label: "Submitted", cls: "bg-secondary text-muted-foreground", icon: Clock },
  ACCEPTED: { label: "Accepted", cls: "bg-success/15 text-success", icon: CheckCircle },
  REJECTED: { label: "Declined", cls: "bg-danger/15 text-danger", icon: XCircle },
  EXPIRED: { label: "Expired", cls: "bg-secondary text-muted-foreground", icon: Clock },
  CANCELLED: { label: "Cancelled", cls: "bg-secondary text-muted-foreground", icon: XCircle },
  DRAFT: { label: "Draft", cls: "bg-secondary text-muted-foreground", icon: Clock },
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

  const stats = [
    { label: capped ? `Listed (newest ${SELLER_QUOTE_HISTORY_LIMIT})` : "Total submitted", value: rfqs.length, icon: FileText, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
    { label: "Accepted", value: accepted.length, icon: CheckCircle, color: "text-success", bg: "bg-success/5 border-success/20" },
    { label: "Win rate", value: `${winRate}%`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/5 border-accent/20" },
    { label: acceptedTotals.length > 1 ? "Accepted value by currency" : "Accepted value", value: acceptedValueLabel, icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quote history</h1>
            <p className="text-sm text-muted-foreground">
              {capped ? `Your ${SELLER_QUOTE_HISTORY_LIMIT} most recently updated quotations` : "All quotations you have submitted to buyers"}
            </p>
          </div>
          <Link href="/messages" className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-glow-sm text-sm font-semibold px-4 py-2 rounded-xl transition-all active:scale-[0.98] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> RFQ inbox
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <Icon className={`h-4 w-4 ${color} mb-2`} />
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {rfqs.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">No quotes yet</p>
              <p className="text-sm text-muted-foreground mt-1">RFQs routed to you appear in your inbox — quotes you submit show here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {capped && (
                <p className="px-4 py-2 text-xs text-muted-foreground bg-secondary/40 border-b border-border">
                  Showing the {SELLER_QUOTE_HISTORY_LIMIT} most recently updated quotes; older quotes are not listed here yet.
                </p>
              )}
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>
                    {["RFQ #", "Buyer", "Items", "Quoted total", "Required by", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rfqs.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.SUBMITTED!;
                    return (
                      <tr key={r.id} className="hover:bg-secondary/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{r.rfqNumber}</td>
                        <td className="px-4 py-3 font-medium max-w-[180px] truncate">{r.company?.nameEn ?? "Direct buyer"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r._count.items}</td>
                        <td className="px-4 py-3 font-mono font-semibold">
                          {r.totalQuoted
                            ? isSupportedCurrency(r.currency)
                              ? formatCurrency(Number(r.totalQuoted), r.currency)
                              : `${r.currency} ${Number(r.totalQuoted).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.requiredBy)}</td>
                        <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" />{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
