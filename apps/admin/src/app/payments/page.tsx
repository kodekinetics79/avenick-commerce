import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, getPayments, PaymentStatus, Prisma } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { CreditCard, CheckCircle, Clock, XCircle, RotateCcw, Building2, Smartphone, Search, Beaker, Banknote, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface,
  Num, Eyebrow, Dateline, Button, type PillTone,
} from "@avenick/ui";
import { MoneyStat } from "@/app/finance/money-figures";
import { FilterTabs, Pager, CONTROL, CONTROL_SM } from "@/components/console/chrome";
import { confirmBankTransfer } from "./actions";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.payments");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Tone and icon per status; the label is translated from `payments.status`. */
const STATUS_META: Record<PaymentStatus, { tone: PillTone; icon: typeof CheckCircle }> = {
  PAID: { tone: "success", icon: CheckCircle },
  UNPAID: { tone: "warning", icon: Clock },
  PARTIALLY_PAID: { tone: "warning", icon: Clock },
  FAILED: { tone: "danger", icon: XCircle },
  REFUNDED: { tone: "neutral", icon: RotateCcw },
};

/** Icon per method; the label is translated from `payments.method`. */
const METHOD_ICON: Record<string, typeof CreditCard> = {
  BANK_TRANSFER: Building2,
  CREDIT_CARD: CreditCard,
  MADA: CreditCard,
  APPLE_PAY: Smartphone,
  STC_PAY: Smartphone,
  MOCK: Beaker,
};

/** Refusal and outcome copy is read by the operator, so it is translated. */
type Msg = (key: string, values?: Record<string, string | number>) => string;

// Mirrors CLOSED_ORDER_STATUSES in packages/database/src/services/payments.ts.
// The service is the authority; this list only decides whether a control is
// worth rendering, so a divergence costs a refused submission, never a wrong write.
const CLOSED_ORDER_STATUSES = new Set(["CANCELLED", "REFUNDED", "RETURNED"]);

interface OrderFact {
  id: string;
  total: Prisma.Decimal;
  currency: string;
  status: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  createdAt: Date;
}

interface Receipts {
  total: Prisma.Decimal;
  currencies: string[];
}

type Settlement =
  | { kind: "confirmable"; outstanding: Prisma.Decimal; suggested: Prisma.Decimal }
  | { kind: "blocked"; reason: string }
  | { kind: "none" };

/**
 * Decides whether a bank-transfer confirmation control may be shown for a row.
 * A control that cannot legitimately succeed is never rendered; where the
 * reason is operationally useful it is stated instead.
 */
function settlementFor(
  payment: { status: PaymentStatus; method: string; amount: Prisma.Decimal; currency: string },
  order: OrderFact | undefined,
  receipts: Receipts | undefined,
  t: Msg,
): Settlement {
  // Gateway payments settle through their signed webhook; there is no
  // legitimate manual confirmation for them, so no control is offered.
  if (payment.method !== "BANK_TRANSFER") return { kind: "none" };
  if (payment.status === "PAID") return { kind: "none" };
  if (payment.status !== "UNPAID") {
    return { kind: "blocked", reason: t("blocked.statusNotConfirmable", { status: t(`status.${payment.status}`).toLowerCase() }) };
  }
  if (!order) return { kind: "blocked", reason: t("blocked.orderUnavailable") };
  if (order.paymentMethod !== "BANK_TRANSFER") return { kind: "blocked", reason: t("blocked.notBankTransferOrder") };
  if (CLOSED_ORDER_STATUSES.has(order.status)) {
    return { kind: "blocked", reason: t("blocked.orderStatus", { status: t(`orderStatus.${order.status}`) }) };
  }
  if (order.paymentStatus === "REFUNDED") return { kind: "blocked", reason: t("blocked.orderRefunded") };
  // No FX policy exists in this system, so anything that would require
  // converting between currencies is handed back to a human.
  if (payment.currency !== order.currency) {
    return {
      kind: "blocked",
      reason: t("blocked.currencyMismatch", { paymentCurrency: payment.currency, orderCurrency: order.currency }),
    };
  }
  if (receipts?.currencies.some((currency) => currency !== order.currency)) {
    return { kind: "blocked", reason: t("blocked.mixedReceipts") };
  }

  const outstanding = order.total.sub(receipts?.total ?? 0);
  if (outstanding.lessThanOrEqualTo(0)) return { kind: "blocked", reason: t("blocked.alreadyCovered") };
  return {
    kind: "confirmable",
    outstanding,
    suggested: payment.amount.greaterThan(outstanding) ? outstanding : payment.amount,
  };
}

