import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { Quote, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";

export const metadata = { title: "Quotes" };

const QUOTES = [
  { id: "q1", quoteNo: "QT-2024-0412", rfq: "RFQ-2024-00241", buyer: "Gulf Industrial Supplies", supplier: "SafeGuard AE", amount: 8400, currency: "AED", status: "ACCEPTED", submitted: "Nov 22", margin: 18 },
  { id: "q2", quoteNo: "QT-2024-0418", rfq: "RFQ-2024-00238", buyer: "Al Noor Trading Co", supplier: "MediSafe Gulf", amount: 7200, currency: "AED", status: "PENDING", submitted: "Nov 23", margin: 22 },
  { id: "q3", quoteNo: "QT-2024-0421", rfq: "RFQ-2024-00244", buyer: "Apex Procurement FZCO", supplier: "Gulf Industrial", amount: 19500, currency: "AED", status: "PENDING", submitted: "Nov 24", margin: 15 },
  { id: "q4", quoteNo: "QT-2024-0399", rfq: "RFQ-2024-00230", buyer: "Doha Facilities Mgmt", supplier: "FireShield LLC", amount: 4500, currency: "AED", status: "DECLINED", submitted: "Nov 18", margin: 20 },
  { id: "q5", quoteNo: "QT-2024-0388", rfq: "RFQ-2024-00219", buyer: "Kuwait Office Solutions", supplier: "OfficeZone KW", amount: 10500, currency: "AED", status: "ACCEPTED", submitted: "Nov 10", margin: 24 },
];

const STATUS: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:  { label: "Pending",  color: "bg-amber-100 text-amber-700", icon: Clock },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700", icon: CheckCircle },
  DECLINED: { label: "Declined", color: "bg-red-100 text-red-700",     icon: XCircle },
};

const TABS = ["All", "Pending", "Accepted", "Declined"];

export default async function QuotesPage() {
  await requireAdminSession();
  const accepted = QUOTES.filter((q) => q.status === "ACCEPTED");
  const acceptedValue = accepted.reduce((s, q) => s + q.amount, 0);
  const winRate = Math.round((accepted.length / QUOTES.length) * 100);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">Supplier quotes across all marketplace RFQs</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Quotes", value: QUOTES.length, color: "text-foreground", bg: "bg-white border-border" },
            { label: "Pending", value: QUOTES.filter((q) => q.status === "PENDING").length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Win Rate", value: `${winRate}%`, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Accepted Value", value: formatCurrency(acceptedValue, "AED"), color: "text-green-700", bg: "bg-white border-border" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button key={t} type="button" className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${t === "All" ? "bg-slate-900 text-white" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>{t}</button>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>{["Quote #", "RFQ", "Buyer", "Supplier", "Amount", "Margin", "Status", "Submitted", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {QUOTES.map((q) => {
                  const sc = STATUS[q.status] ?? STATUS.PENDING;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={q.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{q.quoteNo}</td>
                      <td className="px-4 py-3"><Link href="/rfqs" className="font-mono text-xs text-primary hover:underline">{q.rfq}</Link></td>
                      <td className="px-4 py-3 font-medium">{q.buyer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.supplier}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(q.amount, q.currency as "AED")}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground"><TrendingUp className="h-3 w-3" /> {q.margin}%</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}><StatusIcon className="h-3 w-3" /> {sc.label}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{q.submitted}</td>
                      <td className="px-4 py-3"><button type="button" className="text-xs text-primary hover:underline font-medium">View</button></td>
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
