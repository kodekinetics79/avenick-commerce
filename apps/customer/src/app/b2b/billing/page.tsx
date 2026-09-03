import Link from "next/link";
import { B2BShell } from "@/components/b2b/b2b-shell";
import { Money, CurrencyLedger } from "@/components/b2b/money";
import {
  Button,
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
import { getB2B, b2bMetadata } from "@/components/b2b/i18n";
import type { B2BKey } from "@/components/b2b/messages";
import { toneRule } from "@/components/b2b/rules";
import { companyCurrencyForCountry } from "@/lib/company-currency";
import { Download, CreditCard, CheckCircle2, Clock, AlertTriangle, Receipt } from "lucide-react";

export async function generateMetadata() {
  return b2bMetadata("billing.title");
}

const ZERO = new Prisma.Decimal(0);

/** Money crosses to a string here and nowhere earlier; currency is never blended. */
const money = (amount: Prisma.Decimal, currency: Currency) =>
  formatCurrency(Number(amount), currency as SupportedCurrency);

/**
 * Aging buckets, in the order they are displayed.
 *
 * The bucket is a stable KEY and its column heading is a message key, so the
 * aging table can be read in Arabic. Round one used the English label as the map
 * key, which is exactly how a translated column heading silently stops matching
 * the data behind it.
 */
const BUCKETS = [
  { key: "current", label: "billing.bucket.current" },
  { key: "1-30", label: "billing.bucket.1to30" },
  { key: "31-60", label: "billing.bucket.31to60" },
  { key: "60+", label: "billing.bucket.60plus" },
] as const;
type Bucket = (typeof BUCKETS)[number]["key"];

/** The ink each bucket's figure carries, so the eye lands on the oldest debt first. */
const BUCKET_INK: Record<Bucket, string> = {
  current: "text-success-ink",
  "1-30": "text-ink-1",
  "31-60": "text-warning-ink",
  "60+": "text-danger-ink",
};

export default async function BillingPage() {
  const { t, f } = await getB2B();
  const ctx = await getB2BContext();
  if (!ctx) {
    return (
      <B2BShell title={t("billing.title")}>
        <EmptyState
          variant="certificate"
          glyph={<Receipt />}
          eyebrow={t("common.noCompany.eyebrow")}
          headline={t("common.noCompany.headline")}
          body={t("common.noCompany.body")}
          action={
            <Button asChild variant="primary">
              <Link href="/b2b/register">{t("common.noCompany.action")}</Link>
            </Button>
          }
        />
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
      ? "current"
      : row.daysOverdue <= 30
      ? "1-30"
      : row.daysOverdue <= 60
      ? "31-60"
      : "60+";
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
      workspace={ctx.company.nameEn}
      eyebrow={t("billing.eyebrow")}
      title={t("billing.title")}
      description={t("billing.description", { company: ctx.company.nameEn })}
    >
      {/* No statement export exists yet; a "Download statement" button that did nothing has been removed. */}
      {/* ══ THE CREDIT LINE ═══════════════════════════════════════════════════
          The one hero-rank figure on this page is AVAILABLE CREDIT, because it
          is the number a buyer checks before raising a purchase order — and it
          is a real computation (limit less exposure in the limit currency), not
          a headline invented to fill a slot.

          Round one set all three figures at the same 30px rank, which made the
          panel a row of equal numbers with no answer in it. Limit and
          outstanding are the workings; available is the answer, so it is 46px
          against their 20px and the two are separated by size, weight, space
          and colour rather than by size alone.

          The panel is RECESSED: a credit line is the context every other figure
          on this page is read against, not something you act on. */}
      <div className="grid lg:grid-cols-3 gap-4 mb-block">
        <Surface rung={1} className="lg:col-span-2 overflow-hidden">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />
          <div className="p-5">
            <Eyebrow className="mb-4 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> {t("billing.credit.eyebrow", { terms })}
            </Eyebrow>
            {creditLimit === null ? (
              <p className="u-body max-w-prose text-ink-2">
                {t("billing.credit.none", { company: ctx.company.nameEn })}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                  <div className="min-w-0">
                    <Eyebrow>{t("billing.credit.available")}</Eyebrow>
                    <div className="mt-1">
                      <Money amount={Number(available ?? ZERO)} currency={limitCurrency} rank="hero" />
                    </div>
                  </div>
                  {/* The workings, at a quarter the rank of the answer. */}
                  <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
                    <div>
                      <dt><Eyebrow as="span">{t("billing.credit.limit")}</Eyebrow></dt>
                      <dd className="mt-1"><Money amount={Number(creditLimit)} currency={limitCurrency} /></dd>
                    </div>
                    <div>
                      <dt><Eyebrow as="span">{t("billing.credit.outstanding", { currency: limitCurrency })}</Eyebrow></dt>
                      <dd className="mt-1"><Money amount={Number(limitExposure)} currency={limitCurrency} /></dd>
                    </div>
                  </dl>
                </div>

                {/* One element, scaled on X from the inline start — correct in
                    Arabic by construction, and the percentage beside it does not
                    move. Tone reports how close the line is to being spent. */}
                <div className="mt-5">
                  <Meter
                    value={usedPct}
                    tone={usedPct >= 90 ? "danger" : usedPct >= 70 ? "warning" : "primary"}
                    label={t("billing.credit.meter", { pct: usedPct, currency: limitCurrency })}
                  />
                  <p className="u-meta mt-1.5 text-ink-2">{t("billing.credit.drawn", { pct: usedPct })}</p>
                </div>

                <Dateline className="mt-3">{t("billing.credit.basis", { currency: limitCurrency })}</Dateline>

                {uncoveredExposure.length > 0 && (
                  <Surface rung={2} tone="warning" className="mt-3 flex items-start gap-2 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
                    <p className="u-meta text-ink-1">
                      {t("billing.credit.uncovered", {
                        amounts: uncoveredExposure.map((e) => money(e.outstanding, e.currency)).join(" · "),
                        currency: limitCurrency,
                      })}
                    </p>
                  </Surface>
                )}
              </>
            )}
          </div>
        </Surface>

        {/* ══ THE OUTSTANDING REGISTER ════════════════════════════════════════
            One line per currency, set as a ruled ledger rather than a stack of
            figures with a caption. The platform holds no exchange rates, and
            that is not a missing feature to apologise for at 11px — it is the
            reason every figure on this page can be trusted, so it is stated in
            the provenance voice attached to the object it explains. */}
        <Surface rung={2} className="p-5">
          <Eyebrow className="mb-2">{t("billing.outstanding")}</Eyebrow>
          {!hasOutstanding ? (
            <>
              <p className="u-body text-ink-1">{t("billing.outstanding.clear")}</p>
              <Dateline className="mt-1">{t("billing.outstanding.basis")}</Dateline>
            </>
          ) : (
            <CurrencyLedger
              rows={exposure.map((e) => ({ currency: e.currency as string, total: Number(e.outstanding) }))}
              rank="card"
              label={t("money.byCurrency")}
              single={t("billing.outstanding.basis")}
              multi={t("money.noConversion")}
            />
          )}
          {/* Online settlement is not connected; invoices are settled by bank transfer per the order's payment method. */}
          {hasOutstanding && <p className="u-meta mt-4 text-ink-2">{t("billing.outstanding.settle")}</p>}
        </Surface>
      </div>

      {/* Aging — one row per currency, never a blended column total. The bucket
          columns carry their own ink so the eye lands on the oldest debt first,
          and the row rule states the worst bucket that currency is carrying
          before a single figure has been read. */}
      <LedgerTable
        className="mb-block"
        title={t("billing.aging.title")}
        dateline={t("billing.aging.basis")}
        rows={exposure}
        getRowKey={(e) => e.currency}
        rowProps={(e) => ({
          className: toneRule(
            e.aging.get("60+") ? "danger" : e.aging.get("31-60") ? "warning" : "neutral",
          ),
        })}
        columns={[
          {
            key: "currency",
            label: t("common.currency"),
            render: (e) => <span className="u-mono font-medium text-ink-1">{e.currency}</span>,
          },
          ...BUCKETS.map((bucket) => ({
            key: bucket.key,
            label: t(bucket.label),
            numeric: true,
            render: (e: ExposureRow) => {
              const amount = e.aging.get(bucket.key);
              if (!amount) return <span className="u-meta text-ink-3">{t("common.none")}</span>;
              return <Money amount={Number(amount)} currency={e.currency} className={BUCKET_INK[bucket.key]} />;
            },
          })),
        ]}
        empty={
          <EmptyState
            eyebrow={t("billing.aging.empty.eyebrow")}
            headline={t("billing.aging.empty.headline")}
            body={t("billing.aging.empty.body")}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/b2b/purchase-orders">{t("billing.invoices.empty.action")}</Link>
              </Button>
            }
          />
        }
      />

      {/* Invoices */}
      <LedgerTable
        title={t("billing.invoices.title")}
        dateline={t("billing.invoices.basis")}
        rows={rows}
        getRowKey={({ inv }) => inv.id}
        stickyHead
        rowProps={({ paid, overdue }) => ({
          className: toneRule(paid ? "success" : overdue ? "danger" : "warning"),
        })}
        columns={[
          {
            key: "invoiceNo",
            label: t("billing.col.invoice"),
            render: ({ inv }) => <span className="u-mono font-medium text-primary-ink">{inv.invoiceNo}</span>,
          },
          {
            key: "po",
            label: t("billing.col.po"),
            hideOnMobile: true,
            render: ({ inv }) => (
              <span className="u-mono u-meta text-ink-3">{inv.order.purchaseOrder?.poNumber ?? t("billing.noPo")}</span>
            ),
          },
          {
            key: "issued",
            label: t("billing.col.issued"),
            hideOnMobile: true,
            render: ({ inv }) => <span className="u-meta whitespace-nowrap text-ink-2">{f.date(inv.issuedAt)}</span>,
          },
          {
            key: "due",
            label: t("billing.col.due"),
            render: ({ due }) => <span className="u-meta whitespace-nowrap text-ink-2">{f.date(due)}</span>,
          },
          {
            key: "amount",
            label: t("billing.col.amount"),
            numeric: true,
            render: ({ inv, currency }) => (
              <Money amount={Number(inv.totalAmount.sub(inv.vatAmount))} currency={currency} />
            ),
          },
          {
            key: "vat",
            label: t("billing.col.vat"),
            numeric: true,
            render: ({ inv, currency }) => (
              <Money amount={Number(inv.vatAmount)} currency={currency} className="text-ink-2" />
            ),
          },
          {
            key: "status",
            label: t("common.status"),
            render: ({ paid, overdue }) => {
              const st: { label: B2BKey; tone: PillTone; icon: typeof Clock } = paid
                ? { label: "billing.status.paid", tone: "success", icon: CheckCircle2 }
                : overdue
                  ? { label: "billing.status.overdue", tone: "danger", icon: AlertTriangle }
                  : { label: "billing.status.due", tone: "warning", icon: Clock };
              return (
                <StatusPill tone={st.tone} className="whitespace-nowrap">
                  <st.icon className="h-3 w-3" aria-hidden="true" /> {t(st.label)}
                </StatusPill>
              );
            },
          },
          {
            key: "file",
            label: t("billing.col.file"),
            align: "end",
            render: ({ inv }) =>
              /* A download only where a file was stored on the invoice; the button that did nothing is gone. */
              inv.fileUrl ? (
                <a
                  href={inv.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="u-focus u-meta inline-flex items-center gap-1 rounded-nested font-medium text-primary-ink hover:underline"
                  aria-label={t("billing.downloadPdf", { number: inv.invoiceNo })}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                </a>
              ) : (
                <span className="u-meta text-ink-3">{t("billing.noFile")}</span>
              ),
          },
        ]}
        // The one certificate on this page: the invoice book is its subject.
        empty={
          <EmptyState
            variant="certificate"
            glyph={<Receipt />}
            eyebrow={t("billing.invoices.empty.eyebrow")}
            headline={t("billing.invoices.empty.headline")}
            body={t("billing.invoices.empty.body")}
            action={
              <Button asChild variant="secondary">
                <Link href="/b2b/purchase-orders">{t("billing.invoices.empty.action")}</Link>
              </Button>
            }
          />
        }
      />
    </B2BShell>
  );
}
