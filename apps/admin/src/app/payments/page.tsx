import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, getPayments, PaymentStatus, Prisma } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { CreditCard, CheckCircle, Clock, XCircle, RotateCcw, Building2, Smartphone, Search, Beaker, Banknote, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { confirmBankTransfer } from "./actions";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  PAID: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  UNPAID: { label: "Unpaid", color: "bg-amber-100 text-amber-700", icon: Clock },
  PARTIALLY_PAID: { label: "Partially Paid", color: "bg-blue-100 text-primary", icon: Clock },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle },
  REFUNDED: { label: "Refunded", color: "bg-slate-100 text-muted-foreground", icon: RotateCcw },
};

const METHOD_LABEL: Record<string, { label: string; icon: typeof CreditCard }> = {
  BANK_TRANSFER: { label: "Bank Transfer", icon: Building2 },
  CREDIT_CARD: { label: "Card", icon: CreditCard },
  MADA: { label: "mada", icon: CreditCard },
  APPLE_PAY: { label: "Apple Pay", icon: Smartphone },
  STC_PAY: { label: "STC Pay", icon: Smartphone },
  MOCK: { label: "Test (mock)", icon: Beaker },
};

// Mirrors CLOSED_ORDER_STATUSES in packages/database/src/services/payments.ts.
// The service is the authority; this list only decides whether a control is
// worth rendering, so a divergence costs a refused submission, never a wrong write.
const CLOSED_ORDER_STATUSES = new Set(["CANCELLED", "REFUNDED", "RETURNED"]);

