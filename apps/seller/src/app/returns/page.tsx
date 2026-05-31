import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@avenick/utils";
import { RotateCcw, CheckCircle, Clock, XCircle, Package } from "lucide-react";

export const metadata = { title: "Returns" };

const RETURNS = [
  { id: "r1", ref: "RET-2024-0091", order: "ORD-2024-0788", buyer: "Ahmed Al Mansouri", item: "Safety Helmet Pro X200", reason: "Wrong item received", amount: 178, status: "PENDING", requested: "Nov 25" },
  { id: "r2", ref: "RET-2024-0082", order: "ORD-2024-0754", buyer: "Gulf Industrial", item: "Industrial Drill Set 18V", reason: "Not as described", amount: 449, status: "PROCESSING", requested: "Nov 21" },
  { id: "r3", ref: "RET-2024-0071", order: "ORD-2024-0728", buyer: "Kuwait Office Solutions", item: "LED Tube 4ft (10 pack)", reason: "Defective units", amount: 320, status: "COMPLETED", requested: "Nov 12" },
];

const STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:    { label: "Action Needed", color: "bg-amber-100 text-amber-700",   icon: Clock },
  PROCESSING: { label: "Processing",    color: "bg-purple-100 text-purple-700", icon: Package },
  COMPLETED:  { label: "Completed",     color: "bg-green-100 text-green-700",   icon: CheckCircle },
  REJECTED:   { label: "Rejected",      color: "bg-red-100 text-red-700",       icon: XCircle },
};

export default async function SellerReturnsPage() {
  const { seller } = await requireSellerSession();
  const pending = RETURNS.filter((r) => r.status === "PENDING").length;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          <p className="text-sm text-muted-foreground">Return requests for your products</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Action Needed", value: pending, color: "text-amber-600", bg: pending > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border" },
            { label: "Total Returns", value: RETURNS.length, color: "text-foreground", bg: "bg-white border-border" },
            { label: "Return Rate", value: "2.1%", color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Avg Resolution", value: "1.8d", color: "text-primary", bg: "bg-blue-50 border-blue-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {pending > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="font-semibold text-amber-800 text-sm">{pending} return{pending !== 1 ? "s" : ""} awaiting your response — respond within 48h to maintain your performance score.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>{["Return #", "Order", "Buyer", "Item", "Reason", "Amount", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {RETURNS.map((r) => {
                  const sc = STATUS[r.status] ?? STATUS.PENDING!;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={r.id} className={`hover:bg-secondary/40 transition-colors ${r.status === "PENDING" ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{r.ref}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.order}</td>
                      <td className="px-4 py-3 font-medium">{r.buyer}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{r.item}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.reason}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(r.amount, "AED")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}><StatusIcon className="h-3 w-3" /> {sc.label}</span></td>
                      <td className="px-4 py-3">
                        {r.status === "PENDING" ? (
                          <div className="flex gap-1.5">
                            <button type="button" className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg hover:bg-green-600 font-medium transition-colors">Accept</button>
                            <button type="button" className="text-xs border border-border text-muted-foreground px-2.5 py-1 rounded-lg hover:bg-red-50 hover:text-red-600 font-medium transition-colors">Dispute</button>
                          </div>
                        ) : (
                          <button type="button" className="text-xs text-primary hover:underline font-medium">View</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
