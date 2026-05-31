import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { FileText, CheckCircle, Clock, XCircle, TrendingUp } from "lucide-react";

export const metadata = { title: "Quote History" };

const MOCK_QUOTE_HISTORY = [
  { id: "q001", rfqNumber: "RFQ-2024-00241", buyer: "Gulf Industrial Supplies LLC", description: "Safety Helmets EN397 × 200 units", totalAmount: 8400, currency: "AED", submittedAt: "Nov 22, 2024", validUntil: "Dec 22, 2024", status: "ACCEPTED", leadTimeDays: 5 },
  { id: "q002", rfqNumber: "RFQ-2024-00238", buyer: "Al Noor Trading Co", description: "Nitrile Gloves × 200 boxes", totalAmount: 7200, currency: "AED", submittedAt: "Nov 20, 2024", validUntil: "Dec 20, 2024", status: "PENDING", leadTimeDays: 3 },
  { id: "q003", rfqNumber: "RFQ-2024-00230", buyer: "Doha Facilities Management", description: "CO2 Fire Extinguishers × 30 units", totalAmount: 4500, currency: "AED", submittedAt: "Nov 18, 2024", validUntil: "Dec 5, 2024", status: "DECLINED", leadTimeDays: 7 },
  { id: "q004", rfqNumber: "RFQ-2024-00219", buyer: "Kuwait Office Solutions", description: "Ergonomic Office Chairs × 15 units", totalAmount: 10500, currency: "AED", submittedAt: "Nov 10, 2024", validUntil: "Nov 25, 2024", status: "ACCEPTED", leadTimeDays: 10 },
  { id: "q005", rfqNumber: "RFQ-2024-00212", buyer: "Sharjah Safety Systems", description: "Safety Vests × 250 pcs", totalAmount: 3250, currency: "AED", submittedAt: "Nov 8, 2024", validUntil: "Nov 23, 2024", status: "EXPIRED", leadTimeDays: 4 },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:  { label: "Awaiting Response", color: "bg-amber-100 text-amber-700",  icon: Clock },
  ACCEPTED: { label: "Accepted",          color: "bg-green-100 text-green-700",  icon: CheckCircle },
  DECLINED: { label: "Declined",          color: "bg-red-100 text-red-700",      icon: XCircle },
  EXPIRED:  { label: "Expired",           color: "bg-gray-100 text-gray-500",    icon: Clock },
};

const TABS = ["All","Accepted","Pending","Declined","Expired"] as const;

export default async function QuoteHistoryPage() {
  const { seller } = await requireSellerSession();

  const acceptedValue = MOCK_QUOTE_HISTORY.filter((q) => q.status === "ACCEPTED").reduce((s, q) => s + q.totalAmount, 0);
  const winRate = Math.round((MOCK_QUOTE_HISTORY.filter((q) => q.status === "ACCEPTED").length / MOCK_QUOTE_HISTORY.length) * 100);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quote History</h1>
            <p className="text-sm text-muted-foreground">All quotations you have submitted to buyers</p>
          </div>
          <Link href="/messages" className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> New Quote
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Submitted", value: MOCK_QUOTE_HISTORY.length, icon: FileText, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { label: "Accepted", value: MOCK_QUOTE_HISTORY.filter(q=>q.status==="ACCEPTED").length, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200" },
            { label: "Win Rate", value: `${winRate}%`, icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
            { label: "Accepted Value", value: formatCurrency(acceptedValue, "AED"), icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <Icon className={`h-4 w-4 ${color} mb-2`} />
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-border rounded-xl p-1 w-fit overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} type="button"
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "All" ? "bg-slate-900 text-white" : "text-muted-foreground hover:text-foreground hover:bg-slate-50"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["RFQ #","Buyer","Description","Total","Lead Time","Submitted","Valid Until","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_QUOTE_HISTORY.map((q) => {
                  const sc = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.PENDING!;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{q.rfqNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm line-clamp-1">{q.buyer}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px]">
                        <p className="line-clamp-2">{q.description}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(q.totalAmount, q.currency as "AED")}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{q.leadTimeDays}d</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{q.submittedAt}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{q.validUntil}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {q.status === "ACCEPTED" && (
                          <Link href="/orders" className="text-xs text-blue-600 hover:underline font-medium">View Order →</Link>
                        )}
                        {q.status === "PENDING" && (
                          <span className="text-xs text-muted-foreground italic">Awaiting...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">{MOCK_QUOTE_HISTORY.length} quotes total</p>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
