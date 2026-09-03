import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { requireSellerPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency, isSupportedCurrency, type SupportedCurrency } from "@avenick/utils";
import {
  PageHeader,
  CellGrid,
  Stat,
  Num,
  Eyebrow,
  Dateline,
  LedgerTable,
  EmptyState,
  StatusPill,
  Button,
  type PillTone,
} from "@avenick/ui";
import { Wallet } from "lucide-react";

// generateMetadata rather than a static object: a document title is a
// user-visible string, and a literal here read English at an Arabic desk.
export async function generateMetadata() {
  const t = await getTranslations("sellerOps");
  return { title: t("payouts.metaTitle") };
}

/**
 * PayoutStatus, mapped to the tone vocabulary the rest of the portal uses. The
 * label half lives at sellerOps.payouts.status.<ENUM>: this is module scope and
 * has no translator in it, and a label a seller reads has to be able to be
 * Arabic. The enum keys stay exactly as the schema writes them.
 */
const PAYOUT_STATUS_TONE: Record<string, PillTone> = {
  PENDING: "neutral",
  PROCESSING: "primary",
  PAID: "success",
  FAILED: "danger",
};

/**
 * formatCurrency's own fallback prints an unrecognised code verbatim rather than
 * substituting another currency's symbol, so an unknown code is routed to it
 * deliberately instead of being coerced to a currency this row is not in.
 */
const money = (amount: number, code: string) =>
  formatCurrency(amount, isSupportedCurrency(code) ? code : (code as SupportedCurrency));

/**
 * One figure per currency held, each carrying its own code. The old version
 * stacked `text-xl font-bold` lines in orange, green and red — three raw hues
 * carrying no information the label did not already carry, and no dark value at
 * all. A currency total is a figure, so it is rendered as one: tabular, ranked,
 * and never animated.
 *
 * A seller holding a single currency gets section rank, because that is the
 * common case and it deserves the room. A seller holding several drops to inline
 * rank so the lines stay a readable list rather than a wall of large numerals.
 */
function MoneyLines({ totals, currencies }: { totals: Record<string, number>; currencies: string[] }) {
  if (currencies.length === 0) return <Num value="—" rank="section" />;
  return (
    <div className="space-y-0.5">
      {currencies.map((c) => (
        <div key={c}>
          {/* flex-wrap, because CellGrid is a single clipping panel: a
              section-rank figure like "AED 1,234,567.89" is wider than a quarter
              of the grid, and a silently cropped financial figure is worse than
              a code that wraps onto its own line. */}
          <Num
            className="flex-wrap"
            value={money(totals[c] ?? 0, c)}
            rank={currencies.length === 1 ? "section" : "inline"}
          />
        </div>
      ))}
    </div>
  );
}

