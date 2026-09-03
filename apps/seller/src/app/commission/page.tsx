import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { platformName } from "@avenick/utils/portal-config";
import { db, Prisma, type Currency } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { Clock, CreditCard, Info, Percent, Receipt } from "lucide-react";

export const metadata = { title: "Commission" };

/** The record table is capped for page weight; every total on this page is computed over all rows. */
const RECENT_LIMIT = 50;

const ZERO = new Prisma.Decimal(0);

/** SellerProfile.commissionRate and Commission.rate are Decimal(5,2) — print what is stored. */
function formatRate(rate: Prisma.Decimal): string {
  return `${Number(rate)}%`;
}

function money(amount: Prisma.Decimal, currency: Currency): string {
  return formatCurrency(Number(amount), currency);
}

type CurrencyTotals = {
  currency: Currency;
  netYtd: Prisma.Decimal;
  netLifetime: Prisma.Decimal;
  unsettled: Prisma.Decimal;
  rows: number;
  unsettledRows: number;
};

type MonthRow = {
  key: string;
  ts: number;
  period: string;
  currency: Currency;
  charged: Prisma.Decimal;
  /** Refund reversals, held as a positive magnitude and rendered as a credit. */
  reversed: Prisma.Decimal;
  rows: number;
  settledRows: number;
  rates: Set<string>;
};

