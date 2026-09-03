import { requireAdminSession } from "@/lib/auth";
import { getFinanceOverview, getCommissions, Prisma, type Currency } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { TrendingUp, Clock, Receipt, CreditCard, FileSpreadsheet, ArrowRight, Percent, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Finance Overview" };
export const dynamic = "force-dynamic";

const ZERO = new Prisma.Decimal(0);

/** Money crosses to a string here and nowhere earlier; currency is never blended. */
const money = (amount: Prisma.Decimal, currency: Currency) =>
  formatCurrency(Number(amount), currency as SupportedCurrency);

/** Per-currency figures on one line, for the secondary text under a tile. */
const inline = (rows: ReadonlyArray<{ currency: Currency; amount: Prisma.Decimal }>) =>
  rows.length === 0 ? "—" : rows.map((row) => money(row.amount, row.currency)).join(" · ");

/** Rows are counts of records, not money, so they may be added across currencies. */
const records = (rows: ReadonlyArray<{ count: number }>) =>
  rows.reduce((sum, row) => sum + row.count, 0);

/**
 * Bar width as a percentage of the largest month *in the same currency*. Scales
 * are per currency for the same reason the amounts are: nothing here can be
 * compared across them. Negative months (refunds exceeding sales) draw the
 * minimum stub rather than an inverted bar.
 */
const barWidth = (gmv: Prisma.Decimal, max: Prisma.Decimal) => {
  if (max.lte(ZERO)) return 2;
  return Math.min(100, Math.max(2, (Number(gmv) / Number(max)) * 100));
};

export default async function FinancePage() {
  await requireAdminSession();

  const [overview, { commissions }] = await Promise.all([
    getFinanceOverview(),
    getCommissions({ page: 1, limit: 8 }),
  ]);

  const pendingPayoutCount = records(overview.pendingPayouts);
  const refundsPendingCount = records(overview.refundsPending);

  const kpis = [
    { label: "GMV (month)", rows: overview.gmvMonth, sub: `${inline(overview.gmvYear)} YTD`, icon: TrendingUp, color: "bg-green-50 border-green-200 text-green-600" },
    { label: "Commission revenue (month)", rows: overview.commissionMonth, sub: `${inline(overview.commissionYear)} YTD`, icon: Percent, color: "bg-blue-50 border-blue-200 text-primary" },
    { label: "Pending payouts", rows: overview.pendingPayouts, sub: `${pendingPayoutCount} payout${pendingPayoutCount === 1 ? "" : "s"} awaiting settlement`, icon: Clock, color: "bg-amber-50 border-amber-200 text-amber-600" },
    { label: "Refunds in flight", rows: overview.refundsPending, sub: `${refundsPendingCount} open refund${refundsPendingCount === 1 ? "" : "s"}`, icon: RotateCcw, color: "bg-red-50 border-red-200 text-red-600" },
  ];

  // One chart series per currency, each with its own scale.
  const monthlyByCurrency = new Map<Currency, Array<(typeof overview.monthly)[number]>>();
  for (const row of overview.monthly) {
    const series = monthlyByCurrency.get(row.currency) ?? [];
    series.push(row);
    monthlyByCurrency.set(row.currency, series);
  }
  const series = [...monthlyByCurrency.entries()].map(([currency, rows]) => ({
    currency,
    rows,
    max: rows.reduce((largest, row) => (row.gmv.gt(largest) ? row.gmv : largest), ZERO),
  }));

  const unsettledCommissionCount = records(overview.unsettledCommissions);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Finance Overview</h1>
            <p className="text-muted-foreground text-sm">
              Live revenue, commissions, payouts, and VAT from the order ledger. Every figure is reported in the
              currency it was billed in — the platform holds no exchange rates, so amounts are never combined.
            </p>
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
                {k.rows.length === 0 ? (
                  <p className="text-xl font-bold mt-1">—</p>
                ) : (
                  k.rows.map((row) => (
                    <p key={row.currency} className="text-xl font-bold mt-1">{money(row.amount, row.currency)}</p>
                  ))
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly GMV bars, one block per currency */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Paid GMV by month ({new Date().getFullYear()})</h2>
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            </div>
            {series.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No paid orders yet this year.</p>
            ) : (
              <div className="space-y-5">
                {series.map((s) => (
                  <div key={s.currency}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{s.currency}</p>
                    <div className="space-y-2">
                      {s.rows.map((m) => (
                        <div key={`${s.currency}-${String(m.month)}`} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-8">{format(m.month, "MMM")}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${barWidth(m.gmv, s.max)}%` }} />
                          </div>
                          <span className="text-xs font-medium w-28 text-end">{money(m.gmv, s.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              VAT collected YTD: <span className="font-semibold text-foreground">{inline(overview.vatCollectedYear)}</span>
              {" · "}
              <Link href="/vat" className="text-primary hover:underline">VAT summary →</Link>
            </p>
          </div>

          {/* Recent commissions */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recent commissions</h2>
              <span className="text-xs text-muted-foreground">
                {unsettledCommissionCount} unsettled · {inline(overview.unsettledCommissions)}
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
                        {c.order.orderNumber} · {Number(c.rate)}% of {money(c.order.total, c.order.currency)}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p className="text-sm font-semibold">{money(c.amount, c.currency)}</p>
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
            { href: "/settlements", label: "Supplier settlements", desc: `${pendingPayoutCount} payouts awaiting processing` },
            { href: "/vat", label: "VAT summary", desc: "Output VAT by month and currency" },
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
