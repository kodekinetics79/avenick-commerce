import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency } from "@avenick/utils";
import { RotateCcw, CheckCircle, Clock, XCircle, Package } from "lucide-react";

export const metadata = { title: "Returns" };

const RETURNS = [
  { id: "r1", ref: "RET-2024-0091", order: "ORD-2024-0788", buyer: "Ahmed Al Mansouri", item: "Safety Helmet Pro X200", reason: "Wrong item received", type: "RETURN", amount: 178, status: "PENDING", requested: "Nov 25" },
  { id: "r2", ref: "RET-2024-0088", order: "ORD-2024-0771", buyer: "Sara Khalid", item: "Nitrile Gloves (Box 100)", reason: "Damaged on arrival", type: "REFUND", amount: 90, status: "APPROVED", requested: "Nov 23" },
  { id: "r3", ref: "RET-2024-0082", order: "ORD-2024-0754", buyer: "Gulf Industrial", item: "Industrial Drill Set 18V", reason: "Not as described", type: "EXCHANGE", amount: 449, status: "PROCESSING", requested: "Nov 21" },
  { id: "r4", ref: "RET-2024-0079", order: "ORD-2024-0742", buyer: "Mohammed Al Farsi", item: "Office Chair Ergonomic", reason: "Changed mind", type: "RETURN", amount: 799, status: "REJECTED", requested: "Nov 18" },
  { id: "r5", ref: "RET-2024-0071", order: "ORD-2024-0728", buyer: "Kuwait Office Solutions", item: "LED Tube 4ft (10 pack)", reason: "Defective units", type: "REFUND", amount: 320, status: "COMPLETED", requested: "Nov 12" },
];

const STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:    { label: "Pending Review", color: "bg-amber-100 text-amber-700",   icon: Clock },
  APPROVED:   { label: "Approved",       color: "bg-blue-100 text-blue-700",     icon: CheckCircle },
  PROCESSING: { label: "Processing",     color: "bg-purple-100 text-purple-700", icon: Package },
  COMPLETED:  { label: "Completed",      color: "bg-green-100 text-green-700",   icon: CheckCircle },
  REJECTED:   { label: "Rejected",       color: "bg-red-100 text-red-700",       icon: XCircle },
};

const TABS = ["All", "Pending", "Approved", "Processing", "Completed", "Rejected"];

export default async function ReturnsPage() {
  await requireAdminSession();
  const pending = RETURNS.filter((r) => r.status === "PENDING").length;
  const refundValue = RETURNS.filter((r) => ["APPROVED", "PROCESSING", "COMPLETED"].includes(r.status)).reduce((s, r) => s + r.amount, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns &amp; Refunds</h1>
          <p className="text-sm text-muted-foreground">Manage buyer return requests across the marketplace</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending Review", value: pending, color: "text-amber-600", bg: pending > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-border" },
            { label: "Total Requests", value: RETURNS.length, color: "text-slate-800", bg: "bg-white border-border" },
            { label: "Refund Value", value: formatCurrency(refundValue, "AED"), color: "text-green-700", bg: "bg-white border-border" },
            { label: "Return Rate", value: "2.5%", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} type="button" className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${t === "All" ? "bg-slate-900 text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>{t}</button>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>{["Return #", "Order", "Buyer", "Item", "Reason", "Type", "Amount", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {RETURNS.map((r) => {
                  const sc = STATUS[r.status] ?? STATUS.PENDING;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={r.id} className={`hover:bg-secondary/40 transition-colors ${r.status === "PENDING" ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{r.ref}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.order}</td>
                      <td className="px-4 py-3 font-medium">{r.buyer}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{r.item}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.reason}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{r.type}</span></td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(r.amount, "AED")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}><StatusIcon className="h-3 w-3" /> {sc.label}</span></td>
                      <td className="px-4 py-3">
                        {r.status === "PENDING" ? (
                          <div className="flex gap-1.5">
                            <button type="button" className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg hover:bg-green-600 font-medium transition-colors">Approve</button>
                            <button type="button" className="text-xs border border-border text-muted-foreground px-2.5 py-1 rounded-lg hover:bg-red-50 hover:text-red-600 font-medium transition-colors">Reject</button>
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
    </AdminLayout>
  );
}
