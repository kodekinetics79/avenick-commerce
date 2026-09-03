import { requireAdminSession } from "@/lib/auth";
import { getFinanceOverview, getCommissions, Prisma, type Currency } from "@avenick/database";
import { AdminLayout } from "@/components/layout/admin-layout";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { TrendingUp, Clock, Receipt, CreditCard, FileSpreadsheet, ArrowRight, Percent, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  PageHeader, CellGrid, Surface, Bar, Eyebrow, EmptyState, StatusPill, Button,
} from "@avenick/ui";
import { MoneyStat } from "./money-figures";

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
 * Bar value as a percentage of the largest month *in the same currency*. Scales
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

  // Four positions. GMV leads at section rank because it is the figure the page
  // is about; the other three qualify it.
  const kpis = [
    { label: "GMV (month)", rows: overview.gmvMonth, sub: `${inline(overview.gmvYear)} year to date`, icon: TrendingUp, lead: true },
    { label: "Commission revenue (month)", rows: overview.commissionMonth, sub: `${inline(overview.commissionYear)} year to date`, icon: Percent, lead: false },
    { label: "Pending payouts", rows: overview.pendingPayouts, sub: `${pendingPayoutCount} payout${pendingPayoutCount === 1 ? "" : "s"} awaiting settlement`, icon: Clock, lead: false },
    { label: "Refunds in flight", rows: overview.refundsPending, sub: `${refundsPendingCount} open refund${refundsPendingCount === 1 ? "" : "s"}`, icon: RotateCcw, lead: false },
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
      <div className="space-y-block">
        <PageHeader
          eyebrow="Finance"
          title="Finance overview"
          description="Live revenue, commissions, payouts and VAT from the order ledger."
          dateline="Every figure in the currency it was billed in · the platform holds no exchange rates, so amounts are never combined"
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/payments">
                  <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Payments
                </Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/settlements">
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" /> Settlements
                </Link>
              </Button>
            </>
          }
        />

        <CellGrid cols={{ base: 1, sm: 2, lg: 4 }} density="compact">
          {kpis.map((k) => (
            <MoneyStat
              key={k.label}
              label={k.label}
              rank={k.lead ? "section" : "inline"}
              lines={k.rows.map((row) => ({ currency: row.currency, formatted: money(row.amount, row.currency) }))}
              note={k.sub}
            />
          ))}
        </CellGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Monthly GMV bars, one block per currency */}
          <Surface className="flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-border-strong pb-2">
              <h2 className="u-h3 text-ink-1">Paid GMV by month ({new Date().getFullYear()})</h2>
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            </div>
            {series.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No paid order has been placed this year."
                body="A month appears here once an order in that month reaches paid."
              />
            ) : (
              <div className="space-y-5">
                {series.map((s) => (
                  <div key={s.currency}>
                    {/* One scale per currency — the bars in one block are only
                        comparable with each other, never across blocks. */}
                    <Eyebrow className="mb-2">{s.currency}</Eyebrow>
                    <div className="space-y-2">
                      {s.rows.map((m, index) => (
                        <div key={`${s.currency}-${String(m.month)}`} className="flex items-center gap-3">
                          <span className="u-meta w-8 shrink-0 text-ink-3">{format(m.month, "MMM")}</span>
                          <Bar
                            value={barWidth(m.gmv, s.max)}
                            max={100}
                            index={index}
                            label={`${format(m.month, "MMMM")} paid GMV, ${money(m.gmv, s.currency)}`}
                            className="flex-1"
                          />
                          <span className="fig u-meta w-28 shrink-0 text-end text-ink-1">{money(m.gmv, s.currency)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 border-t border-hairline pt-3">
              <Eyebrow>VAT collected, year to date</Eyebrow>
              <span className="fig u-ui text-ink-1">{inline(overview.vatCollectedYear)}</span>
              <Button variant="link" size="xs" asChild className="ms-auto">
                <Link href="/vat">
                  VAT summary <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </Surface>

          {/* Recent commissions */}
          <Surface className="flex flex-col p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-border-strong pb-2">
              <h2 className="u-h3 text-ink-1">Recent commissions</h2>
              <span className="u-meta text-ink-2">
                <span className="fig">{unsettledCommissionCount}</span> unsettled · {inline(overview.unsettledCommissions)}
              </span>
            </div>
            {commissions.length === 0 ? (
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No commission has been accrued yet."
                body="Commission accrues when an order containing a seller's items is paid."
              />
            ) : (
              <ul>
                {commissions.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
                    <div className="min-w-0">
                      <p className="u-ui truncate font-medium text-ink-1">{c.seller.businessNameEn}</p>
                      <p className="u-meta text-ink-3">
                        <span className="u-mono">{c.order.orderNumber}</span> · {Number(c.rate)}% of {money(c.order.total, c.order.currency)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="fig u-ui font-medium text-ink-1">{money(c.amount, c.currency)}</span>
                      <StatusPill tone={c.settledAt ? "success" : "warning"}>
                        {c.settledAt ? `Settled ${format(c.settledAt, "MMM d")}` : "Unsettled"}
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Surface>
        </div>

        {/* The three places this page hands off to. Raised, because each one is
            a thing you press. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { href: "/payments", label: "Payments ledger", desc: "Every gateway transaction with status and reference" },
            { href: "/settlements", label: "Supplier settlements", desc: `${pendingPayoutCount} payout${pendingPayoutCount === 1 ? "" : "s"} awaiting processing` },
            { href: "/vat", label: "VAT summary", desc: "Output VAT by month and currency" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group u-focus block rounded-lg">
              <Surface interactive className="h-full p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="u-ui font-medium text-ink-1">{l.label}</p>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-hover ease-standard group-hover:translate-x-[calc(2px*var(--dir))] rtl:rotate-180"
                    aria-hidden="true"
                  />
                </div>
                <p className="u-meta mt-1 text-ink-2">{l.desc}</p>
              </Surface>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
