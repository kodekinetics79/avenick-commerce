import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { MOCK_SETTLEMENTS } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Receipt, ArrowLeft, CheckCircle, Clock, RefreshCw, Store } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Settlements" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING:    { label: "Pending",    color: "bg-amber-100 text-amber-700",  icon: Clock },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-primary",    icon: RefreshCw },
  PAID:       { label: "Paid",       color: "bg-green-100 text-green-700",  icon: CheckCircle },
};

const TABS = ["All", "Pending", "Processing", "Paid"] as const;

export default async function SettlementsPage() {
  await requireAdminSession();

  const pending = MOCK_SETTLEMENTS.filter(s => s.status === "PENDING");
  const pendingPayout = pending.reduce((s, x) => s + x.netPayout, 0);
  const totalCommission = MOCK_SETTLEMENTS.reduce((s, x) => s + x.commission, 0);
  const totalGross = MOCK_SETTLEMENTS.reduce((s, x) => s + x.grossSales, 0);

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
              <span className="text-sm font-medium">Settlements</span>
            </div>
            <h1 className="text-2xl font-bold">Supplier Settlements</h1>
            <p className="text-sm text-muted-foreground">Payouts to sellers net of commission and fees</p>
          </div>
          {pending.length > 0 && (
            <button type="button" className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <CheckCircle className="h-3.5 w-3.5" /> Process All Pending
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending Payout", value: formatCurrency(pendingPayout, "AED"), color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
            { label: "Gross Sales (GMV)", value: formatCurrency(totalGross, "AED"), color: "text-foreground", bg: "bg-white border-border" },
            { label: "Commission Earned", value: formatCurrency(totalCommission, "AED"), color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "Pending Sellers", value: pending.length, color: "text-primary", bg: "bg-blue-50 border-blue-200" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
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
                  {["Seller","Period","Orders","Gross Sales","Commission","Handling","Net Payout","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_SETTLEMENTS.map((s) => {
                  const sc = STATUS_CONFIG[s.status];
                  const StatusIcon = sc.icon;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Store className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <p className="font-medium text-sm">{s.seller}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.periodEnd}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{s.orders}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(s.grossSales, s.currency as "AED")}</td>
                      <td className="px-4 py-3">
                        <span className="text-red-600 font-medium">−{formatCurrency(s.commission, s.currency as "AED")}</span>
                        <span className="text-xs text-muted-foreground block">{s.commissionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-red-600 font-medium">−{formatCurrency(s.handlingFees, s.currency as "AED")}</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(s.netPayout, s.currency as "AED")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "PENDING" && <button type="button" className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 font-medium transition-colors">Pay Now</button>}
                        {s.status === "PROCESSING" && <span className="text-xs text-primary font-medium">In progress…</span>}
                        {s.status === "PAID" && <button type="button" className="text-xs text-primary hover:underline font-medium">Statement</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-slate-50">
            <p className="text-xs text-muted-foreground">
              Settlements processed bi-weekly · Net payout = Gross − Commission − Handling fees
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
