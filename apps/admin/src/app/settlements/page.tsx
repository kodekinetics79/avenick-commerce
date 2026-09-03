import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSettlementBoard, Prisma, PayoutStatus, type Currency } from "@avenick/database";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { generatePayoutsForPeriod, markPayoutPaid, startPayoutProcessing } from "./actions";
import { Receipt, CheckCircle, Clock, RefreshCw, XCircle, Store, AlertTriangle, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface,
  Num, Eyebrow, Dateline, Button, type PillTone,
} from "@avenick/ui";
import { MoneyStat } from "@/app/finance/money-figures";
import { FilterTabs, Pager, CONTROL, CONTROL_SM } from "@/components/console/chrome";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.settlements");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Tone and icon per status; the labels are translated from `settlements.status` and `settlements.card`. */
const STATUS_META: Record<PayoutStatus, { tone: PillTone; icon: typeof CheckCircle }> = {
  PENDING: { tone: "warning", icon: Clock },
  PROCESSING: { tone: "accent", icon: RefreshCw },
  PAID: { tone: "success", icon: CheckCircle },
  FAILED: { tone: "danger", icon: XCircle },
};

const ZERO = new Prisma.Decimal(0);

/** Money crosses to a string here and nowhere earlier; currency is never blended. */
const money = (amount: Prisma.Decimal, currency: Currency) =>
  formatCurrency(Number(amount), currency as SupportedCurrency);

