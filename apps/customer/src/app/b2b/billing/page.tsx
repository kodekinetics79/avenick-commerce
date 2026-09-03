import { B2BShell } from "@/components/b2b/b2b-shell";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { db, Prisma, type Currency } from "@avenick/database";
import { getB2BContext } from "@/lib/b2b";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { platformName } from "@avenick/utils/portal-config";
import { Download, FileText, CreditCard, CheckCircle2, Clock, AlertTriangle, Building2 } from "lucide-react";

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
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-semibold">No company account</p>
          <p className="text-sm text-muted-foreground mt-1">Sign in with a company account to view billing.</p>
        </div>
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
      title="Billing & Invoices"
      description={`Credit terms, balance and tax invoices for ${ctx.company.nameEn}.`}
    >
      {/* No statement export exists yet; a "Download statement" button that did nothing has been removed. */}
      {/* Credit + outstanding */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4"><CreditCard className="h-4 w-4 text-primary" /> Credit line · NET {terms}</div>
          {creditLimit === null ? (
            <p className="text-sm text-muted-foreground">
              No credit limit is set for {ctx.company.nameEn}. Contact your account manager to arrange one.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><p className="text-xs text-muted-foreground">Limit</p><p className="text-xl font-bold font-mono">{money(creditLimit, limitCurrency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Outstanding in {limitCurrency}</p><p className="text-xl font-bold font-mono">{money(limitExposure, limitCurrency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Available</p><p className="text-xl font-bold font-mono text-success">{money(available ?? ZERO, limitCurrency)}</p></div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500" style={{ width: `${usedPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{usedPct}% of credit utilized</p>
              <p className="text-[11px] text-muted-foreground mt-3">
                The credit limit is recorded without a currency and is read here as {limitCurrency}, your company&apos;s
                jurisdiction currency. Only {limitCurrency} invoices are drawn against it.
              </p>
              {uncoveredExposure.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                  Not included above: {uncoveredExposure.map((e) => money(e.outstanding, e.currency)).join(" · ")} outstanding
                  in other currencies. These cannot be measured against a {limitCurrency} limit — the platform holds no
                  exchange rates — so they are shown separately rather than converted.
                </p>
              )}
            </>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Outstanding balance</p>
          {!hasOutstanding ? (
            <p className="text-3xl font-bold font-mono tracking-tight mt-1">—</p>
          ) : (
            exposure.map((e) => (
              <p key={e.currency} className="text-2xl font-bold font-mono tracking-tight mt-1">
                {money(e.outstanding, e.currency)}
              </p>
            ))
          )}
          {/* Online settlement is not connected; invoices are settled by bank transfer per the order's payment method. */}
          {hasOutstanding && (
            <p className="mt-4 text-xs text-muted-foreground">Settle outstanding invoices by bank transfer against the invoice number. Online payment is not available.</p>
          )}
        </div>
      </div>

      {/* Aging — one row per currency, never a blended column total. */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" /> Aging by currency
        </div>
        {!hasOutstanding ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing outstanding.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {["Currency", ...BUCKETS].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exposure.map((e) => (
                  <tr key={e.currency}>
                    <td className="px-4 py-3 font-semibold">{e.currency}</td>
                    {BUCKETS.map((bucket, i) => {
                      const amount = e.aging.get(bucket);
                      const cls = ["text-success", "text-foreground", "text-amber-600 dark:text-amber-400", "text-danger"][i];
                      return (
                        <td key={bucket} className={`px-4 py-3 font-mono whitespace-nowrap ${amount ? cls : "text-muted-foreground"}`}>
                          {amount ? money(amount, e.currency) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-muted-foreground" /> Tax invoices</div>
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No invoices yet</p>
            <p className="text-sm text-muted-foreground mt-1">Tax invoices are not generated automatically yet. Request one from your account contact.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {["Invoice #", "PO", "Issued", "Due", "Amount", "VAT", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ inv, due, paid, overdue, currency }) => {
                  const st = paid
                    ? { label: "Paid", cls: "bg-success/15 text-success", icon: CheckCircle2 }
                    : overdue
                    ? { label: "Overdue", cls: "bg-danger/15 text-danger", icon: AlertTriangle }
                    : { label: "Due", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock };
                  return (
                    <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">{inv.invoiceNo}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{inv.order.purchaseOrder?.poNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(inv.issuedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(due)}</td>
                      <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{money(inv.totalAmount.sub(inv.vatAmount), currency)}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{money(inv.vatAmount, currency)}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span></td>
                      <td className="px-4 py-3 text-end">
                        {/* A download only where a file was stored on the invoice; the button that did nothing is gone. */}
                        {inv.fileUrl ? (
                          <a href={inv.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" aria-label="Download invoice"><Download className="h-3.5 w-3.5" /> PDF</a>
                        ) : (
                          <span className="text-xs text-muted-foreground">No file</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </B2BShell>
  );
}