interface PageProps {
  searchParams: {
    status?: string;
    search?: string;
    page?: string;
    // Outcome of the last confirmation, carried back by the action in the URL
    // so a reload cannot replay it and a refusal reaches the operator verbatim.
    confirmed?: string;
    outcome?: string;
    sharedRef?: string;
    confirmError?: string;
    payment?: string;
  };
}

// Outcome params are dropped from every filter link so the banner does not
// follow the operator around the listing as though it had happened again.
const OUTCOME_PARAMS = { confirmed: undefined, outcome: undefined, sharedRef: undefined, confirmError: undefined, payment: undefined };

export default async function PaymentsPage({ searchParams }: PageProps) {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.payments");

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(PaymentStatus).includes(searchParams.status as PaymentStatus)
    ? (searchParams.status as PaymentStatus)
    : undefined;
  const search = searchParams.search?.trim() || undefined;

  const { payments, total } = await getPayments({ page, limit, status, search });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const orderIds = [...new Set(payments.map((p) => p.order.id))];
  const [orderFacts, confirmedReceipts, ledgerTotals] = await Promise.all([
    // The listing query does not carry the order's money facts, and settlement
    // decisions cannot be made without them.
    db.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, total: true, currency: true, status: true, paymentStatus: true, paymentMethod: true, createdAt: true },
    }),
    db.payment.groupBy({
      by: ["orderId", "currency"],
      where: { orderId: { in: orderIds }, status: PaymentStatus.PAID },
      _sum: { amount: true },
    }),
    // Totals are grouped by currency as well as status: summing AED, SAR and
    // USD into one figure and labelling it AED would be an invented number.
    db.payment.groupBy({
      by: ["status", "currency"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const orderById = new Map<string, OrderFact>(orderFacts.map((order) => [order.id, order]));
  const receiptsByOrder = new Map<string, Receipts>();
  for (const group of confirmedReceipts) {
    const entry = receiptsByOrder.get(group.orderId) ?? { total: new Prisma.Decimal(0), currencies: [] };
    entry.total = entry.total.add(group._sum.amount ?? 0);
    entry.currencies.push(group.currency);
    receiptsByOrder.set(group.orderId, entry);
  }

  const ledgerFor = (statuses: PaymentStatus[]) => {
    const rows = ledgerTotals.filter((row) => statuses.includes(row.status));
    const byCurrency = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? new Prisma.Decimal(0)).add(row._sum.amount ?? 0));
    }
    return {
      count: rows.reduce((sum, row) => sum + row._count._all, 0),
      amounts: [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)),
    };
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, ...OUTCOME_PARAMS, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/payments?${qs}` : "/payments";
  };
  // Where the confirm action sends the operator back to: this listing, same
  // filters and page, without any stale outcome.
  const returnTo = filterHref({ page: page > 1 ? String(page) : undefined, search });

  const outcome = (() => {
    if (searchParams.confirmError) {
      return { tone: "refused" as const, title: t("outcome.refusedTitle"), detail: searchParams.confirmError };
    }
    if (!searchParams.confirmed) return null;
    const orderNumber = searchParams.confirmed;
    const title =
      searchParams.outcome === "REPLAY"
        ? t("outcome.replay", { orderNumber })
        : searchParams.outcome === "PAID"
          ? t("outcome.paid", { orderNumber })
          : searchParams.outcome === "PARTIALLY_PAID"
            ? t("outcome.partiallyPaid", { orderNumber })
            : t("outcome.recorded", { orderNumber });
    const sharedOrders = searchParams.sharedRef ? searchParams.sharedRef.split(",") : [];
    const shared = sharedOrders.length
      ? t("outcome.sharedRef", { count: sharedOrders.length, orders: sharedOrders.join(", ") })
      : null;
    return { tone: "ok" as const, title, detail: shared };
  })();

  // The four positions of the whole ledger, in the order an operator reads them:
  // what came in, what has not, what broke, what went back out.
  const tiles = [
    { key: "collected", label: t("tiles.collected"), statuses: [PaymentStatus.PAID] },
    { key: "awaiting", label: t("tiles.awaiting"), statuses: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] },
    { key: "failed", label: t("tiles.failed"), statuses: [PaymentStatus.FAILED] },
    { key: "refunded", label: t("tiles.refunded"), statuses: [PaymentStatus.REFUNDED] },
  ];

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        {outcome && (
          // The outcome of the last confirmation. Toned, because the difference
          // between "recorded", "already recorded" and "refused" is the whole
          // message and it must not be carried by an icon alone.
          <Surface
            role="status"
            tone={outcome.tone === "refused" ? "danger" : outcome.detail ? "warning" : "success"}
            className="p-4"
          >
            <p className="u-ui inline-flex items-center gap-2 font-medium text-ink-1">
              {outcome.tone === "refused" ? (
                <XCircle className="h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
              ) : outcome.detail ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-4 w-4 shrink-0 text-success-ink" aria-hidden="true" />
              )}
              {outcome.title}
            </p>
            {outcome.detail && <p className="u-meta mt-1 max-w-prose text-ink-2">{outcome.detail}</p>}
          </Surface>
        )}

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          {tiles.map((tile) => {
            const ledger = ledgerFor(tile.statuses);
            return (
              <MoneyStat
                key={tile.key}
                label={tile.label}
                lines={ledger.amounts.map(([currency, amount]) => ({
                  currency,
                  formatted: formatCurrency(Number(amount), currency as never),
                }))}
                note={t("tiles.note", { count: ledger.count, value: String(ledger.count) })}
              />
            );
          })}
        </CellGrid>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          <FilterTabs
            label={t("filters.label")}
            className="min-w-0 flex-1"
            tabs={([undefined, ...Object.values(PaymentStatus)] as const).map((s) => ({
              href: filterHref({ status: s }),
              label: s ? t(`status.${s}`) : t("filters.all"),
              active: status === s || (!status && !s),
            }))}
          />

          <form method="get" action="/payments" role="search" className="relative w-full lg:max-w-xs">
            {status && <input type="hidden" name="status" value={status} />}
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              data-rung={1}
              type="search"
              name="search"
              defaultValue={search ?? ""}
              aria-label={t("search.label")}
              placeholder={t("search.placeholder")}
              className={`${CONTROL} ps-9`}
            />
          </form>
        </div>

        <LedgerTable
          rows={payments}
          getRowKey={(p) => p.id}
          stickyHead
          dateline={t("table.dateline")}
          rowProps={(p) => ({
            // The row the last refusal was about, carried back in the URL so the
            // operator lands on it rather than hunting for it.
            // Hover is a plain background-color and would otherwise replace
            // this wash outright; the hover state deepens the same hue instead.
            className: searchParams.payment === p.id ? "bg-danger-soft hover:bg-danger/10" : undefined,
            "aria-current": searchParams.payment === p.id ? "true" : undefined,
          })}
          columns={[
            {
              key: "order",
              label: t("columns.order"),
              render: (p) => (
                <div className="py-1">
                  <Link
                    href={`/orders/${p.order.id}`}
                    className="u-focus u-mono rounded-nested text-meta font-medium text-primary-ink hover:underline"
                  >
                    {p.order.orderNumber}
                  </Link>
                  <p className="u-meta text-ink-3">{p.order.type}</p>
                </div>
              ),
            },
            {
              key: "customer",
              label: t("columns.customer"),
              hideOnMobile: true,
              render: (p) => (
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium text-ink-1">{p.order.user.firstName} {p.order.user.lastName}</p>
                  <p className="u-meta truncate text-ink-3">{p.order.user.email}</p>
                </div>
              ),
            },
            {
              key: "method",
              label: t("columns.method"),
              render: (p) => {
                // A method the platform does not know is shown by its own code
                // rather than under an invented label.
                const known = Object.prototype.hasOwnProperty.call(METHOD_ICON, p.method);
                const MethodIcon = METHOD_ICON[p.method] ?? CreditCard;
                return (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
                    <MethodIcon className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />{" "}
                    {known ? t(`method.${p.method}`) : p.method}
                  </span>
                );
              },
            },
            {
              key: "amount",
              label: t("columns.amount"),
              numeric: true,
              render: (p) => (
                <Num value={formatCurrency(Number(p.amount), p.currency as never)} className="whitespace-nowrap" />
              ),
            },
            {
              key: "status",
              label: t("columns.status"),
              render: (p) => {
                const cfg = STATUS_META[p.status];
                const StatusIcon = cfg.icon;
                return (
                  <StatusPill tone={cfg.tone}>
                    <StatusIcon className="h-3 w-3" aria-hidden="true" /> {t(`status.${p.status}`)}
                  </StatusPill>
                );
              },
            },
            {
              key: "gatewayRef",
              label: t("columns.gatewayRef"),
              hideOnMobile: true,
              render: (p) => <span className="u-mono text-meta text-ink-3">{p.gatewayRef ?? "—"}</span>,
            },
            {
              key: "date",
              label: t("columns.date"),
              hideOnMobile: true,
              render: (p) => (
                <span className="whitespace-nowrap text-ink-2">{format(p.paidAt ?? p.createdAt, "MMM d, yyyy HH:mm")}</span>
              ),
            },
            {
              key: "settlement",
              label: t("columns.settlement"),
              width: "300px",
              render: (p) => {
                const order = orderById.get(p.order.id);
                const settlement = settlementFor(p, order, receiptsByOrder.get(p.order.id), t);
                if (settlement.kind === "confirmable") {
                  return (
                    // The whole confirmation is one recessed well: everything you
                    // type is pressed into the row, and the outstanding figure —
                    // the number the operator is trying to match against the bank
                    // statement — leads it rather than trailing it.
                    <form
                      action={confirmBankTransfer.bind(null, p.id)}
                      data-rung={1}
                      className="my-1 flex flex-col gap-1.5 border border-border p-2"
                    >
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <div className="flex items-baseline justify-between gap-2">
                        <Eyebrow>{t("confirm.outstanding")}</Eyebrow>
                        <Num
                          value={formatCurrency(Number(settlement.outstanding), p.currency as never)}
                          className="whitespace-nowrap text-meta"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          data-rung={1}
                          name="bankReference"
                          required
                          maxLength={64}
                          placeholder={t("confirm.bankReference")}
                          aria-label={t("confirm.bankReferenceLabel", { orderNumber: p.order.orderNumber })}
                          className={`${CONTROL_SM} min-w-0 flex-1`}
                        />
                        <input
                          data-rung={1}
                          name="amount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          max={settlement.outstanding.toFixed(2)}
                          defaultValue={settlement.suggested.toFixed(2)}
                          required
                          aria-label={t("confirm.amountLabel", { orderNumber: p.order.orderNumber })}
                          className={`${CONTROL_SM} fig w-24 shrink-0 text-end`}
                        />
                      </div>
                      <div className="flex gap-1.5">
                        {/* A credit cannot predate the order it settles; the service
                            enforces this, the picker just stops the obvious typo. */}
                        <input
                          data-rung={1}
                          name="valueDate"
                          type="date"
                          required
                          min={order ? order.createdAt.toISOString().slice(0, 10) : undefined}
                          max={todayIso}
                          aria-label={t("confirm.valueDateLabel", { orderNumber: p.order.orderNumber })}
                          className={`${CONTROL_SM} min-w-0 flex-1`}
                        />
                        <Button type="submit" variant="secondary" size="xs" className="shrink-0">
                          <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> {t("confirm.submit")}
                        </Button>
                      </div>
                    </form>
                  );
                }
                if (settlement.kind === "blocked") {
                  return <span className="u-meta text-ink-3">{settlement.reason}</span>;
                }
                return <span className="text-ink-3">—</span>;
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("empty.eyebrow")}
              headline={search || status ? t("empty.headlineFiltered") : t("empty.headline")}
              body={search || status ? t("empty.bodyFiltered") : t("empty.body")}
              action={
                search || status ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/payments">{t("empty.action")}</Link>
                  </Button>
                ) : undefined
              }
              icon={<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(target) => filterHref({ page: String(target), search })}
              summary={t.rich("footer", {
                total: String(total),
                count: total,
                n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
              })}
            />
          }
        />

        <Dateline className="max-w-prose">{t("note")}</Dateline>
      </div>
    </AdminLayout>
  );
}
