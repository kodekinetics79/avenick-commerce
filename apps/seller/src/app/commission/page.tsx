import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { platformName } from "@avenick/utils/portal-config";
import { db, Prisma, type Currency } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  LedgerTable,
  PageHeader,
  Stat,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { Clock, CreditCard, Percent, Receipt } from "lucide-react";

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
  const multiCurrency = currencyTotals.length > 1;

  /**
   * Every money figure on this page is a LIST of per-currency amounts joined by
   * a middot, never a sum. A figure that is genuinely zero (a month's charges
   * fully reversed, say) is a fact about the ledger rather than missing data, so
   * it prints as zero — an em dash there would contradict the record count
   * printed beside it.
   */
  const linesFor = (pick: (t: CurrencyTotals) => Prisma.Decimal): string => {
    const lines = currencyTotals.filter((t) => !pick(t).isZero()).map((t) => money(pick(t), t.currency));
    if (lines.length === 0 && currencyTotals.length > 0) return money(ZERO, currencyTotals[0].currency);
    if (lines.length === 0) return "—";
    return lines.join(" · ");
  };

  /**
   * How the rate is applied. Everything stated here is implemented in
   * accrueCommissions() and the payout settlement transition; nothing on this
   * page describes a rate schedule the platform does not operate.
   *
   * It is a <details> disclosure rather than six always-open cards. This is the
   * page a supplier opens once to understand the model and thereafter to read a
   * figure; six paragraphs of correct fine print sitting permanently above the
   * ledger is how the ledger stops being found.
   */
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
          <Link href="/payouts" className="u-focus rounded-nested font-medium text-primary-ink underline underline-offset-2">
            Payouts
          </Link>
          .
        </>
      ),
    },
  ];

  const settlementView = (settled: number, rows: number): { label: string; tone: PillTone } =>
    settled === rows
      ? { label: "Settled", tone: "success" }
      : settled === 0
        ? { label: "Not settled", tone: "primary" }
        : { label: `${settled} of ${rows} settled`, tone: "warning" };

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Finance"
          title="Commission"
          description={`The commission ${platformName()} has recorded against your orders, and the rate each record was charged at.`}
          dateline="Every total is computed over all commission records on this account · amounts are listed per currency and never converted or added across them"
        />

        {/* THE RATE LEADS. It is the one number that governs every other figure
            on the page, so it is the only one at section rank; the three money
            totals qualify it. Four identically-weighted tiles — which is what
            this was — is a grid with no answer to "what am I looking at". */}
        <CellGrid cols={{ base: 2, lg: 4 }}>
          <Stat
            label="Your commission rate"
            value={formatRate(accountRate)}
            rank="section"
            icon={Percent}
            chip="neutral"
            note="Applied when an order is paid, on merchandise value excluding VAT."
          />
          <Stat
            label="Net commission, year to date"
            value={linesFor((t) => t.netYtd)}
            icon={CreditCard}
            note={`Charges less refund reversals since ${format(yearStart, "d MMM yyyy")}.`}
          />
          <Stat
            label="Net commission, lifetime"
            value={linesFor((t) => t.netLifetime)}
            icon={Receipt}
            note={`${ledger.length} commission record${ledger.length === 1 ? "" : "s"} on this account.`}
          />
          <Stat
            label="Not yet settled"
            value={linesFor((t) => t.unsettled)}
            icon={Clock}
            chip={unsettledRows > 0 ? "warning" : "neutral"}
            note={`${unsettledRows} record${unsettledRows === 1 ? "" : "s"} awaiting a paid payout.`}
            href="/payouts"
            linkComponent={Link}
            className="focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          />
        </CellGrid>

        {/* JS-free disclosure: <details>/<summary>, so this needs no client
            component at all, and the chevron is drawn from two rotated borders —
            nothing to mirror in Arabic. */}
        <Surface rung={1} as="details" className="u-facet px-4">
          <summary className="u-focus">
            <span className="min-w-0">
              <Eyebrow as="span" className="block">
                Reference
              </Eyebrow>
              <span className="u-ui font-medium text-ink-1">How your commission is calculated</span>
            </span>
            <span className="u-facet__chev" aria-hidden="true" />
          </summary>

          <dl className="grid gap-x-6 gap-y-3 border-t border-hairline pb-4 pt-3 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.term} className="min-w-0">
                <dt className="u-ui font-medium text-ink-1">{fact.term}</dt>
                <dd className="u-meta mt-0.5 max-w-prose text-ink-2">{fact.detail}</dd>
              </div>
            ))}
          </dl>
          <Dateline className="border-t border-hairline pb-4 pt-3">
            One rate per seller account is the whole of the commission model. There is no tiered or volume-based rate
            schedule in the platform, and no reduced rate is available to earn: your account tier ({seller.tier}) is a
            profile label and has no effect on the rate above.
          </Dateline>
        </Surface>

        {ledger.length === 0 ? (
          <EmptyState
            variant="certificate"
            glyph={<Receipt />}
            eyebrow="Nothing recorded"
            headline="No commission has been recorded against this account."
            body={`A commission record is written once, inside the transaction that confirms payment on an order containing your lines. Your rate of ${formatRate(accountRate)} is on file and will be snapshotted onto the first record when one exists.`}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/orders">Open your orders</Link>
              </Button>
            }
          />
        ) : (
          <>
            <LedgerTable
              title="Commission by month"
              dateline="Charged and reversed amounts are the recorded commission itself, not your sales · a refund reversal is a credit back to you"
              rows={monthRows}
              getRowKey={(month) => month.key}
              density="compact"
              columns={[
                {
                  key: "period",
                  label: "Period",
                  render: (month) => (
                    <span className="whitespace-nowrap font-medium text-ink-1">
                      {month.period}
                      {multiCurrency && <span className="u-meta ms-1.5 text-ink-3">{month.currency}</span>}
                    </span>
                  ),
                },
                { key: "rows", label: "Records", numeric: true, hideOnMobile: true },
                {
                  key: "rates",
                  label: "Rate(s) charged",
                  hideOnMobile: true,
                  render: (month) =>
                    month.rates.size === 0 ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      <span className="fig whitespace-nowrap text-ink-2">{[...month.rates].sort().join(", ")}</span>
                    ),
                },
                {
                  key: "charged",
                  label: "Charged",
                  numeric: true,
                  render: (month) => <span className="text-ink-2">{money(month.charged, month.currency)}</span>,
                },
                {
                  key: "reversed",
                  label: "Reversals",
                  numeric: true,
                  hideOnMobile: true,
                  render: (month) =>
                    month.reversed.isZero() ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      // A credit back to the seller. success ink, not a green
                      // wash: the sign is already carried by the leading plus.
                      <span className="text-success-ink">+{money(month.reversed, month.currency)}</span>
                    ),
                },
                {
                  key: "net",
                  label: "Net",
                  numeric: true,
                  render: (month) => {
                    const net = month.charged.sub(month.reversed);
                    return (
                      <span className={net.isNegative() ? "font-medium text-success-ink" : "font-medium text-ink-1"}>
                        {money(net, month.currency)}
                      </span>
                    );
                  },
                },
                {
                  key: "settlement",
                  label: "Settlement",
                  align: "end",
                  render: (month) => {
                    const view = settlementView(month.settledRows, month.rows);
                    return <StatusPill tone={view.tone}>{view.label}</StatusPill>;
                  },
                },
              ]}
              empty={
                <EmptyState
                  eyebrow="Nothing recorded"
                  headline="No month carries a commission record."
                  body="A month appears here as soon as one of its orders is paid."
                />
              }
            />

            <LedgerTable
              title="Commission records"
              dateline="Commissionable value is recomputed from your lines on the order (line total minus VAT) · rate charged and commission are the values stored on the record itself"
              rows={recent}
              getRowKey={(record) => record.id}
              density="compact"
              footer={
                recent.length === ledger.length
                  ? `All ${ledger.length} record${ledger.length === 1 ? "" : "s"} shown. On a refund reversal the rate shown is the rate of the charge being reversed.`
                  : `The ${recent.length} most recent of ${ledger.length} records; the totals above cover all of them. On a refund reversal the rate shown is the rate of the charge being reversed.`
              }
              columns={[
                {
                  key: "createdAt",
                  label: "Date",
                  render: (record) => (
                    <span className="u-meta whitespace-nowrap text-ink-2">{format(record.createdAt, "d MMM yyyy")}</span>
                  ),
                },
                {
                  key: "order",
                  label: "Order",
                  render: (record) => <span className="u-mono text-meta text-ink-2">{record.order.orderNumber}</span>,
                },
                {
                  key: "type",
                  label: "Type",
                  render: (record) =>
                    record.amount.isNegative() ? (
                      <StatusPill tone="success">Refund reversal</StatusPill>
                    ) : (
                      <StatusPill tone="neutral">Commission</StatusPill>
                    ),
                },
                {
                  key: "basis",
                  label: "Commissionable (ex-VAT)",
                  numeric: true,
                  hideOnMobile: true,
                  render: (record) => {
                    // The accrual basis, recomputed from the order lines
                    // themselves: line total minus line VAT, exactly what
                    // accrueCommissions() multiplies by the snapshot rate. A
                    // reversal is not a charge on those lines, so no basis is
                    // shown for it.
                    if (record.amount.isNegative() || record.order.items.length === 0) {
                      return <span className="text-ink-3">—</span>;
                    }
                    const basis = record.order.items.reduce((sum, item) => sum.add(item.total.sub(item.vatAmount)), ZERO);
                    return <span className="text-ink-2">{money(basis, record.currency)}</span>;
                  },
                },
                {
                  key: "rate",
                  label: "Rate charged",
                  numeric: true,
                  hideOnMobile: true,
                  render: (record) => <span className="text-ink-2">{formatRate(record.rate)}</span>,
                },
                {
                  key: "amount",
                  label: "Commission",
                  numeric: true,
                  render: (record) => (
                    <span className={record.amount.isNegative() ? "font-medium text-success-ink" : "font-medium text-ink-1"}>
                      {money(record.amount, record.currency)}
                    </span>
                  ),
                },
                {
                  key: "settledAt",
                  label: "Settled",
                  align: "end",
                  render: (record) =>
                    record.settledAt ? (
                      <span className="u-meta whitespace-nowrap text-ink-2">{format(record.settledAt, "d MMM yyyy")}</span>
                    ) : (
                      <span className="u-meta text-ink-3">Not yet</span>
                    ),
                },
              ]}
              empty={
                <EmptyState
                  eyebrow="Nothing recorded"
                  headline="No individual commission record exists."
                  body="Records are written one per paid order containing your lines."
                />
              }
            />
          </>
        )}
      </div>
    </SellerLayout>
  );
}
