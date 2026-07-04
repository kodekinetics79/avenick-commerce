import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, Clock } from "lucide-react";
import { B2BShell } from "@/components/b2b/b2b-shell";
import type { RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { fetchB2BJson } from "@/lib/b2b";
import { format } from "date-fns";

export const metadata = { title: "Quotes & RFQs" };
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

export default async function QuotesPage() {
  type RFQRow = {
    id: string;
    rfqNumber: string;
    status: RFQStatus;
    requiredBy: string | null;
    totalQuoted: string | number | null;
    currency: string;
    createdAt: string;
    items: Array<{ quantity: number; nameEn: string }>;
    seller: { businessNameEn: string } | null;
  };
  let rfqs: RFQRow[];
  try {
    rfqs = await fetchB2BJson<RFQRow[]>("/api/b2b/rfqs");
  } catch {
    redirect("/b2b/register");
  }

  const awaiting = rfqs.filter((r) => ["SUBMITTED", "UNDER_REVIEW"].includes(r.status)).length;
  const quoted = rfqs.filter((r) => ["QUOTED", "NEGOTIATING"].includes(r.status)).length;
  const accepted = rfqs.filter((r) => r.status === "ACCEPTED").length;

  return (
    <B2BShell
      title="Quotes & RFQs"
      description="Track your requests for quotation and supplier responses."
      actions={
        <Link href="/b2b/rfq/new" className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> New RFQ
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total RFQs", value: rfqs.length, color: "bg-white border-border" },
            { label: "Awaiting quotes", value: awaiting, color: "bg-blue-50 border-blue-200" },
            { label: "Quotes to review", value: quoted, color: "bg-amber-50 border-amber-200" },
            { label: "Accepted", value: accepted, color: "bg-green-50 border-green-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {rfqs.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground mb-4">No RFQs yet — request quotes from verified suppliers for bulk purchases.</p>
              <Link href="/b2b/rfq/new" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                <Plus className="h-4 w-4" /> Create your first RFQ
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    {["RFQ", "Items", "Supplier", "Quoted total", "Status", "Created"].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rfqs.map((r) => {
                    const cfg = STATUS_CONFIG[r.status];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <Link href={`/b2b/rfq/${r.id}`} className="font-medium text-primary hover:underline">
                            {r.rfqNumber}
                          </Link>
                          {r.requiredBy && (
                            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" /> needed {format(new Date(r.requiredBy), "MMM d")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs">
                          <p className="truncate">
                            {r.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                            {r.items.length > 2 ? ` +${r.items.length - 2} more` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.seller?.businessNameEn ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold">
                          {r.totalQuoted ? formatCurrency(Number(r.totalQuoted), r.currency as never) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(r.createdAt), "MMM d, yyyy")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </B2BShell>
  );
}