export default async function CommissionPage() {
  const { seller, membership } = await requireSellerPermission("finance.view");
  const accountRate = seller.commissionRate;

  const [ledger, recent] = await Promise.all([
    db.commission.findMany({
      where: { sellerId: seller.id },
      select: { amount: true, rate: true, currency: true, settledAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.commission.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        amount: true,
        rate: true,
        currency: true,
        settledAt: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
            // Only this seller's lines: commission is accrued per seller on the
            // merchandise value of that seller's own items, VAT excluded.
            items: { where: { sellerId: seller.id }, select: { total: true, vatAmount: true } },
          },
        },
      },
    }),
  ]);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  // Money stays in Prisma.Decimal until the moment it is formatted, and is never
  // added across currencies: a seller can accrue in AED and SAR on one account,
  // and a single combined figure would be a number that is true of nothing.
  const totalsByCurrency = new Map<Currency, CurrencyTotals>();
  const months = new Map<string, MonthRow>();

  for (const c of ledger) {
    const totals = totalsByCurrency.get(c.currency) ?? {
      currency: c.currency,
      netYtd: ZERO,
      netLifetime: ZERO,
      unsettled: ZERO,
      rows: 0,
      unsettledRows: 0,
    };
    totals.netLifetime = totals.netLifetime.add(c.amount);
    if (c.createdAt >= yearStart) totals.netYtd = totals.netYtd.add(c.amount);
    if (!c.settledAt) {
      totals.unsettled = totals.unsettled.add(c.amount);
      totals.unsettledRows += 1;
    }
    totals.rows += 1;
    totalsByCurrency.set(c.currency, totals);

    const monthStart = new Date(c.createdAt.getFullYear(), c.createdAt.getMonth(), 1);
    const key = `${monthStart.getTime()}:${c.currency}`;
    const month = months.get(key) ?? {
      key,
      ts: monthStart.getTime(),
      period: format(monthStart, "MMM yyyy"),
      currency: c.currency,
      charged: ZERO,
      reversed: ZERO,
      rows: 0,
      settledRows: 0,
      rates: new Set<string>(),
    };
    if (c.amount.isNegative()) {
      // Refund reversals copy the rate of the charge they reverse, or 0 when no
      // charge was found — so they are never counted as a rate that was charged.
      month.reversed = month.reversed.add(c.amount.negated());
    } else {
      month.charged = month.charged.add(c.amount);
      month.rates.add(formatRate(c.rate));
    }
    month.rows += 1;
    if (c.settledAt) month.settledRows += 1;
    months.set(key, month);
  }

  const currencyTotals = [...totalsByCurrency.values()].sort((a, b) => b.rows - a.rows);
  const monthRows = [...months.values()].sort((a, b) => b.ts - a.ts || a.currency.localeCompare(b.currency));
  const unsettledRows = currencyTotals.reduce((sum, t) => sum + t.unsettledRows, 0);

  const linesFor = (pick: (t: CurrencyTotals) => Prisma.Decimal) => {
    const lines = currencyTotals
      .filter((t) => !pick(t).isZero())
      .map((t) => ({ text: money(pick(t), t.currency), credit: pick(t).isNegative() }));
    // A figure that is genuinely zero (e.g. a month's charges fully reversed) is a
    // fact about the ledger, not missing data: print it as zero rather than as "—",
    // which would contradict the record count printed beneath it.
    if (lines.length === 0 && currencyTotals.length > 0) {
      return [{ text: money(ZERO, currencyTotals[0].currency), credit: false }];
    }
    return lines;
  };

  const moneyCards = [
    {
      label: "Net commission (YTD)",
      note: `Charges less refund reversals since ${format(yearStart, "d MMM yyyy")}`,
      icon: CreditCard,
      color: "text-danger",
      bg: "bg-card border-border",
      lines: linesFor((t) => t.netYtd),
    },
    {
      label: "Net commission (lifetime)",
      note: `${ledger.length} commission record${ledger.length === 1 ? "" : "s"}`,
      icon: Receipt,
      color: "text-foreground",
      bg: "bg-card border-border",
      lines: linesFor((t) => t.netLifetime),
    },
    {
      label: "Not yet settled",
      note: `${unsettledRows} record${unsettledRows === 1 ? "" : "s"} awaiting a paid payout`,
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary/5 border-primary/20",
      lines: linesFor((t) => t.unsettled),
    },
  ];

  const facts: { term: string; detail: React.ReactNode }[] = [
    {
      term: "Your rate",
      detail: `${formatRate(accountRate)}, stored on your seller account. No screen in the seller or admin portal edits it — it changes only when ${platformName()} updates your account record directly.`,
    },
    {
      term: "What it is charged on",
      detail:
        "Merchandise value excluding VAT: your lines on the order, each line total less its VAT. Shipping and VAT are outside the basis.",
    },
    {
      term: "When it is recorded",
      detail:
        "Once per order, inside the same database transaction that confirms payment. A replayed payment confirmation skips the order rather than charging it twice.",
    },
    {
      term: "Rate snapshot",
      detail:
        "The rate in force at that moment is copied onto the commission record. A later change to your account rate does not restate commissions already recorded, so the Rate column below is what was actually charged.",
    },
    {
      term: "Refunds",
      detail:
        "A completed refund writes a negative commission record against the same order, reversing commission in proportion to the refunded merchandise.",
    },
    {
      term: "Settlement",
      detail: (
        <>
          A record is marked settled when the payout covering its order is marked paid against a settlement reference.
          Payout amounts, references and dates are on{" "}
          <Link href="/payouts" className="underline underline-offset-2">
            Payouts
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Commission</h1>
          <p className="text-sm text-muted-foreground">
            The commission {platformName()} has recorded against your orders, and the rate each record was charged at
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border p-4 bg-primary/5 border-primary/20">
            <Percent className="h-4 w-4 text-primary mb-2" />
            <p className="text-xl font-bold text-primary">{formatRate(accountRate)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your commission rate</p>
            <p className="text-[11px] text-muted-foreground mt-1">Applied when an order is paid, ex-VAT</p>
          </div>
          {moneyCards.map((card) => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color} mb-2`} />
              {card.lines.length === 0 ? (
                <p className="text-xl font-bold text-muted-foreground">—</p>
              ) : (
                card.lines.map((line) => (
                  <p key={line.text} className={`text-xl font-bold ${line.credit ? "text-success" : card.color}`}>
                    {line.text}
                  </p>
                ))
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{card.note}</p>
            </div>
          ))}
        </div>

        {/* How the rate is applied. Everything stated here is implemented in
            accrueCommissions() and the payout settlement transition; nothing on
            this page describes a rate schedule the platform does not operate. */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">How your commission is calculated</h2>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.term} className="rounded-xl border border-border p-3">
                <dt className="text-sm font-semibold">{fact.term}</dt>
                <dd className="text-xs text-muted-foreground mt-1 leading-relaxed">{fact.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            One rate per seller account is the whole of the commission model. There is no tiered or volume-based rate
            schedule in the platform, and no reduced rate is available to earn: your account tier ({seller.tier}) is a
            profile label and has no effect on the rate above.
          </p>
        </div>

        {ledger.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border shadow-card p-10 text-center">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-semibold">No commission recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              A commission record is written when an order containing your items is paid.
            </p>
          </div>
        ) : (
          <>
            {/* By month */}
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">Commission by month</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      {["Period", "Records", "Rate(s) charged", "Charged", "Refund reversals", "Net", "Settlement"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthRows.map((m) => {
                      const net = m.charged.sub(m.reversed);
                      const settlement =
                        m.settledRows === m.rows
                          ? { label: "Settled", className: "bg-success/15 text-success" }
                          : m.settledRows === 0
                            ? { label: "Not settled", className: "bg-primary/15 text-primary" }
                            : { label: `${m.settledRows} of ${m.rows} settled`, className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
                      return (
                        <tr key={m.key} className="hover:bg-secondary/40 transition-colors">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {m.period}
                            {currencyTotals.length > 1 && (
                              <span className="text-xs text-muted-foreground ms-1">({m.currency})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{m.rows}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {m.rates.size === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              [...m.rates].sort().join(", ")
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">{money(m.charged, m.currency)}</td>
                          <td className="px-4 py-3 font-mono text-success">
                            {m.reversed.isZero() ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              `+${money(m.reversed, m.currency)}`
                            )}
                          </td>
                          <td className={`px-4 py-3 font-mono font-bold ${net.isNegative() ? "text-success" : "text-danger"}`}>
                            {money(net, m.currency)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${settlement.className}`}>
                              {settlement.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
                Charged and reversed amounts are the recorded commission itself, not your sales. Refund reversals are
                credits back to you.
              </p>
            </div>

            {/* Individual records */}
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">Commission records</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 border-b border-border">
                    <tr>
                      {["Date", "Order", "Type", "Commissionable value (ex-VAT)", "Rate charged", "Commission", "Settled"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.map((c) => {
                      const isReversal = c.amount.isNegative();
                      // The accrual basis, recomputed from the order lines themselves:
                      // line total minus line VAT, exactly what accrueCommissions()
                      // multiplies by the snapshot rate. A reversal is not a charge on
                      // those lines, so no basis is shown for it.
                      const basis =
                        isReversal || c.order.items.length === 0
                          ? null
                          : c.order.items.reduce((sum, item) => sum.add(item.total.sub(item.vatAmount)), ZERO);
                      return (
                        <tr key={c.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">{format(c.createdAt, "d MMM yyyy")}</td>
                          <td className="px-4 py-3 font-mono text-xs">{c.order.orderNumber}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {isReversal ? (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-success/15 text-success">
                                Refund reversal
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-secondary text-muted-foreground">
                                Commission
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {basis === null ? <span className="text-muted-foreground">—</span> : money(basis, c.currency)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatRate(c.rate)}</td>
                          <td className={`px-4 py-3 font-mono font-medium ${isReversal ? "text-success" : "text-danger"}`}>
                            {money(c.amount, c.currency)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {c.settledAt ? format(c.settledAt, "d MMM yyyy") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
                {recent.length === ledger.length
                  ? `All ${ledger.length} record${ledger.length === 1 ? "" : "s"} shown.`
                  : `Showing the ${recent.length} most recent of ${ledger.length} records; the totals above cover all of them.`}{" "}
                Commissionable value is recomputed from your lines on the order (line total minus VAT). Rate charged and
                Commission are the values stored on the record itself; on a refund reversal the rate shown is the rate of
                the charge being reversed.
              </p>
            </div>
          </>
        )}
      </div>
    </SellerLayout>
  );
}
