import { requireSellerSession } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@manzil/utils";
import { FileText, CheckCircle, Clock, AlertTriangle, Download } from "lucide-react";

export const metadata = { title: "Invoices" };

const MOCK_INVOICES = [
  { id: "inv001", invoiceNumber: "INV-2024-0091", orderNumber: "ORD-2024-0831", buyer: "Gulf Industrial Supplies LLC", amount: 8400, vatAmount: 420, total: 8820, currency: "AED", issuedAt: "Nov 22, 2024", dueDate: "Dec 22, 2024", status: "PAID" },
  { id: "inv002", invoiceNumber: "INV-2024-0089", orderNumber: "ORD-2024-0829", buyer: "Al Noor Trading Co", amount: 3200, vatAmount: 160, total: 3360, currency: "AED", issuedAt: "Nov 20, 2024", dueDate: "Dec 20, 2024", status: "PENDING" },
  { id: "inv003", invoiceNumber: "INV-2024-0085", orderNumber: "ORD-2024-0819", buyer: "Muscat Construction Supply", amount: 14200, vatAmount: 710, total: 14910, currency: "AED", issuedAt: "Nov 15, 2024", dueDate: "Dec 15, 2024", status: "PAID" },
  { id: "inv004", invoiceNumber: "INV-2024-0079", orderNumber: "ORD-2024-0812", buyer: "Sharjah Safety Systems", amount: 2800, vatAmount: 140, total: 2940, currency: "AED", issuedAt: "Nov 8, 2024", dueDate: "Nov 23, 2024", status: "OVERDUE" },
  { id: "inv005", invoiceNumber: "INV-2024-0074", orderNumber: "ORD-2024-0805", buyer: "Kuwait Office Solutions", amount: 5600, vatAmount: 280, total: 5880, currency: "AED", issuedAt: "Nov 1, 2024", dueDate: "Dec 1, 2024", status: "PENDING" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PAID:    { label: "Paid",    color: "bg-green-100 text-green-700",  icon: CheckCircle },
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700",  icon: Clock },
  OVERDUE: { label: "Overdue", color: "bg-red-100 text-red-700",      icon: AlertTriangle },
};

export default async function InvoicesPage() {
  const { seller } = await requireSellerSession();

  const totalPaid     = MOCK_INVOICES.filter(i=>i.status==="PAID").reduce((s,i)=>s+i.total,0);
  const totalPending  = MOCK_INVOICES.filter(i=>i.status==="PENDING").reduce((s,i)=>s+i.total,0);
  const totalOverdue  = MOCK_INVOICES.filter(i=>i.status==="OVERDUE").reduce((s,i)=>s+i.total,0);

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">Tax invoices issued to buyers for completed orders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <CheckCircle className="h-4 w-4 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{MOCK_INVOICES.filter(i=>i.status==="PAID").length} invoices paid</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Clock className="h-4 w-4 text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalPending, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{MOCK_INVOICES.filter(i=>i.status==="PENDING").length} invoices pending</p>
          </div>
          <div className={`rounded-2xl p-4 border ${totalOverdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
            <AlertTriangle className={`h-4 w-4 mb-2 ${totalOverdue > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${totalOverdue > 0 ? "text-red-700" : "text-slate-800"}`}>{formatCurrency(totalOverdue, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{MOCK_INVOICES.filter(i=>i.status==="OVERDUE").length} overdue invoice{MOCK_INVOICES.filter(i=>i.status==="OVERDUE").length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Overdue alert */}
        {totalOverdue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">You have overdue invoices</p>
              <p className="text-xs text-red-700 mt-0.5">Contact Avenick Finance at finance@avenick.com to resolve outstanding payments.</p>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Invoice #","Order #","Buyer","Subtotal","VAT","Total","Issued","Due Date","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_INVOICES.map((inv) => {
                  const sc = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.PENDING!;
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${inv.status === "OVERDUE" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{inv.orderNumber}</td>
                      <td className="px-4 py-3 font-medium text-sm line-clamp-1 max-w-[150px]">{inv.buyer}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(inv.amount, inv.currency as "AED")}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatCurrency(inv.vatAmount, inv.currency as "AED")}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(inv.total, inv.currency as "AED")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{inv.issuedAt}</td>
                      <td className="px-4 py-3 text-xs font-medium">{inv.dueDate}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" />{sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                          <Download className="h-3 w-3" /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">{MOCK_INVOICES.length} invoices · VAT invoices compliant with UAE FTA requirements</p>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
