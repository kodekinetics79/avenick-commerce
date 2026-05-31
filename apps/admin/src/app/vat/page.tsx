import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_VAT_PERIODS } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { FileSpreadsheet, ArrowLeft, CheckCircle, Clock, Download, AlertCircle } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "VAT Summary" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  OPEN:  { label: "Open",  color: "bg-amber-100 text-amber-700", icon: Clock },
  FILED: { label: "Filed", color: "bg-green-100 text-green-700", icon: CheckCircle },
};

export default async function VATPage() {
  await requireAdminSession();

  const openPeriods = MOCK_VAT_PERIODS.filter(p => p.status === "OPEN");
  const totalDue = openPeriods.reduce((s, p) => s + p.netVatDue, 0);
  const totalOutput = MOCK_VAT_PERIODS.reduce((s, p) => s + p.outputVat, 0);
  const totalInput = MOCK_VAT_PERIODS.reduce((s, p) => s + p.inputVat, 0);

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
              <span className="text-sm font-medium">VAT</span>
            </div>
            <h1 className="text-2xl font-bold">VAT Summary</h1>
            <p className="text-sm text-muted-foreground">Tax periods, filings, and net VAT liability (UAE 5% · KSA 15%)</p>
          </div>
          <button type="button" className="flex items-center gap-1.5 border border-border bg-white text-muted-foreground hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            <Download className="h-3.5 w-3.5" /> Export VAT Report
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Net VAT Due (Open)", value: formatCurrency(totalDue, "AED"), color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Output VAT (Collected)", value: formatCurrency(totalOutput, "AED"), color: "text-green-700", bg: "bg-white border-border" },
            { label: "Input VAT (Reclaimable)", value: formatCurrency(totalInput, "AED"), color: "text-primary", bg: "bg-white border-border" },
            { label: "Open Periods", value: openPeriods.length, color: "text-foreground", bg: "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filing reminder */}
        {openPeriods.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">{openPeriods.length} VAT period{openPeriods.length !== 1 ? "s" : ""} open for filing</p>
              <p className="text-xs text-amber-600">
                Next deadline: <strong>{openPeriods.sort((a,b) => a.filingDeadline.localeCompare(b.filingDeadline))[0]?.filingDeadline}</strong> — file via FTA / ZATCA portal
              </p>
            </div>
          </div>
        )}

        {/* Periods table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">VAT Periods</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Period","Country","Rate","Output VAT","Input VAT","Net Due","Deadline","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_VAT_PERIODS.map((p) => {
                  const sc = STATUS_CONFIG[p.status];
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-sm">{p.period}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-muted-foreground px-2 py-0.5 rounded font-mono">{p.country}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.rate}%</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{formatCurrency(p.outputVat, "AED")}</td>
                      <td className="px-4 py-3 text-primary font-medium">{formatCurrency(p.inputVat, "AED")}</td>
                      <td className="px-4 py-3 font-bold text-amber-700">{formatCurrency(p.netVatDue, "AED")}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.filingDeadline}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "OPEN"
                          ? <button type="button" className="text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 font-medium transition-colors">File Return</button>
                          : <button type="button" className="text-xs text-primary hover:underline font-medium">View Filing</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">Net VAT Due = Output VAT (on sales) − Input VAT (on purchases). UAE filings via FTA, KSA via ZATCA.</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
