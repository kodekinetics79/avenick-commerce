import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, CheckCircle, XCircle, Clock, Store, MessageSquare } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import type { RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";
import { acceptRFQQuote, rejectRFQQuote } from "../actions";
import { format } from "date-fns";

export const metadata = { title: "RFQ Detail" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<RFQStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-muted-foreground" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-primary" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-purple-100 text-purple-700" },
  QUOTED: { label: "Quote Received", color: "bg-amber-100 text-amber-700" },
  NEGOTIATING: { label: "Negotiating", color: "bg-orange-100 text-orange-700" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
  EXPIRED: { label: "Expired", color: "bg-slate-100 text-muted-foreground" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-muted-foreground" },
};

export default async function RFQDetailPage({ params }: { params: { id: string } }) {
  type RFQDetail = {
    id: string;
    rfqNumber: string;
    status: RFQStatus;
    currency: string;
    notes: string | null;
    totalQuoted: string | number | null;
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
    messages: Array<{
      id: string;
      senderType: string;
      body: string;
      createdAt: string;
    }>;
  };
  let rfq: RFQDetail;
  try {
    rfq = await fetchB2BJson<RFQDetail>(`/api/b2b/rfqs/${params.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "RFQ not found") notFound();
    redirect("/b2b/register");
  }

  const cfg = STATUS_CONFIG[rfq.status];
  const quoted = rfq.status === "QUOTED" || rfq.status === "NEGOTIATING";
  const quotedTotal = rfq.totalQuoted ? Number(rfq.totalQuoted) : null;

  return (
    <B2BShell>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
          <Link href="/b2b/quotes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Quotes
          </Link>

          <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">{rfq.rfqNumber}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Created {format(new Date(rfq.createdAt), "MMM d, yyyy")}
                  {rfq.requiredBy && <> · required by {format(new Date(rfq.requiredBy), "MMM d, yyyy")}</>}
                </p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
            </div>

            {rfq.notes && (
              <div className="rounded-xl bg-slate-50 border border-border p-3 text-sm text-muted-foreground">{rfq.notes}</div>
            )}

            {rfq.seller && (
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Store className="h-4 w-4 text-orange-600" />
                </span>
                <div>
                  <p className="text-sm font-medium">{rfq.seller.businessNameEn}</p>
                  <p className="text-xs text-muted-foreground">Quoting supplier · {rfq.seller.tier}</p>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-semibold mb-2">Line items</h2>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-border">
                    <tr>
                      {["Item", "Qty", "Unit quote", "Line total"].map((h) => (
                        <th key={h} className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rfq.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.nameEn}</p>
                          {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.quantity}</td>
                        <td className="px-3 py-2.5">
                          {item.unitQuoted ? formatCurrency(Number(item.unitQuoted), rfq.currency as never) : <span className="text-muted-foreground">Pending</span>}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">
                          {item.unitQuoted ? formatCurrency(Number(item.unitQuoted) * item.quantity, rfq.currency as never) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {quotedTotal !== null && (
                    <tfoot className="bg-slate-50 border-t border-border">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 text-end font-semibold">Quoted total</td>
                        <td className="px-3 py-2.5 font-bold">{formatCurrency(quotedTotal, rfq.currency as never)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {quoted && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <form action={acceptRFQQuote.bind(null, rfq.id)}>
                  <button type="submit" className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                    <CheckCircle className="h-4 w-4" /> Accept quote
                  </button>
                </form>
                <form action={rejectRFQQuote.bind(null, rfq.id)}>
                  <button type="submit" className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                    <XCircle className="h-4 w-4" /> Decline
                  </button>
                </form>
                <p className="text-xs text-muted-foreground ms-auto">Review price, validity, delivery, and payment terms before accepting.</p>
              </div>
            )}

            {!quoted && rfq.status === "SUBMITTED" && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-primary">
                <Clock className="h-4 w-4 shrink-0" />
                Waiting for supplier quotes — check this workspace for pricing updates.
              </div>
            )}

            {rfq.messages.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold mb-2 inline-flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" /> Messages
                </h2>
                <ul className="space-y-2">
                  {rfq.messages.map((m) => (
                    <li key={m.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="text-xs text-muted-foreground mb-1">
                        {m.senderType} · {format(new Date(m.createdAt), "MMM d, HH:mm")}
                      </p>
                      {m.body}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="text-center">
            <Link href="/b2b/rfq/new" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Create another RFQ
            </Link>
          </div>
        </div>
      </div>
    </B2BShell>
  );
}
