import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money } from "@/components/b2b/money";
import {
  Dateline,
  EmptyState,
  Eyebrow,
  LedgerTable,
  Meter,
  StatusPill,
  Surface,
  type PillTone,
} from "@avenick/ui";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { db, Prisma, type Currency } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { platformName } from "@avenick/utils/portal-config";
import { Download, CreditCard, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export const metadata = { title: `Billing & Invoices — ${platformName()} for Business` };

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const ZERO = new Prisma.Decimal(0);

/** Money crosses to a string here and nowhere earlier; currency is never blended. */
const money = (amount: Prisma.Decimal, currency: Currency) =>
  formatCurrency(Number(amount), currency as SupportedCurrency);

/** Aging buckets, in the order they are displayed. */
const BUCKETS = ["Current", "1–30 days", "31–60 days", "60+ days"] as const;
type Bucket = (typeof BUCKETS)[number];

export default async function BillingPage() {
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title="Billing & Invoices">
        <Surface rung={2}>
          <EmptyState
            eyebrow="No company context"
            headline="This session is not attached to a company account."
            body="Credit terms, exposure and tax invoices belong to a company. Sign in with a company account to see them."
          />
        </Surface>
      </B2BShell>
    );
  }

  // Company.paymentTerms is a non-null integer (NET days; 0 = due on issue).
  // The "?? 30" fallback this used to carry would have invented a 30-day term
  // for a company whose terms were never set; there is no default term here.
  const terms = ctx.company.paymentTerms;
  const invoices = await db.taxInvoice.findMany({
    where: { order: { companyId: ctx.companyId } },
    include: { order: { include: { purchaseOrder: { select: { poNumber: true } } } } },
    orderBy: { issuedAt: "desc" },
  });

  const now = new Date();
  const rows = invoices.map((inv) => {
    const due = new Date(inv.issuedAt.getTime() + terms * 86400000);
    const paid = inv.order.paymentStatus === "PAID";
    const overdue = !paid && due < now;
    const daysOverdue = overdue ? Math.floor((now.getTime() - due.getTime()) / 86400000) : 0;
    return { inv, due, paid, overdue, daysOverdue, currency: inv.currency };
  });

  // Exposure is tracked per currency. An invoice in SAR and an invoice in AED
  // are debts in different units: the platform holds no exchange rates, so
  // adding them would produce a balance that is owed in no currency at all.
  const exposureByCurrency = new Map<Currency, { outstanding: Prisma.Decimal; aging: Map<Bucket, Prisma.Decimal> }>();
  for (const row of rows) {
    if (row.paid) continue;
    const entry = exposureByCurrency.get(row.currency) ?? { outstanding: ZERO, aging: new Map<Bucket, Prisma.Decimal>() };
    const bucket: Bucket = !row.overdue
      ? "Current"
      : row.daysOverdue <= 30
      ? "1–30 days"
      : row.daysOverdue <= 60
      ? "31–60 days"
      : "60+ days";
    entry.outstanding = entry.outstanding.add(row.inv.totalAmount);
    entry.aging.set(bucket, (entry.aging.get(bucket) ?? ZERO).add(row.inv.totalAmount));
    exposureByCurrency.set(row.currency, entry);
  }
  const exposure = [...exposureByCurrency.entries()]
    .map(([currency, entry]) => ({ currency, ...entry }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
  const hasOutstanding = exposure.length > 0;
  // Named so the aging table's generated bucket columns can be typed; the
  // columns are built with .map() over BUCKETS, which loses row inference.
  type ExposureRow = (typeof exposure)[number];

  // Company.creditLimit is a bare Decimal with no currency column, so the limit
  // itself does not say what it is denominated in. It is read as the company's
  // jurisdiction currency — the same assumption the rest of the B2B app makes —
  // and that assumption is stated on the page rather than hidden inside it.
  const limitCurrency = companyCurrencyForCountry(ctx.company.country) as Currency;
  const creditLimit = ctx.company.creditLimit;
  const limitExposure = exposureByCurrency.get(limitCurrency)?.outstanding ?? ZERO;
  const available = creditLimit ? Prisma.Decimal.max(ZERO, creditLimit.sub(limitExposure)) : null;
  const usedPct =
    creditLimit && creditLimit.gt(ZERO)
      ? Math.min(100, Math.round(Number(limitExposure.div(creditLimit)) * 100))
      : 0;
  // Exposure the credit line provably does not cover, because it cannot be converted.
  const uncoveredExposure = exposure.filter((e) => e.currency !== limitCurrency);

  return (
    <B2BShell
      eyebrow="Money"
      title="Billing & Invoices"
      description={`Credit terms, balance and tax invoices for ${ctx.company.nameEn}.`}
    >
      {/* No statement export exists yet; a "Download statement" button that did nothing has been removed. */}
      {/* Credit + outstanding.

          The credit panel is RECESSED: a credit line is context for every other
          figure on the page, not something you act on. What used to be here was
          an indigo→verdigris gradient card whose utilisation bar was a second
          gradient — two gradients saying one percentage. */}
      <div className="grid lg:grid-cols-3 gap-4 mb-block">
        <Surface rung={1} className="lg:col-span-2 p-5">
          <Eyebrow className="mb-4 flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Credit line · NET {terms}
          </Eyebrow>
          {creditLimit === null ? (
            <p className="u-body text-ink-2">
              No credit limit is set for {ctx.company.nameEn}. Contact your account manager to arrange one.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <Eyebrow>Limit</Eyebrow>
                  <div className="mt-1"><Money amount={Number(creditLimit)} currency={limitCurrency} rank="section" /></div>
                </div>
                <div>
                  <Eyebrow>Outstanding in {limitCurrency}</Eyebrow>
                  <div className="mt-1"><Money amount={Number(limitExposure)} currency={limitCurrency} rank="section" /></div>
                </div>
                <div>
                  <Eyebrow>Available</Eyebrow>
                  <div className="mt-1"><Money amount={Number(available ?? ZERO)} currency={limitCurrency} rank="section" /></div>
                </div>
              </div>
              {/* One element, scaled on X from the inline start — correct in
                  Arabic by construction, and the percentage beside it does not
                  move. Tone reports how close the line is to being spent. */}
              <Meter
                value={usedPct}
                tone={usedPct >= 90 ? "danger" : usedPct >= 70 ? "warning" : "primary"}
                label={`${usedPct}% of the ${limitCurrency} credit limit drawn`}
              />
              <p className="u-meta mt-1.5 text-ink-2">{usedPct}% of credit utilized</p>
              <Dateline className="mt-3">
                The credit limit is recorded without a currency and is read here as {limitCurrency}, your company&apos;s
                jurisdiction currency. Only {limitCurrency} invoices are drawn against it.
              </Dateline>
              {uncoveredExposure.length > 0 && (
                <Surface rung={2} tone="warning" className="mt-3 flex items-start gap-2 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                  <p className="u-meta text-ink-1">
                    Not included above: {uncoveredExposure.map((e) => money(e.outstanding, e.currency)).join(" · ")} outstanding
                    in other currencies. These cannot be measured against a {limitCurrency} limit — the platform holds no
                    exchange rates — so they are shown separately rather than converted.
                  </p>
                </Surface>
              )}
            </>
          )}
        </Surface>
        <Surface rung={2} className="p-5">
          <Eyebrow>Outstanding balance</Eyebrow>
          {!hasOutstanding ? (
            <p className="u-body mt-2 text-ink-2">Nothing outstanding.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {exposure.map((e) => (
                <Money key={e.currency} amount={Number(e.outstanding)} currency={e.currency} rank="section" />
              ))}
            </div>
          )}
          <Dateline className="mt-2">Unpaid tax invoices, one line per currency · no conversion applied</Dateline>
          {/* Online settlement is not connected; invoices are settled by bank transfer per the order's payment method. */}
          {hasOutstanding && (
            <p className="u-meta mt-4 text-ink-2">
              Settle outstanding invoices by bank transfer against the invoice number. Online payment is not available.
            </p>
          )}
        </Surface>
      </div>

      {/* Aging — one row per currency, never a blended column total. The bucket
          columns carry their own ink so the eye lands on the oldest debt first;
          the amber pair that used to be written out per theme is now one token
          with a real dark value. */}
      <LedgerTable
        className="mb-block"
        title="Aging by currency"
        dateline="Unpaid invoice totals bucketed by days past their NET date · currencies are never added together"
        rows={exposure}
        getRowKey={(e) => e.currency}
        columns={[
          {
            key: "currency",
            label: "Currency",
            render: (e) => <span className="u-mono font-medium text-ink-1">{e.currency}</span>,
          },
          ...BUCKETS.map((bucket, i) => ({
            key: bucket,
            label: bucket,
            numeric: true,
            render: (e: ExposureRow) => {
              const amount = e.aging.get(bucket);
              if (!amount) return <span className="u-meta text-ink-3">—</span>;
              const ink = ["text-success-ink", "text-ink-1", "text-warning-ink", "text-danger-ink"][i];
              return <Money amount={Number(amount)} currency={e.currency} className={ink} />;
            },
          })),
        ]}
        empty={
          <EmptyState
            eyebrow="Nothing outstanding"
            headline="Every tax invoice issued to this company is settled."
            body="Unpaid invoices are bucketed here by how far past their NET date they are."
          />
        }
      />

      {/* Invoices */}
      <LedgerTable
        title="Tax invoices"
        dateline="Every invoice issued against this company's orders, newest first · amounts exclude VAT, which is its own column"
        rows={rows}
        getRowKey={({ inv }) => inv.id}
        stickyHead
        columns={[
          {
            key: "invoiceNo",
            label: "Invoice #",
            render: ({ inv }) => <span className="u-mono font-medium text-primary-ink">{inv.invoiceNo}</span>,
          },
          {
            key: "po",
            label: "PO",
            hideOnMobile: true,
            render: ({ inv }) => (
              <span className="u-mono u-meta text-ink-3">{inv.order.purchaseOrder?.poNumber ?? "No PO"}</span>
            ),
          },
          {
            key: "issued",
            label: "Issued",
            hideOnMobile: true,
            render: ({ inv }) => <span className="u-meta whitespace-nowrap text-ink-2">{fmt(inv.issuedAt)}</span>,
          },
          {
            key: "due",
            label: "Due",
            render: ({ due }) => <span className="u-meta whitespace-nowrap text-ink-2">{fmt(due)}</span>,
          },
          {
            key: "amount",
            label: "Amount",
            numeric: true,
            render: ({ inv, currency }) => (
              <Money amount={Number(inv.totalAmount.sub(inv.vatAmount))} currency={currency} />
            ),
          },
          {
            key: "vat",
            label: "VAT",
            numeric: true,
            render: ({ inv, currency }) => (
              <Money amount={Number(inv.vatAmount)} currency={currency} className="text-ink-2" />
            ),
          },
          {
            key: "status",
            label: "Status",
            render: ({ paid, overdue }) => {
              const st: { label: string; tone: PillTone; icon: typeof Clock } = paid
                ? { label: "Paid", tone: "success", icon: CheckCircle2 }
                : overdue
                  ? { label: "Overdue", tone: "danger", icon: AlertTriangle }
                  : { label: "Due", tone: "warning", icon: Clock };
              return (
                <StatusPill tone={st.tone} className="whitespace-nowrap">
                  <st.icon className="h-3 w-3" aria-hidden="true" /> {st.label}
                </StatusPill>
              );
            },
          },
          {
            key: "file",
            label: "File",
            align: "end",
            render: ({ inv }) =>
              /* A download only where a file was stored on the invoice; the button that did nothing is gone. */
              inv.fileUrl ? (
                <a
                  href={inv.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-focus u-meta inline-flex items-center gap-1 rounded-nested font-medium text-primary-ink hover:underline"
                  aria-label={`Download invoice ${inv.invoiceNo} as PDF`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                </a>
              ) : (
                <span className="u-meta text-ink-3">No file</span>
              ),
          },
        ]}
        empty={
          <EmptyState
            eyebrow="Nothing recorded"
            headline="No tax invoice has been issued to this company."
            body="Tax invoices are not generated automatically. Request one from your account contact and it will appear here."
          />
        }
      />
    </B2BShell>
  );
}