const cellField = "rounded-lg border border-border bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30";

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
): Settlement {
  // Gateway payments settle through their signed webhook; there is no
  // legitimate manual confirmation for them, so no control is offered.
  if (payment.method !== "BANK_TRANSFER") return { kind: "none" };
  if (payment.status === "PAID") return { kind: "none" };
  if (payment.status !== "UNPAID") {
    return { kind: "blocked", reason: `A ${STATUS_CONFIG[payment.status].label.toLowerCase()} payment cannot be confirmed` };
  }
  if (!order) return { kind: "blocked", reason: "Order record unavailable" };
  if (order.paymentMethod !== "BANK_TRANSFER") return { kind: "blocked", reason: "Order is not a bank-transfer order" };
  if (CLOSED_ORDER_STATUSES.has(order.status)) {
    return { kind: "blocked", reason: `Order is ${order.status.toLowerCase().replace(/_/g, " ")}` };
  }
  if (order.paymentStatus === "REFUNDED") return { kind: "blocked", reason: "Order has been refunded" };
  // No FX policy exists in this system, so anything that would require
  // converting between currencies is handed back to a human.
  if (payment.currency !== order.currency) {
    return { kind: "blocked", reason: `Payment is in ${payment.currency}, order in ${order.currency}` };
  }
  if (receipts?.currencies.some((currency) => currency !== order.currency)) {
    return { kind: "blocked", reason: "Order holds receipts in more than one currency" };
  }

  const outstanding = order.total.sub(receipts?.total ?? 0);
  if (outstanding.lessThanOrEqualTo(0)) return { kind: "blocked", reason: "Order total is already covered" };
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
      return { tone: "refused" as const, title: "Confirmation refused", detail: searchParams.confirmError };
    }
    if (!searchParams.confirmed) return null;
    const orderNumber = searchParams.confirmed;
    const title =
      searchParams.outcome === "REPLAY"
        ? `Order ${orderNumber}: this credit was already recorded; nothing was changed.`
        : searchParams.outcome === "PAID"
          ? `Order ${orderNumber} is now paid in full.`
          : searchParams.outcome === "PARTIALLY_PAID"
            ? `Order ${orderNumber} is now partially paid; an unpaid instruction for the balance remains open in the ledger.`
            : `Order ${orderNumber}: bank transfer recorded.`;
    const shared = searchParams.sharedRef
      ? `The same bank reference is also recorded against ${searchParams.sharedRef.split(",").length === 1 ? "order" : "orders"} ${searchParams.sharedRef.split(",").join(", ")}. That is expected when one wire settles several orders; if it is one statement line banked twice, it needs correcting.`
      : null;
    return { tone: "ok" as const, title, detail: shared };
  })();

  const tiles = [
    { label: "Collected", statuses: [PaymentStatus.PAID], color: "bg-green-50 border-green-200" },
    { label: "Awaiting settlement", statuses: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID], color: "bg-amber-50 border-amber-200" },
    { label: "Failed", statuses: [PaymentStatus.FAILED], color: "bg-red-50 border-red-200" },
    { label: "Refunded", statuses: [PaymentStatus.REFUNDED], color: "bg-white border-border" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-muted-foreground text-sm">
              Every payment attempt in the ledger. Bank transfers are confirmed here from the bank statement; card, mada,
              Apple&nbsp;Pay and STC&nbsp;Pay settle through their signed gateway webhook and cannot be confirmed by hand.
            </p>
          </div>
        </div>

        {outcome && (
          <div
            role="status"
            className={`rounded-2xl border p-4 text-sm ${outcome.tone === "refused" ? "border-red-200 bg-red-50 text-red-900" : outcome.detail ? "border-amber-200 bg-amber-50 text-slate-800" : "border-green-200 bg-green-50 text-slate-800"}`}
          >
            <p className="font-semibold inline-flex items-center gap-2">
              {outcome.tone === "refused" ? <XCircle className="h-4 w-4" /> : outcome.detail ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              {outcome.title}
            </p>
            {outcome.detail && <p className="text-xs mt-1">{outcome.detail}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((tile) => {
            const ledger = ledgerFor(tile.statuses);
            return (
              <div key={tile.label} className={`rounded-2xl border p-4 ${tile.color}`}>
                <span className="text-sm text-muted-foreground">{tile.label}</span>
                {ledger.amounts.length === 0 ? (
                  <p className="text-xl font-bold mt-1">—</p>
                ) : (
                  ledger.amounts.map(([currency, amount]) => (
                    <p key={currency} className="text-xl font-bold mt-1">
                      {formatCurrency(Number(amount), currency as never)}
                    </p>
                  ))
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{ledger.count} payments</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([undefined, ...Object.values(PaymentStatus)] as const).map((s) => {
            const active = status === s || (!status && !s);
            return (
              <Link
                key={s ?? "all"}
                href={filterHref({ status: s })}
                className={`text-xs px-3 py-1.5 rounded-lg border ${active ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
              >
                {s ? STATUS_CONFIG[s].label : "All"}
              </Link>
            );
          })}
        </div>

        <form method="get" action="/payments" className="relative max-w-sm">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by order # or gateway ref…"
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Order", "Customer", "Method", "Amount", "Status", "Gateway Ref", "Date", "Settlement"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search || status ? "No payments match the current filters." : "No payments recorded yet."}
                      </p>
                    </td>
                  </tr>
                )}
                {payments.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const method = METHOD_LABEL[p.method] ?? { label: p.method, icon: CreditCard };
                  const MethodIcon = method.icon;
                  const StatusIcon = cfg.icon;
                  const order = orderById.get(p.order.id);
                  const settlement = settlementFor(p, order, receiptsByOrder.get(p.order.id));
                  const highlighted = searchParams.payment === p.id;
                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/60 align-top ${highlighted ? "bg-red-50/60" : ""}`}>
                      <td className="px-4 py-3">
                        <Link href={`/orders/${p.order.id}`} className="font-medium text-primary hover:underline">
                          {p.order.orderNumber}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">{p.order.type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.order.user.firstName} {p.order.user.lastName}</p>
                        <p className="text-xs text-muted-foreground">{p.order.user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <MethodIcon className="h-3.5 w-3.5" /> {method.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(p.amount), p.currency as never)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.gatewayRef ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(p.paidAt ?? p.createdAt, "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-3">
                        {settlement.kind === "confirmable" ? (
                          <form action={confirmBankTransfer.bind(null, p.id)} className="flex flex-col gap-1.5 min-w-[240px]">
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <div className="flex gap-1.5">
                              <input
                                name="bankReference"
                                required
                                maxLength={64}
                                placeholder="Bank reference"
                                aria-label={`Bank reference for order ${p.order.orderNumber}`}
                                className={`${cellField} flex-1 min-w-0`}
                              />
                              <input
                                name="amount"
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0.01"
                                max={settlement.outstanding.toFixed(2)}
                                defaultValue={settlement.suggested.toFixed(2)}
                                required
                                aria-label={`Amount credited for order ${p.order.orderNumber}`}
                                className={`${cellField} w-24`}
                              />
                            </div>
                            <div className="flex gap-1.5">
                              {/* A credit cannot predate the order it settles; the service
                                  enforces this, the picker just stops the obvious typo. */}
                              <input
                                name="valueDate"
                                type="date"
                                required
                                min={order ? order.createdAt.toISOString().slice(0, 10) : undefined}
                                max={todayIso}
                                aria-label={`Bank value date for order ${p.order.orderNumber}`}
                                className={`${cellField} flex-1 min-w-0`}
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary/90"
                              >
                                <Banknote className="h-3.5 w-3.5" /> Confirm
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              Outstanding {formatCurrency(Number(settlement.outstanding), p.currency as never)}
                            </p>
                          </form>
                        ) : settlement.kind === "blocked" ? (
                          <span className="text-[11px] text-muted-foreground">{settlement.reason}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} · {total} payments</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={filterHref({ page: String(page - 1), search })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Previous</Link>
                )}
                {page < totalPages && (
                  <Link href={filterHref({ page: String(page + 1), search })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Next</Link>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Confirming a transfer records the bank reference, the amount credited, the value date and the confirming
          administrator against the payment, and derives the order&apos;s payment status from the sum of confirmed
          receipts. A short credit leaves the order partially paid and opens a fresh instruction for the balance.
        </p>
      </div>
    </AdminLayout>
  );
}