/** UTC calendar day, matching how actions.ts interprets a submitted period. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const counter = (raw: string | undefined) => {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
};

interface PageProps {
  searchParams: {
    status?: string;
    page?: string;
    ran?: string;
    generated?: string;
    sellers?: string;
    claimed?: string;
    unpayable?: string;
    heldSellers?: string;
    heldAccruals?: string;
    failed?: string;
    refusals?: string;
  };
}

export default async function SettlementsPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.settlements");

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(PayoutStatus).includes(searchParams.status as PayoutStatus)
    ? (searchParams.status as PayoutStatus)
    : undefined;

  const { payouts, total, statusTotals, claimable } = await getSettlementBoard({ page, limit, status });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const linesFor = (s: PayoutStatus) => statusTotals.filter((row) => row.status === s);
  const countFor = (s: PayoutStatus) =>
    linesFor(s).reduce((sum, row) => sum + row._count._all, 0);

  const filterHref = (params: Record<string, string | undefined>) => {
    // The run summary belongs to one response only — dropping it here keeps a
    // filter click from reprinting an outcome that already happened.
    const merged = { ...searchParams, page: undefined, ran: undefined, generated: undefined, sellers: undefined, claimed: undefined, unpayable: undefined, heldSellers: undefined, heldAccruals: undefined, failed: undefined, refusals: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/settlements?${qs}` : "/settlements";
  };

  const today = isoDay(new Date());
  const defaultFrom = claimable.earliestAt ? isoDay(claimable.earliestAt) : today;
  // One entry per seller: a seller accruing in two currencies is settled once,
  // into one payout per currency.
  const claimableSellers = [...new Map(claimable.bySeller.map((row) => [row.sellerId, row])).values()];
  const ran = searchParams.ran === "1";
  const generated = counter(searchParams.generated);
  const unpayable = counter(searchParams.unpayable);
  const heldSellers = counter(searchParams.heldSellers);
  const heldAccruals = counter(searchParams.heldAccruals);
  const failed = counter(searchParams.failed);
  // Refusal text is echoed from our own redirect, but it is still a URL
  // parameter anyone can craft; React escapes it and it is rendered as text only.
  const refusals = (searchParams.refusals ?? "").split(" | ").filter(Boolean);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: t("breadcrumbFinance"), href: "/finance" }, { label: t("breadcrumbSelf") }]}
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        {ran && (
          // The outcome of one run. A refusal is the loudest thing on the page,
          // because a refused seller means the ledger did not reconcile.
          <Surface role="status" tone={failed > 0 ? "danger" : "accent"} className="p-4">
            <p className="u-ui font-medium text-ink-1">
              {generated > 0
                ? t("run.created", { count: generated, value: String(generated) })
                : t("run.createdNone")}
            </p>
            <p className="u-meta mt-1 max-w-prose text-ink-2">
              {t("run.examined", {
                count: counter(searchParams.sellers),
                value: String(counter(searchParams.sellers)),
              })}{" · "}
              {t("run.claimed", { value: String(counter(searchParams.claimed)) })}
              {unpayable > 0 ? ` · ${t("run.unpayable", { value: String(unpayable) })}` : ""}
              {heldSellers > 0 ? ` · ${t("run.heldSellers", { value: String(heldSellers) })}` : ""}
              {heldAccruals > 0
                ? ` · ${t("run.heldAccruals", { count: heldAccruals, value: String(heldAccruals) })}`
                : ""}.
              {generated > 0 ? t("run.pendingNote") : ""}
            </p>
            {failed > 0 && (
              <div className="mt-3 border-t border-danger-rule pt-3">
                <p className="u-ui inline-flex items-center gap-2 font-medium text-danger-ink">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t("run.refused", { count: failed, value: String(failed) })}
                </p>
                <ul className="u-meta mt-1.5 list-disc space-y-0.5 ps-5 text-ink-2">
                  {refusals.map((line, index) => <li key={index}>{line}</li>)}
                </ul>
              </div>
            )}
          </Surface>
        )}

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          {Object.values(PayoutStatus).map((s) => {
            const lines = linesFor(s);
            const count = countFor(s);
            return (
              <MoneyStat
                key={s}
                label={t(`card.${s}`)}
                lines={lines.map((line) => ({
                  currency: line.currency,
                  formatted: money(line._sum.amount ?? ZERO, line.currency),
                }))}
                note={t("tiles.note", { count, value: String(count) })}
              />
            );
          })}
        </CellGrid>

        {/* Generate. The control only exists when there is accrual it can turn
            into money — a period picker that provably produces nothing would be
            a button that looks like it works. */}
        <Surface className="overflow-hidden">
          <div className="border-b-2 border-border-strong px-5 py-3">
            <h2 className="u-h3 inline-flex items-center gap-2 text-ink-1">
              <PlayCircle className="h-4 w-4 text-ink-3" aria-hidden="true" /> {t("generate.title")}
            </h2>
          </div>
          {claimable.byCurrency.length === 0 ? (
            <EmptyState
              eyebrow={t("generate.emptyEyebrow")}
              headline={t("generate.emptyHeadline")}
              body={t("generate.emptyBody")}
            />
          ) : (
            <div className="p-5">
              <p className="u-ui max-w-prose text-ink-2">{t("generate.intro")}</p>

              {/* What the run has to work with, per currency. Presented as one
                  hairline-divided panel, because these figures are one fact. */}
              {/* A single column, always full: the number of currencies varies,
                  and a hairline-divided panel with a half-empty last row would
                  read as a missing cell rather than as fewer currencies. */}
              <CellGrid cols={{ base: 1 }} density="compact" className="mt-4">
                {claimable.byCurrency.map((row) => (
                  <MoneyStat
                    key={row.currency}
                    label={t("generate.currencyLabel", { currency: row.currency })}
                    lines={[{ currency: row.currency, formatted: money(row.amount, row.currency) }]}
                    dateline={t("generate.currencyDateline", {
                      orders: t("generate.ordersCount", { count: row.orders, value: String(row.orders) }),
                      sellers: t("generate.sellersCount", { count: row.sellers, value: String(row.sellers) }),
                      date: format(row.earliestAt, "MMM d, yyyy"),
                    })}
                  />
                ))}
              </CellGrid>

              {/* The run itself. Recessed, because every control on it is an
                  input; the one raised thing is the act. */}
              <form
                action={generatePayoutsForPeriod}
                data-rung={1}
                className="mt-4 flex flex-wrap items-end gap-3 border border-border p-4"
              >
                <label className="u-meta flex flex-col gap-1 font-medium text-ink-2">
                  {t("generate.from")}
                  <input
                    data-rung={1}
                    type="date"
                    name="periodFrom"
                    required
                    max={today}
                    defaultValue={defaultFrom}
                    className={`${CONTROL} fig w-auto`}
                  />
                </label>
                <label className="u-meta flex flex-col gap-1 font-medium text-ink-2">
                  {t("generate.to")}
                  <input
                    data-rung={1}
                    type="date"
                    name="periodTo"
                    required
                    max={today}
                    defaultValue={today}
                    className={`${CONTROL} fig w-auto`}
                  />
                </label>
                <label className="u-meta flex min-w-[16rem] flex-col gap-1 font-medium text-ink-2">
                  {t("generate.seller")}
                  <select data-rung={1} name="sellerId" defaultValue="" className={CONTROL}>
                    <option value="">{t("generate.allSellers")}</option>
                    {claimableSellers.map((row) => (
                      <option key={row.sellerId} value={row.sellerId}>{row.sellerName}</option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="secondary" size="md">
                  {t("generate.submit")}
                </Button>
              </form>

              <div className="mt-4 overflow-x-auto scrollbar-thin">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t("generate.tableCaption")}</caption>
                  <thead>
                    <tr className="border-b-2 border-border-strong">
                      {[t("generate.columns.seller"), t("generate.columns.currency"), t("generate.columns.orders"), t("generate.columns.commission")].map((h, i) => (
                        <th key={h} scope="col" className={`px-3 py-2 ${i === 3 ? "text-end" : "text-start"}`}>
                          <Eyebrow as="span" className="block">{h}</Eyebrow>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {claimable.bySeller.map((row) => (
                      <tr key={`${row.sellerId}:${row.currency}`} className="u-ledger-row border-b border-hairline last:border-b-0">
                        <td className="px-3 py-2 text-ui text-ink-1">{row.sellerName}</td>
                        <td className="px-3 py-2 text-ui text-ink-2">{row.currency}</td>
                        <td className="fig px-3 py-2 text-ui text-ink-2">{row.orders}</td>
                        <td className="fig px-3 py-2 text-end text-ui text-ink-1">{money(row.amount, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {claimable.truncated && (
                  <Dateline className="mt-2">
                    {t("generate.truncated", { count: String(claimable.bySeller.length) })}
                  </Dateline>
                )}
              </div>
            </div>
          )}
        </Surface>

        <FilterTabs
          label={t("filters.label")}
          tabs={([undefined, ...Object.values(PayoutStatus)] as const).map((s) => ({
            href: filterHref({ status: s }),
            label: s ? t(`status.${s}`) : t("filters.all"),
            active: status === s || (!status && !s),
          }))}
        />

        <LedgerTable
          rows={payouts}
          getRowKey={(p) => p.id}
          stickyHead
          dateline={t("table.dateline")}
          rowProps={(p) => ({
            // A payout whose lines do not add up to its own total is the one
            // thing on this page that must never be scrolled past.
            // The hover tint is a plain background-color, so without a hover
            // variant of its own the wash is REPLACED the moment the pointer
            // lands on the row — i.e. exactly when the operator is reading it.
            // The hover state is a deeper wash of the same hue, never a neutral.
            className: p.lineTotals.net.equals(p.amount) ? undefined : "bg-danger-soft hover:bg-danger/10",
          })}
          columns={[
            {
              key: "seller",
              label: t("columns.seller"),
              render: (p) => (
                <span className="inline-flex items-center gap-2 py-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
                    <Store className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-ink-1">{p.seller.businessNameEn}</span>
                </span>
              ),
            },
            {
              key: "period",
              label: t("columns.period"),
              hideOnMobile: true,
              render: (p) => (
                <span className="whitespace-nowrap text-ink-2">
                  {format(p.periodFrom, "MMM d")} – {format(p.periodTo, "MMM d, yyyy")}
                </span>
              ),
            },
            {
              key: "lines",
              label: t("columns.lines"),
              width: "22rem",
              render: (p) => {
                // Totals are aggregated over every line; p.items is a preview.
                const { gross, commission, net: lineNet } = p.lineTotals;
                return (
                  <details className="max-w-[22rem] py-1">
                    <summary className="u-focus cursor-pointer select-none rounded-nested text-ink-2 marker:text-ink-3">
                      {t.rich("lines.orders", {
                        count: p._count.items,
                        value: String(p._count.items),
                        n: (chunks) => <span className="fig">{chunks}</span>,
                      })}
                    </summary>
                    <table className="mt-2 w-full border-collapse">
                      <caption className="sr-only">{t("lines.caption")}</caption>
                      <thead>
                        <tr className="border-b border-hairline">
                          {[t("lines.columns.order"), t("lines.columns.gross"), t("lines.columns.commission"), t("lines.columns.net")].map((h, i) => (
                            <th key={h} scope="col" className={`py-1 ${i === 0 ? "text-start" : "text-end"}`}>
                              <Eyebrow as="span" className="block">{h}</Eyebrow>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((item) => (
                          <tr key={item.id}>
                            <td className="u-mono py-1 text-meta text-ink-2">{item.order.orderNumber}</td>
                            <td className="fig py-1 text-end text-meta text-ink-2">{money(item.amount, p.currency)}</td>
                            <td className="fig py-1 text-end text-meta text-danger-ink">−{money(item.commission, p.currency)}</td>
                            <td className="fig py-1 text-end text-meta font-medium text-ink-1">{money(item.net, p.currency)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-border-strong">
                          <td className="py-1 text-meta font-medium text-ink-1">{t("lines.total")}</td>
                          <td className="fig py-1 text-end text-meta text-ink-1">{money(gross, p.currency)}</td>
                          <td className="fig py-1 text-end text-meta text-danger-ink">−{money(commission, p.currency)}</td>
                          <td className="fig py-1 text-end text-meta font-medium text-ink-1">{money(lineNet, p.currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                    {p._count.items > p.items.length && (
                      <Dateline className="mt-1">
                        {t("lines.truncated", { shown: String(p.items.length), total: String(p._count.items) })}
                      </Dateline>
                    )}
                    {p.notes && <Dateline className="mt-1.5">{p.notes}</Dateline>}
                  </details>
                );
              },
            },
            {
              key: "amount",
              label: t("columns.amount"),
              numeric: true,
              render: (p) => {
                const lineNet = p.lineTotals.net;
                return (
                  <div className="flex flex-col items-end gap-1 py-1">
                    <Num value={money(p.amount, p.currency)} className="whitespace-nowrap" />
                    {/* Refund netting decrements the payout and its lines
                        together, so these agree unless something wrote one
                        without the other. Say so rather than pick one. */}
                    {!lineNet.equals(p.amount) && (
                      <span className="u-meta inline-flex items-center gap-1 whitespace-nowrap font-medium text-danger-ink">
                        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {t("lineMismatch", { amount: money(lineNet, p.currency) })}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "status",
              label: t("columns.status"),
              render: (p) => {
                const cfg = STATUS_META[p.status];
                const StatusIcon = cfg.icon;
                return (
                  <div className="py-1">
                    <StatusPill tone={cfg.tone}>
                      <StatusIcon className="h-3 w-3" aria-hidden="true" /> {t(`status.${p.status}`)}
                    </StatusPill>
                    {p.processedAt && (
                      <p className="u-meta mt-0.5 text-ink-3">{format(p.processedAt, "MMM d, yyyy")}</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "reference",
              label: t("columns.reference"),
              hideOnMobile: true,
              render: (p) => <span className="u-mono text-meta text-ink-3">{p.reference ?? "—"}</span>,
            },
            {
              key: "createdAt",
              label: t("columns.created"),
              hideOnMobile: true,
              render: (p) => <span className="whitespace-nowrap text-ink-2">{format(p.createdAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "record",
              label: t("columns.record"),
              width: "260px",
              render: (p) => {
                if (p.status === "PAID") return <span className="u-meta text-ink-3">{t("record.settled")}</span>;
                if (p.status === "FAILED") {
                  return (
                    // The only transition out of FAILED is back to PROCESSING
                    // (finance.setPayoutStatus); a Paid control here would always error.
                    <form action={startPayoutProcessing.bind(null, p.id)}>
                      <Button type="submit" variant="secondary" size="xs">
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("record.retry")}
                      </Button>
                    </form>
                  );
                }
                return (
                  <div className="flex flex-col gap-2 py-1">
                    {p.status === "PENDING" && (
                      <form action={startPayoutProcessing.bind(null, p.id)}>
                        <Button type="submit" variant="secondary" size="xs">
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("record.markInTransfer")}
                        </Button>
                      </form>
                    )}
                    {/* Recording a transfer settles the commission on this
                        payout's orders and cannot be undone, so it is marked as
                        irreversible in words rather than in a title attribute
                        nothing announces. */}
                    <form
                      action={markPayoutPaid.bind(null, p.id)}
                      data-rung={1}
                      className="flex flex-col gap-1.5 border border-border p-2"
                    >
                      <Eyebrow>{t("record.eyebrow")}</Eyebrow>
                      <input
                        data-rung={1}
                        name="reference"
                        required
                        maxLength={120}
                        placeholder={t("record.referencePlaceholder")}
                        aria-label={t("record.referenceLabel", { seller: p.seller.businessNameEn })}
                        className={CONTROL_SM}
                      />
                      <Button type="submit" variant="secondary" size="xs" className="self-start">
                        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t("record.markPaid")}
                      </Button>
                      <span className="u-meta text-ink-3">{t("record.finalNote")}</span>
                    </form>
                  </div>
                );
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("empty.eyebrow")}
              headline={
                status
                  ? t("empty.headlineFiltered")
                  : claimable.byCurrency.length > 0
                    ? t("empty.headlineClaimable")
                    : t("empty.headlineNone")
              }
              body={
                status
                  ? t("empty.bodyFiltered")
                  : claimable.byCurrency.length > 0
                    ? t("empty.bodyClaimable")
                    : t("empty.bodyNone")
              }
              action={
                status ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/settlements">{t("empty.action")}</Link>
                  </Button>
                ) : undefined
              }
              icon={<Receipt className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(target) => filterHref({ page: String(target) })}
              summary={t.rich("footer", {
                total: String(total),
                count: total,
                n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
              })}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
