"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Package, MessageSquare, Star, TrendingDown, Award, ChevronRight } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { MOCK_RFQS, MOCK_QUOTES } from "@avenick/database";
import { Button } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";

const RFQ_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:         { label: "Draft",          color: "bg-gray-100 text-muted-foreground" },
  SUBMITTED:     { label: "Submitted",      color: "bg-blue-100 text-primary" },
  UNDER_REVIEW:  { label: "Under Review",   color: "bg-yellow-100 text-yellow-700" },
  QUOTED:        { label: "Quoted",         color: "bg-purple-100 text-purple-700" },
  NEGOTIATING:   { label: "Negotiating",    color: "bg-primary/20 text-primary" },
  ACCEPTED:      { label: "Accepted",       color: "bg-primary/20 text-primary" },
  REJECTED:      { label: "Rejected",       color: "bg-red-100 text-red-700" },
  EXPIRED:       { label: "Expired",        color: "bg-gray-100 text-muted-foreground" },
};

const QUOTE_DETAILS = [
  { id: "q_001", rfqId: "rfq_001", sellerName: "SafeGuard AE", sellerRating: 4.8, sellerTier: "GOLD", totalAmount: 2350, currency: "AED", validUntil: "2024-12-20", status: "RECEIVED", items: 2, leadTimeDays: 5, notes: "All items in stock. SASO certified. Free delivery to Dubai.", deliveryCity: "Dubai", paymentTerms: "Net 30" },
  { id: "q_002", rfqId: "rfq_001", sellerName: "FireShield LLC", sellerRating: 4.5, sellerTier: "VERIFIED", totalAmount: 2600, currency: "AED", validUntil: "2024-12-18", status: "RECEIVED", items: 2, leadTimeDays: 7, notes: "EN397 certified helmets. Additional 5% discount on orders over AED 5,000.", deliveryCity: "Dubai", paymentTerms: "Net 15" },
];

const TIMELINE = [
  { status: "RFQ Created", time: "Nov 10, 10:30 AM", done: true },
  { status: "Under Review by Avenick", time: "Nov 10, 11:00 AM", done: true },
  { status: "Sent to Suppliers", time: "Nov 10, 2:00 PM", done: true },
  { status: "Quotes Received", time: "Nov 12, 9:00 AM", done: true },
  { status: "Quote Accepted", time: "Pending", done: false },
  { status: "Order Placed", time: "Pending", done: false },
];

