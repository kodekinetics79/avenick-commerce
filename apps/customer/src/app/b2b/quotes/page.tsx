import Link from "next/link";
import { ArrowLeft, FileText, Plus, CheckCircle, Clock, TrendingDown, Star } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { MOCK_RFQS } from "@avenick/database";
import { Button } from "@avenick/ui";
import { formatCurrency } from "@avenick/utils";

export const metadata = { title: "My Quotes — Avenick Commerce" };

const EXTENDED_QUOTES = [
  { id: "q_001", rfqId: "rfq_001", rfqNumber: "RFQ-2024-0041", rfqDesc: "Safety vests and hard hats for 50 workers", sellerName: "SafeGuard AE", sellerRating: 4.8, sellerTier: "GOLD", totalAmount: 2350, currency: "AED", validUntil: "2024-12-20", status: "RECEIVED", items: 2, leadTimeDays: 5, isLowest: true },
  { id: "q_002", rfqId: "rfq_001", rfqNumber: "RFQ-2024-0041", rfqDesc: "Safety vests and hard hats for 50 workers", sellerName: "FireShield LLC", sellerRating: 4.5, sellerTier: "VERIFIED", totalAmount: 2600, currency: "AED", validUntil: "2024-12-18", status: "RECEIVED", items: 2, leadTimeDays: 7, isLowest: false },
  { id: "q_003", rfqId: "rfq_003", rfqNumber: "RFQ-2024-0061", rfqDesc: "Monthly office supplies", sellerName: "OfficeZone KW", sellerRating: 4.2, sellerTier: "VERIFIED", totalAmount: 1180, currency: "AED", validUntil: "2024-12-10", status: "ACCEPTED", items: 8, leadTimeDays: 3, isLowest: true },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RECEIVED: { label: "Received", color: "bg-primary/15 text-primary" },
  ACCEPTED: { label: "Accepted", color: "bg-primary/20 text-primary" },
  DECLINED: { label: "Declined", color: "bg-danger/15 text-danger" },
  EXPIRED:  { label: "Expired",  color: "bg-muted text-muted-foreground" },
};

export default function QuotesPage() {
  const receivedCount = EXTENDED_QUOTES.filter((q) => q.status === "RECEIVED").length;
  const acceptedValue = EXTENDED_QUOTES.filter((q) => q.status === "ACCEPTED").reduce((s, q) => s + q.totalAmount, 0);
  const rfqsWithQuotes = MOCK_RFQS.filter((r) => EXTENDED_QUOTES.some((q) => q.rfqId === r.id));

  return (
    <B2BShell>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/b2b" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to B2B Dashboard
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Quotes</h1>
            <p className="text-muted-foreground text-sm">Quotes received from suppliers, grouped by RFQ</p>
          </div>
          <Button asChild variant="primary" size="sm">
            <Link href="/b2b/rfq/new"><Plus className="h-3.5 w-3.5 me-1" /> New RFQ</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{receivedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Awaiting Review</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{EXTENDED_QUOTES.filter((q) => q.status === "ACCEPTED").length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Accepted</p>
          </div>
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-lg font-bold text-primary">{formatCurrency(acceptedValue, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Accepted</p>
          </div>
        </div>

        {rfqsWithQuotes.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-semibold mb-1">No quotes yet</p>
            <p className="text-sm text-muted-foreground mb-6">Submit an RFQ to receive competitive quotes from suppliers.</p>
            <Button asChild variant="primary"><Link href="/b2b/rfq/new">Create Your First RFQ</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            {rfqsWithQuotes.map((rfq) => {
              const rfqQuotes = EXTENDED_QUOTES.filter((q) => q.rfqId === rfq.id);
              return (
                <div key={rfq.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                  {/* RFQ header bar */}
                  <div className="px-5 py-3 bg-secondary/20 border-b border-border flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-muted-foreground">{rfq.rfqNumber}</span>
                      <p className="font-medium text-sm">{rfq.description}</p>
                    </div>
                    <Link href={`/b2b/rfq/${rfq.id}`} className="text-xs text-primary hover:underline font-medium whitespace-nowrap">
                      View RFQ →
                    </Link>
                  </div>

                  <div className="divide-y divide-border">
                    {rfqQuotes.map((q) => {
                      const sc = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.RECEIVED;
                      return (
                        <div key={q.id} className={`p-4 flex items-start justify-between gap-4 ${q.isLowest && q.status === "RECEIVED" ? "bg-primary/5" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-semibold text-sm">{q.sellerName}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${q.sellerTier === "GOLD" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-secondary text-muted-foreground"}`}>{q.sellerTier}</span>
                              {q.isLowest && q.status === "RECEIVED" && (
                                <span className="flex items-center gap-0.5 text-xs text-primary font-semibold">
                                  <TrendingDown className="h-3 w-3" /> Best price
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mb-1">
                              {[1,2,3,4,5].map((s) => <Star key={s} className={`h-3 w-3 ${s <= Math.round(q.sellerRating) ? "text-amber-400 fill-current" : "text-secondary fill-current"}`} />)}
                              <span className="text-xs text-muted-foreground">{q.sellerRating}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{q.items} items · {q.leadTimeDays}d lead time · Valid {q.validUntil}</p>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="text-lg font-bold text-primary mb-1">{formatCurrency(q.totalAmount, q.currency as "AED")}</p>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${sc.color}`}>{sc.label}</span>
                            {q.status === "RECEIVED" && (
                              <div className="flex gap-1.5 justify-end">
                                <button type="button" className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg hover:bg-primary/95 transition-colors font-medium flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" /> Accept
                                </button>
                                <button type="button" className="text-xs border border-border text-muted-foreground px-2.5 py-1 rounded-lg hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 hover:border-red-500/30 transition-colors">Decline</button>
                              </div>
                            )}
                            {q.status === "ACCEPTED" && (
                              <button type="button" className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:bg-primary/95 transition-colors font-medium">Convert to Order →</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </B2BShell>
  );
}
