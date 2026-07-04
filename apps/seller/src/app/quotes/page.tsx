import { SellerLayout } from "@/components/layout/seller-layout";
import { fetchSellerBackend } from "@/lib/backend";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { FileText, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";

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

export default async function QuoteHistoryPage() {
  type RFQRow = {
    id: string;
    rfqNumber: string;
    status: string;
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

  const accepted = rfqs.filter((r) => r.status === "ACCEPTED");
  const responded = rfqs.filter((r) => ["ACCEPTED", "REJECTED", "EXPIRED"].includes(r.status));
  const acceptedValue = accepted.reduce((s, r) => s + (r.totalQuoted ? Number(r.totalQuoted) : 0), 0);
  const winRate = responded.length > 0 ? Math.round((accepted.length / responded.length) * 100) : 0;

  const stats = [
    { label: "Total submitted", value: rfqs.length, icon: FileText, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
    { label: "Accepted", value: accepted.length, icon: CheckCircle, color: "text-success", bg: "bg-success/5 border-success/20" },
    { label: "Win rate", value: `${winRate}%`, icon: TrendingUp, color: "text-accent", bg: "bg-accent/5 border-accent/20" },
    { label: "Accepted value", value: formatCurrency(acceptedValue, "AED"), icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quote history</h1>
            <p className="text-sm text-muted-foreground">All quotations you have submitted to buyers</p>
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
                        <td className="px-4 py-3 font-mono font-semibold">{r.totalQuoted ? formatCurrency(Number(r.totalQuoted), "AED") : "—"}</td>
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
