import Link from "next/link";
import { format } from "date-fns";
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

export const metadata = { title: "Payouts" };

/** PayoutStatus, mapped to the tone vocabulary the rest of the portal uses. */
const PAYOUT_STATUS: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  PROCESSING: { label: "Processing", tone: "primary" },
  PAID: { label: "Paid", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
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

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Finance"
          title="Payouts"
          description="What the platform has settled to you, and what is still owed in either direction."
          // LAW E, and the single most important sentence on this page: every
          // figure below is reported in the currency it was recorded in. There is
          // no combined total anywhere on this screen, on purpose.
          dateline="Payout and adjustment totals, as recorded, each in its own currency · no conversion is applied"
        />

        <CellGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <div>
            <Eyebrow>Pending payout</Eyebrow>
            <div className="mt-1.5">
              <MoneyLines totals={pendingByCurrency} currencies={currencies} />
            </div>
            <Dateline className="mt-1">Payouts recorded as pending or processing</Dateline>
          </div>

          <div>
            <Eyebrow>Paid out</Eyebrow>
            <div className="mt-1.5">
              <MoneyLines totals={paidByCurrency} currencies={currencies} />
            </div>
            <Dateline className="mt-1">Payouts recorded as paid, all time</Dateline>
          </div>

          <Stat
            label="Commission rate"
            value={Number(seller.commissionRate)}
            unit="%"
            rank="section"
            dateline="The rate on your account today, not the rate applied to past payouts"
          />

          <div>
            <Eyebrow>Refund receivable</Eyebrow>
            <div className="mt-1.5">
              <MoneyLines totals={receivableByCurrency} currencies={currencies} />
            </div>
            <p className="u-meta mt-1 text-ink-2">
              {openAdjustments} open adjustment{openAdjustments === 1 ? "" : "s"}
            </p>
            {currencies.length > 0 && (
              <>
                {/* Not a Dateline. A dateline is a citation — it says where a
                    figure came from — and setting money in the serif-italic
                    provenance voice both misuses it and drops the tabular
                    figures that let a column of currency be compared. The net
                    position is a figure, so it is rendered as one. */}
                <p className="u-meta mt-1 text-ink-2">
                  Net position{" "}
                  {currencies.map((c, i) => (
                    <span key={c}>
                      {i > 0 ? " · " : ""}
                      <span className="fig font-medium text-ink-1">
                        {money((pendingByCurrency[c] ?? 0) - (receivableByCurrency[c] ?? 0), c)}
                      </span>
                    </span>
                  ))}
                </p>
                <Dateline className="mt-1">
                  Pending payouts less open refund adjustments, in each currency
                </Dateline>
              </>
            )}
          </div>
        </CellGrid>

        <LedgerTable
          title="Payout history"
          dateline="Every payout raised on your account, as recorded · gross, commission and net are summed from that payout's own lines"
          rows={payouts}
          getRowKey={(p) => p.id}
          density="compact"
          stickyHead
          footer={`${payouts.length} payout${payouts.length === 1 ? "" : "s"} recorded`}
          columns={[
            {
              key: "period",
              label: "Period",
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
              label: "Gross",
              numeric: true,
              render: (p) => {
                const gross = p.items.reduce((s, i) => s + Number(i.amount), 0);
                return <span className="text-ink-2">{money(gross || Number(p.amount), p.currency)}</span>;
              },
            },
            {
              key: "commission",
              label: "Commission",
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
              label: "Net",
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
              label: "Status",
              render: (p) => {
                const view = PAYOUT_STATUS[p.status] ?? { label: p.status.replace(/_/g, " "), tone: "neutral" as PillTone };
                return <StatusPill tone={view.tone} dot>{view.label}</StatusPill>;
              },
            },
            {
              key: "reference",
              label: "Reference",
              hideOnMobile: true,
              // Mono is for identifiers — a bank reference is one. Money above
              // is not, which is why none of the figure columns use it.
              render: (p) => <span className="u-mono text-ink-3">{p.reference ?? "—"}</span>,
            },
            {
              key: "processedAt",
              label: "Processed",
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
              eyebrow="Nothing recorded"
              headline="No payout has been raised on your account yet."
              // A currency-neutral mark. The old page used a dollar sign on a
              // GCC marketplace that settles in AED, SAR, QAR, KWD, BHD and OMR.
              icon={<Wallet className="h-3.5 w-3.5" aria-hidden="true" />}
              body="Payouts are raised by the platform as your delivered orders settle."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">Review your orders</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
