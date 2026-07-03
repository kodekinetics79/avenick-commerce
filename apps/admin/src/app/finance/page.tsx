import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getFinanceOverview, getCommissions } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { TrendingUp, Clock, Receipt, CreditCard, FileSpreadsheet, ArrowRight, Percent, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Finance Overview" };
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  await requireAdminSession();

  const [overview, { commissions }] = await Promise.all([
    getFinanceOverview(),
    getCommissions({ page: 1, limit: 8 }),
  ]);

  const kpis = [
    { label: "GMV (month)", value: formatCurrency(overview.gmvMonth, "AED"), sub: `${formatCurrency(overview.gmvYear, "AED")} YTD`, icon: TrendingUp, color: "bg-green-50 border-green-200 text-green-600" },
    { label: "Commission revenue (month)", value: formatCurrency(overview.commissionMonth, "AED"), sub: `${formatCurrency(overview.commissionYear, "AED")} YTD`, icon: Percent, color: "bg-blue-50 border-blue-200 text-primary" },
    { label: "Pending payouts", value: formatCurrency(overview.pendingPayoutAmount, "AED"), sub: `${overview.pendingPayoutCount} payout${overview.pendingPayoutCount === 1 ? "" : "s"} awaiting settlement`, icon: Clock, color: "bg-amber-50 border-amber-200 text-amber-600" },
    { label: "Refunds in flight", value: formatCurrency(overview.refundsPendingAmount, "AED"), sub: `${overview.refundsPendingCount} open refund${overview.refundsPendingCount === 1 ? "" : "s"}`, icon: RotateCcw, color: "bg-red-50 border-red-200 text-red-600" },
  ];

  const maxGmv = Math.max(1, ...overview.monthly.map((m) => m.gmv));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Finance Overview</h1>
            <p className="text-muted-foreground text-sm">Live revenue, commissions, payouts, and VAT from the order ledger.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/payments" className="flex items-center gap-1.5 text-sm border border-border bg-white text-muted-foreground hover:bg-slate-50 px-3 py-2 rounded-xl font-medium transition-colors">
              <CreditCard className="h-3.5 w-3.5" /> Payments
            </Link>
            <Link href="/settlements" className="flex items-center gap-1.5 text-sm bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-semibold transition-colors">
              <Receipt className="h-3.5 w-3.5" /> Settlements
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className={`rounded-2xl border p-4 ${k.color.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.color.split(" ")[2]}`} />
                </div>
                <p className="text-xl font-bold mt-1">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly GMV bars */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Paid GMV by month ({new Date().getFullYear()})</h2>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </div>
            {overview.monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No paid orders yet this year.</p>
            ) : (
              <div className="space-y-2">
                {overview.monthly.map((m) => (
                  <div key={String(m.month)} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-8">{format(m.month, "MMM")}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(2, (m.gmv / maxGmv) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-28 text-end">{formatCurrency(m.gmv, "AED")}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              VAT collected YTD: <span className="font-semibold text-foreground">{formatCurrency(overview.vatCollectedYear, "AED")}</span>
              {" · "}
              <Link href="/vat" className="text-primary hover:underline">VAT summary →</Link>
            </p>
          </div>

          {/* Recent commissions */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent commissions</h2>
              <span className="text-xs text-muted-foreground">
                {overview.unsettledCommissionCount} unsettled · {formatCurrency(overview.unsettledCommissionAmount, "AED")}
              </span>
            </div>
            {commissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No commissions recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {commissions.map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.seller.businessNameEn}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.order.orderNumber} · {Number(c.rate)}% of {formatCurrency(Number(c.order.total), c.currency as never)}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(Number(c.amount), c.currency as never)}</p>
                      <p className={`text-[11px] ${c.settledAt ? "text-green-600" : "text-amber-600"}`}>
                        {c.settledAt ? `Settled ${format(c.settledAt, "MMM d")}` : "Unsettled"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/payments", label: "Payments ledger", desc: "Every gateway transaction with status and reference" },
            { href: "/settlements", label: "Supplier settlements", desc: `${overview.pendingPayoutCount} payouts awaiting processing` },
            { href: "/vat", label: "VAT summary", desc: "Output VAT by month and jurisdiction" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group bg-white rounded-2xl border border-border p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{l.label}</p>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
