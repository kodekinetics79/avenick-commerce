import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_FINANCE_INVOICES, MOCK_SETTLEMENTS, MOCK_CREDIT_ACCOUNTS } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { DollarSign, TrendingUp, Clock, AlertCircle, Receipt, CreditCard, FileSpreadsheet, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Finance Overview" };

export default async function FinancePage() {
  await requireAdminSession();

  const totalInvoiced = MOCK_FINANCE_INVOICES.reduce((s, i) => s + i.amount, 0);
  const collected = MOCK_FINANCE_INVOICES.filter((i) => i.status === "COLLECTED").reduce((s, i) => s + i.amount, 0);
  const outstanding = MOCK_FINANCE_INVOICES.filter((i) => i.status === "OUTSTANDING").reduce((s, i) => s + i.amount, 0);
  const totalVat = MOCK_FINANCE_INVOICES.reduce((s, i) => s + i.vatAmount, 0);

  const pendingSettlements = MOCK_SETTLEMENTS.filter(s => s.status === "PENDING");
  const pendingPayout = pendingSettlements.reduce((s, x) => s + x.netPayout, 0);
  const totalCommission = MOCK_SETTLEMENTS.reduce((s, x) => s + x.commission, 0);
  const creditOverdue = MOCK_CREDIT_ACCOUNTS.reduce((s, c) => s + c.overdue, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Finance Overview</h1>
            <p className="text-muted-foreground text-sm">Revenue, invoices, settlements, and VAT</p>
          </div>
          <div className="flex gap-2">
            <Link href="/payments" className="flex items-center gap-1.5 text-sm border border-border bg-white text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
              <CreditCard className="h-3.5 w-3.5" /> Payments
            </Link>
            <Link href="/settlements" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <Receipt className="h-3.5 w-3.5" /> Settlements
            </Link>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-border p-4">
            <TrendingUp className="h-4 w-4 text-green-500 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(totalInvoiced, "AED")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Invoiced</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <DollarSign className="h-4 w-4 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-700">{formatCurrency(collected, "AED")}</p>
            <p className="text-xs text-green-600 mt-0.5">{Math.round((collected / totalInvoiced) * 100)}% collection rate</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Clock className="h-4 w-4 text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(outstanding, "AED")}</p>
            <p className="text-xs text-amber-600 mt-0.5">{MOCK_FINANCE_INVOICES.filter((i) => i.status === "OUTSTANDING").length} invoices pending</p>
          </div>
          <Link href="/vat" className="bg-white border border-border rounded-2xl p-4 hover:shadow-sm transition-all">
            <FileSpreadsheet className="h-4 w-4 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(totalVat, "AED")}</p>
            <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-0.5 font-medium">VAT payable <ArrowRight className="h-3 w-3" /></p>
          </Link>
        </div>

        {/* Settlement + credit alerts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Supplier settlements */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">{pendingSettlements.length} supplier settlements pending</p>
                <p className="text-xs text-amber-600">{formatCurrency(pendingPayout, "AED")} net payout due</p>
              </div>
            </div>
            <Link href="/settlements" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 font-medium transition-colors whitespace-nowrap">Process →</Link>
          </div>

          {/* Credit overdue */}
          <div className={`rounded-2xl p-4 flex items-center justify-between border ${creditOverdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-border"}`}>
            <div className="flex items-center gap-3">
              <AlertCircle className={`h-5 w-5 shrink-0 ${creditOverdue > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              <div>
                <p className={`font-semibold text-sm ${creditOverdue > 0 ? "text-red-800" : "text-slate-800"}`}>Credit Exposure</p>
                <p className={`text-xs ${creditOverdue > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {creditOverdue > 0 ? `${formatCurrency(creditOverdue, "AED")} overdue across accounts` : "All credit accounts current"}
                </p>
              </div>
            </div>
            <span className="text-xs text-blue-600 font-medium">{MOCK_CREDIT_ACCOUNTS.length} accounts</span>
          </div>
        </div>

        {/* Commission revenue */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Marketplace Commission — This Month</h2>
            <span className="text-xs text-green-600 font-medium">+12% vs last month</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: "Gross Commission", value: formatCurrency(totalCommission, "AED") },
              { label: "Avg Rate", value: "5.4%" },
              { label: "B2B Commission", value: formatCurrency(Math.round(totalCommission * 0.68), "AED") },
              { label: "B2C Commission", value: formatCurrency(Math.round(totalCommission * 0.32), "AED") },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-lg font-bold text-green-700">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent invoices */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Recent Invoices</h2>
            <span className="text-xs text-muted-foreground">{MOCK_FINANCE_INVOICES.length} invoices</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Invoice #","Buyer","Type","Amount","VAT","Status","Issued"].map(h => (
                    <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_FINANCE_INVOICES.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-blue-600">{inv.invoiceNo}</td>
                    <td className="px-5 py-3 font-medium">{inv.buyer}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${inv.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{inv.type}</span>
                    </td>
                    <td className="px-5 py-3 font-bold text-green-700">{formatCurrency(inv.amount, "AED")}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatCurrency(inv.vatAmount, "AED")}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${inv.status === "COLLECTED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{inv.status}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{inv.issuedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