export default async function PayoutsPage() {
  const t = await getTranslations("sellerOps");
  const { seller, membership } = await requireSellerPermission("finance.view");

  const [payouts, receivables] = await Promise.all([
    db.sellerPayout.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { amount: true, commission: true, net: true } } },
    }),
    db.sellerFinancialAdjustment.groupBy({
      by: ["currency"],
      where: { sellerId: seller.id, status: "OPEN" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  // Payouts and adjustments carry their own currency, and a GCC seller can
  // legitimately hold AED and SAR payouts side by side. Summing Number(amount)
  // across rows and labelling the result "AED" (what this page used to do)
  // reported a figure that existed in no ledger. Everything here is grouped by
  // currency and rendered one line per currency instead.
  type Totals = Record<string, number>;
  const sumBy = (rows: Array<{ currency: string; amount: unknown }>): Totals =>
    rows.reduce<Totals>((acc, r) => ({ ...acc, [r.currency]: (acc[r.currency] ?? 0) + Number(r.amount) }), {});
  const pendingByCurrency = sumBy(payouts.filter((p) => ["PENDING", "PROCESSING"].includes(p.status)));
  const paidByCurrency = sumBy(payouts.filter((p) => p.status === "PAID"));
  const receivableByCurrency: Totals = Object.fromEntries(
    receivables.map((r) => [r.currency, Math.abs(Number(r._sum.amount ?? 0))]),
  );
  const openAdjustments = receivables.reduce((n, r) => n + r._count._all, 0);
  const currencies = Array.from(
    new Set([...Object.keys(pendingByCurrency), ...Object.keys(paidByCurrency), ...Object.keys(receivableByCurrency)]),
  ).sort();

  // A status nobody has named yet is still a fact about the payout, so an
  // unmapped enum is shown as it reads rather than dropped or relabelled.
  const payoutStatus = (status: string) => ({
    label: t.has(`payouts.status.${status}`) ? t(`payouts.status.${status}`) : status.replace(/_/g, " "),
    tone: PAYOUT_STATUS_TONE[status] ?? ("neutral" as PillTone),
  });

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("payouts.eyebrow")}
          title={t("payouts.title")}
          description={t("payouts.description")}
          // LAW E, and the single most important sentence on this page: every
          // figure below is reported in the currency it was recorded in. There is
          // no combined total anywhere on this screen, on purpose.
          dateline={t("payouts.dateline")}
        />

        <CellGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <div>
            <Eyebrow>{t("payouts.pending.label")}</Eyebrow>
            <div className="mt-1.5">
              <MoneyLines totals={pendingByCurrency} currencies={currencies} />
            </div>
            <Dateline className="mt-1">{t("payouts.pending.dateline")}</Dateline>
          </div>

          <div>
            <Eyebrow>{t("payouts.paid.label")}</Eyebrow>
            <div className="mt-1.5">
              <MoneyLines totals={paidByCurrency} currencies={currencies} />
            </div>
            <Dateline className="mt-1">{t("payouts.paid.dateline")}</Dateline>
          </div>

          <Stat
            label={t("payouts.commission.label")}
            value={Number(seller.commissionRate)}
            unit="%"
            rank="section"
            dateline={t("payouts.commission.dateline")}
          />

          <div>
            <Eyebrow>{t("payouts.receivable.label")}</Eyebrow>
            <div className="mt-1.5">
              <MoneyLines totals={receivableByCurrency} currencies={currencies} />
            </div>
            <p className="u-meta mt-1 text-ink-2">
              {/* `count` picks the plural form; `n` is the same figure as a
                  STRING, because a bare number renders in the locale's own
                  numeral system and every figure in this product is Western. */}
              {t("payouts.receivable.openAdjustments", { count: openAdjustments, n: String(openAdjustments) })}
            </p>
            {currencies.length > 0 && (
              <>
                {/* Not a Dateline. A dateline is a citation — it says where a
                    figure came from — and setting money in the serif-italic
                    provenance voice both misuses it and drops the tabular
                    figures that let a column of currency be compared. The net
                    position is a figure, so it is rendered as one. */}
                <p className="u-meta mt-1 text-ink-2">
                  {t("payouts.receivable.netPosition")}{" "}
                  {currencies.map((c, i) => (
                    <span key={c}>
                      {i > 0 ? " · " : ""}
                      <span className="fig font-medium text-ink-1">
                        {money((pendingByCurrency[c] ?? 0) - (receivableByCurrency[c] ?? 0), c)}
                      </span>
                    </span>
                  ))}
                </p>
                <Dateline className="mt-1">{t("payouts.receivable.netDateline")}</Dateline>
              </>
            )}
          </div>
        </CellGrid>

        <LedgerTable
          title={t("payouts.history.title")}
          dateline={t("payouts.history.dateline")}
          rows={payouts}
          getRowKey={(p) => p.id}
          density="compact"
          stickyHead
          footer={t("payouts.history.footer", { count: payouts.length, n: String(payouts.length) })}
          columns={[
            {
              key: "period",
              label: t("payouts.history.col.period"),
              // Two <time> elements rather than one wrapping the whole range:
              // a single dateTime of periodFrom would tell a machine the cell is
              // one day when the text on screen says it is a period.
              render: (p) => (
                <span className="whitespace-nowrap">
                  <time dateTime={p.periodFrom.toISOString()}>{format(p.periodFrom, "MMM d")}</time>
                  {" – "}
                  <time dateTime={p.periodTo.toISOString()}>{format(p.periodTo, "MMM d, yyyy")}</time>
                </span>
              ),
            },
            {
              key: "gross",
              label: t("payouts.history.col.gross"),
              numeric: true,
              render: (p) => {
                const gross = p.items.reduce((s, i) => s + Number(i.amount), 0);
                return <span className="text-ink-2">{money(gross || Number(p.amount), p.currency)}</span>;
              },
            },
            {
              key: "commission",
              label: t("payouts.history.col.commission"),
              numeric: true,
              hideOnMobile: true,
              render: (p) => {
                const comm = p.items.reduce((s, i) => s + Number(i.commission), 0);
                // A true minus sign rather than a hyphen, and the metadata ink
                // rather than red: a commission deduction is the agreed terms
                // working, not an error state, and colour in this portal means
                // state.
                return <span className="text-ink-2">−{money(comm, p.currency)}</span>;
              },
            },
            {
              key: "net",
              label: t("payouts.history.col.net"),
              numeric: true,
              render: (p) => {
                const net = p.items.reduce((s, i) => s + Number(i.net), 0);
                // The one figure a seller opens this page for, so it is the one
                // figure in the row carrying full ink and weight.
                return <span className="font-medium text-ink-1">{money(net || Number(p.amount), p.currency)}</span>;
              },
            },
            {
              key: "status",
              label: t("payouts.history.col.status"),
              render: (p) => {
                const view = payoutStatus(p.status);
                return <StatusPill tone={view.tone} dot>{view.label}</StatusPill>;
              },
            },
            {
              key: "reference",
              label: t("payouts.history.col.reference"),
              hideOnMobile: true,
              // Mono is for identifiers — a bank reference is one. Money above
              // is not, which is why none of the figure columns use it.
              render: (p) => <span className="u-mono text-ink-3">{p.reference ?? "—"}</span>,
            },
            {
              key: "processedAt",
              label: t("payouts.history.col.processed"),
              hideOnMobile: true,
              render: (p) =>
                p.processedAt ? (
                  <time dateTime={p.processedAt.toISOString()} className="text-ink-3">
                    {format(p.processedAt, "MMM d, yyyy")}
                  </time>
                ) : (
                  <span className="text-ink-3">—</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("payouts.history.empty.eyebrow")}
              headline={t("payouts.history.empty.headline")}
              // A currency-neutral mark. The old page used a dollar sign on a
              // GCC marketplace that settles in AED, SAR, QAR, KWD, BHD and OMR.
              icon={<Wallet className="h-3.5 w-3.5" aria-hidden="true" />}
              body={t("payouts.history.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">{t("payouts.history.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