export default function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rfq = MOCK_RFQS.find((r) => r.id === id);

  if (!rfq) {
    return (
      <B2BShell>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground mb-4">RFQ not found.</p>
          <Button asChild variant="primary"><Link href="/b2b">Back to Dashboard</Link></Button>
        </div>
      </B2BShell>
    );
  }

  const sc = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.DRAFT;
  const quotes = rfq.status === "QUOTED" || rfq.status === "ACCEPTED" ? QUOTE_DETAILS : [];
  const lowestQuote = quotes.reduce<typeof QUOTE_DETAILS[0] | null>((best, q) => (!best || q.totalAmount < best.totalAmount ? q : best), null);

  return (
    <B2BShell>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">

          <Link href="/b2b" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to B2B Dashboard
          </Link>

          {/* Header */}
          <div className="bg-white rounded-2xl border border-border p-5 mb-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{rfq.rfqNumber}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                </div>
                <h1 className="text-xl font-bold">{rfq.description}</h1>
              </div>
              <Link href="/b2b/rfq/new">
                <Button variant="ghost" size="sm">New RFQ</Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Quantity</p><p className="font-semibold">{rfq.quantity.toLocaleString()} units</p></div>
              <div><p className="text-xs text-muted-foreground">Target Price</p><p className="font-semibold">{formatCurrency(rfq.targetPrice, rfq.currency as "AED")}</p></div>
              <div><p className="text-xs text-muted-foreground">Required By</p><p className="font-semibold">{rfq.requiredBy}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p className="font-semibold">{rfq.createdAt}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Quotes column */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-semibold text-lg">{quotes.length > 0 ? `${quotes.length} Quotes Received` : "Awaiting Quotes"}</h2>

              {quotes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border p-10 text-center">
                  <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-40" />
                  <p className="font-medium mb-1">Waiting for supplier quotes</p>
                  <p className="text-sm text-muted-foreground">Suppliers have been notified. Expected responses within 24–48 hours.</p>
                </div>
              ) : (
                quotes.map((q) => {
                  const isBest = q.id === lowestQuote?.id;
                  const savingVsTarget = rfq.targetPrice - q.totalAmount;
                  return (
                    <div key={q.id} className={`bg-white rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${isBest ? "border-primary" : "border-border"}`}>
                      {isBest && (
                        <div className="bg-primary/100 text-white text-xs font-bold px-4 py-1.5 flex items-center gap-1.5">
                          <TrendingDown className="h-3.5 w-3.5" /> Best Price — Lowest Quote
                        </div>
                      )}
                      <div className="p-5">
                        {/* Seller */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-bold">{q.sellerName}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${q.sellerTier === "GOLD" ? "bg-amber-100 text-amber-700" : "bg-primary/20 text-primary"}`}>
                                {q.sellerTier}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map((s) => <Star key={s} className={`h-3 w-3 ${s <= Math.round(q.sellerRating) ? "text-amber-400 fill-current" : "text-gray-200 fill-current"}`} />)}
                              <span className="text-xs text-muted-foreground ms-1">{q.sellerRating}</span>
                            </div>
                          </div>
                          <div className="text-end">
                            <p className="text-2xl font-bold text-primary">{formatCurrency(q.totalAmount, q.currency as "AED")}</p>
                            {savingVsTarget > 0
                              ? <p className="text-xs text-primary font-medium">Save {formatCurrency(savingVsTarget, "AED")} vs target</p>
                              : <p className="text-xs text-red-500 font-medium">{formatCurrency(Math.abs(savingVsTarget), "AED")} over target</p>}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-sm bg-slate-50 rounded-xl p-3">
                          <div><p className="text-xs text-muted-foreground">Lead Time</p><p className="font-medium">{q.leadTimeDays} business days</p></div>
                          <div><p className="text-xs text-muted-foreground">Payment Terms</p><p className="font-medium">{q.paymentTerms}</p></div>
                          <div><p className="text-xs text-muted-foreground">Valid Until</p><p className="font-medium">{q.validUntil}</p></div>
                        </div>

                        {q.notes && (
                          <div className="flex items-start gap-2 mb-4 text-sm text-muted-foreground bg-blue-50 rounded-xl p-3">
                            <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <p>{q.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-3">
                          <Button variant="primary" className="flex-1">
                            <CheckCircle className="h-4 w-4 me-1.5" /> Accept Quote
                          </Button>
                          <Button variant="ghost" className="border border-border">Request Revision</Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {quotes.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2 text-sm text-primary">
                  <Award className="h-4 w-4 shrink-0" />
                  <p>You have {quotes.length} quotes. The lowest is <strong>{formatCurrency(lowestQuote?.totalAmount ?? 0, "AED")}</strong> from {lowestQuote?.sellerName}.</p>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h2 className="font-semibold">RFQ Timeline</h2>
              <div className="bg-white rounded-2xl border border-border p-4">
                <div className="space-y-3">
                  {TIMELINE.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${step.done ? "bg-primary/100" : "bg-slate-200"}`}>
                        {step.done
                          ? <CheckCircle className="h-3 w-3 text-white" />
                          : <span className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.status}</p>
                        <p className="text-xs text-muted-foreground">{step.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold mb-2">Related</p>
                <div className="space-y-1">
                  {[
                    { href: "/b2b/quotes", label: "All My Quotes" },
                    { href: "/b2b", label: "B2B Dashboard" },
                    { href: "/b2b/rfq/new", label: "Create New RFQ" },
                  ].map(({ href, label }) => (
                    <Link key={href} href={href} className="flex items-center justify-between text-sm py-1.5 text-muted-foreground hover:text-primary transition-colors">
                      {label} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Need help */}
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 text-sm">
                <p className="font-semibold text-orange-800 mb-1">Need help?</p>
                <p className="text-primary mb-3">Your account manager Sara Al-Ahmed is available to assist with this RFQ.</p>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <Link href="mailto:sara@avenick.com" className="text-primary hover:underline text-xs font-medium">sara@avenick.com</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </B2BShell>
  );
}
