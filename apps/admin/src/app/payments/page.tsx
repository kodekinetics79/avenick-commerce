import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_PAYMENTS } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { CreditCard, ArrowLeft, CheckCircle, Clock, XCircle, RotateCcw, Building2, Smartphone } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Payments" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  SUCCEEDED: { label: "Succeeded", color: "bg-green-100 text-green-700",  icon: CheckCircle },
  PENDING:   { label: "Pending",   color: "bg-amber-100 text-amber-700",  icon: Clock },
  FAILED:    { label: "Failed",    color: "bg-red-100 text-red-700",      icon: XCircle },
  REFUNDED:  { label: "Refunded",  color: "bg-slate-100 text-muted-foreground",  icon: RotateCcw },
};

const METHOD_LABEL: Record<string, { label: string; icon: typeof CreditCard }> = {
  BANK_TRANSFER: { label: "Bank Transfer", icon: Building2 },
  CREDIT_CARD:   { label: "Card",          icon: CreditCard },
  MADA:          { label: "mada",          icon: CreditCard },
  APPLE_PAY:     { label: "Apple Pay",     icon: Smartphone },
  CREDIT_TERMS:  { label: "Credit Terms",  icon: Building2 },
};

const TABS = ["All", "Succeeded", "Pending", "Failed", "Refunded"] as const;

export default async function PaymentsPage() {
  await requireAdminSession();

  const succeeded = MOCK_PAYMENTS.filter(p => p.status === "SUCCEEDED");
  const pending   = MOCK_PAYMENTS.filter(p => p.status === "PENDING");
  const failed    = MOCK_PAYMENTS.filter(p => p.status === "FAILED");
  const totalCollected = succeeded.reduce((s, p) => s + p.amount, 0);
  const pendingValue = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/finance" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Finance
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Payments</span>
            </div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-sm text-muted-foreground">Transaction ledger across all payment gateways</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Collected", value: formatCurrency(totalCollected, "AED"), color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "Pending", value: formatCurrency(pendingValue, "AED"), color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Failed", value: failed.length, color: failed.length > 0 ? "text-red-600" : "text-muted-foreground", bg: failed.length > 0 ? "bg-red-50 border-red-200" : "bg-white border-border" },
            { label: "Total Txns", value: MOCK_PAYMENTS.length, color: "text-foreground", bg: "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Failed alert */}
        {failed.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="font-semibold text-red-800 text-sm">{failed.length} failed payment{failed.length !== 1 ? "s" : ""} — follow up with customers to retry</p>
          </div>
        )}

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
                  {["Reference","Invoice","Payer","Method","Gateway","Amount","Status","Date","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_PAYMENTS.map((p) => {
                  const sc = STATUS_CONFIG[p.status];
                  const StatusIcon = sc.icon;
                  const ml = METHOD_LABEL[p.method] ?? { label: p.method, icon: CreditCard };
                  const MethodIcon = ml.icon;
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.status === "FAILED" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-muted-foreground">{p.ref}</td>
                      <td className="px-4 py-3 font-mono text-xs text-primary">{p.invoiceNo}</td>
                      <td className="px-4 py-3 font-medium text-sm">{p.payer}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MethodIcon className="h-3 w-3" /> {ml.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.gateway}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(p.amount, p.currency as "AED")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.processedAt}</td>
                      <td className="px-4 py-3">
                        {p.status === "FAILED" && <button type="button" className="text-xs bg-primary text-white px-2.5 py-1 rounded-lg hover:bg-primary font-medium transition-colors">Retry</button>}
                        {p.status === "SUCCEEDED" && <button type="button" className="text-xs text-primary hover:underline font-medium">Receipt</button>}
                        {p.status === "PENDING" && <span className="text-xs text-muted-foreground italic">Awaiting</span>}
                        {p.status === "REFUNDED" && <span className="text-xs text-muted-foreground">Refunded</span>}
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
