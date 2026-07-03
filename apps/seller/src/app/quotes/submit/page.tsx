import Link from "next/link";
import { ArrowLeft, FileQuestion, Building2, Clock } from "lucide-react";
import { SellerLayout } from "@/components/layout/seller-layout";
import { requireSellerSession } from "@/lib/auth";
import { db, getRFQsForSeller } from "@avenick/database";
import { QuoteForm } from "./quote-form";
import { format } from "date-fns";

export const metadata = { title: "Submit Quote" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { rfq?: string };
}

export default async function SubmitQuotePage({ searchParams }: PageProps) {
  const { seller } = await requireSellerSession();

  // With ?rfq=<id>: quote that specific RFQ (must be open+unassigned or ours).
  const rfq = searchParams.rfq
    ? await db.rFQRequest.findFirst({
        where: {
          id: searchParams.rfq,
          OR: [{ status: { in: ["SUBMITTED", "UNDER_REVIEW"] }, sellerId: null }, { sellerId: seller.id }],
        },
        include: { items: true, company: { select: { nameEn: true } } },
      })
    : null;

  // Without one (or if not found): show the open RFQ inbox to pick from.
  const inbox = rfq ? [] : await getRFQsForSeller(seller.id);
  const openInbox = inbox.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status));

  return (
    <SellerLayout>
      <div className="space-y-5 max-w-3xl">
        <Link href="/quotes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Quote history
        </Link>

        {rfq ? (
          <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">Quote {rfq.rfqNumber}</h1>
                <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {rfq.company?.nameEn ?? "Individual buyer"}
                  {rfq.requiredBy && (
                    <>
                      <span>·</span>
                      <Clock className="h-3.5 w-3.5" /> needed by {format(rfq.requiredBy, "MMM d, yyyy")}
                    </>
                  )}
                </p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-muted-foreground shrink-0">
                {rfq.status.replace(/_/g, " ")}
              </span>
            </div>

            {rfq.notes && (
              <div className="rounded-xl bg-secondary/50 border border-border p-3 text-sm text-muted-foreground">{rfq.notes}</div>
            )}

            <QuoteForm
              rfqId={rfq.id}
              currency={rfq.currency}
              items={rfq.items.map((i) => ({ id: i.id, nameEn: i.nameEn, quantity: i.quantity, notes: i.notes }))}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">RFQ Inbox</h1>
              <p className="text-sm text-muted-foreground">Open requests for quotation you can respond to.</p>
            </div>

            {openInbox.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border px-4 py-16 text-center">
                <FileQuestion className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No open RFQs right now. New buyer requests will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {openInbox.map((r) => (
                  <li key={r.id} className="bg-card rounded-2xl border border-border p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.rfqNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.company?.nameEn ?? "Individual buyer"} ·{" "}
                        {r.items.slice(0, 3).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                        {r.items.length > 3 ? ` +${r.items.length - 3} more` : ""}
                      </p>
                      {r.requiredBy && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> needed by {format(r.requiredBy, "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/quotes/submit?rfq=${r.id}`}
                      className="text-sm font-semibold text-primary border border-primary/30 px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors shrink-0"
                    >
                      Quote this RFQ
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
