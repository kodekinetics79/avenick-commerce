import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSettlementBoard, Prisma, PayoutStatus, type Currency } from "@avenick/database";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { generatePayoutsForPeriod, markPayoutPaid, startPayoutProcessing } from "./actions";
import { Receipt, ArrowLeft, CheckCircle, Clock, RefreshCw, XCircle, Store, AlertTriangle, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Settlements" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<PayoutStatus, { label: string; color: string; icon: typeof CheckCircle; card: string }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700", icon: Clock, card: "bg-amber-50 border-amber-200" },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-primary", icon: RefreshCw, card: "bg-blue-50 border-blue-200" },
  PAID: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle, card: "bg-green-50 border-green-200" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle, card: "bg-red-50 border-red-200" },
};

const CARD_LABEL: Record<PayoutStatus, string> = {
  PENDING: "Awaiting settlement",
  PROCESSING: "In transfer",
  PAID: "Settled",
  FAILED: "Failed",
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
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/finance" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Finance
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Settlements</span>
            </div>
            <h1 className="text-2xl font-bold">Supplier Settlements</h1>
            <p className="text-sm text-muted-foreground">
              Payouts to sellers net of commission. Generating a run and every status change are audit-logged.
            </p>
          </div>
        </div>

        {ran && (
          <div className={`rounded-2xl border p-4 text-sm text-slate-800 ${failed > 0 ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"}`}>
            <p className="font-semibold">
              {generated > 0
                ? `Settlement run created ${generated} payout${generated === 1 ? "" : "s"}.`
                : "Settlement run created no payouts."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {counter(searchParams.sellers)} seller{counter(searchParams.sellers) === 1 ? "" : "s"} examined ·{" "}
              {counter(searchParams.claimed)} had no unclaimed accrual left in that window
              {unpayable > 0 ? ` · ${unpayable} had nothing payable (claimable orders refunded in full)` : ""}
              {heldSellers > 0 ? ` · ${heldSellers} held (closed seller account)` : ""}
              {heldAccruals > 0 ? ` · ${heldAccruals} accrual${heldAccruals === 1 ? "" : "s"} held because the order is cancelled or unpaid` : ""}.
              {generated > 0 ? " New payouts are PENDING until you record the transfer below." : ""}
            </p>
            {failed > 0 && (
              <div className="mt-2 text-xs text-red-700">
                <p className="font-semibold">
                  {failed} seller{failed === 1 ? "" : "s"} refused: the ledger did not reconcile, so nothing was written for them.
                </p>
                <ul className="mt-1 list-disc ps-4 space-y-0.5">
                  {refusals.map((line, index) => <li key={index}>{line}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.values(PayoutStatus).map((s) => {
            const lines = linesFor(s);
            return (
              <div key={s} className={`rounded-2xl border p-4 ${STATUS_CONFIG[s].card}`}>
                <span className="text-sm text-muted-foreground">{CARD_LABEL[s]}</span>
                {lines.length === 0 ? (
                  <p className="text-xl font-bold mt-1 text-muted-foreground">—</p>
                ) : (
                  lines.map((line) => (
                    <p key={line.currency} className="text-xl font-bold mt-1">
                      {money(line._sum.amount ?? ZERO, line.currency)}
                    </p>
                  ))
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{countFor(s)} payouts</p>
              </div>
            );
          })}
        </div>

        {/* Generate. The control only exists when there is accrual it can turn
            into money — a period picker that provably produces nothing would be
            a button that looks like it works. */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1">
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Generate payouts</h2>
          </div>
          {claimable.byCurrency.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              No commission is awaiting settlement. Commission accrues when an order containing a seller&apos;s items is
              paid; each accrual can be claimed into exactly one payout, and everything accrued so far already has been.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mt-1">
                Unsettled commission is grouped by seller and currency: one payout per pair, one line per order, gross
                less commission. Refunds already completed on an order are deducted from its line and their open
                receivable is marked applied. Re-running a period cannot pay the same order twice.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {claimable.byCurrency.map((row) => (
                  <div key={row.currency} className="rounded-xl border border-border p-3">
                    <p className="text-lg font-bold">{money(row.amount, row.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      commission accrued on {row.orders} order{row.orders === 1 ? "" : "s"} across {row.sellers} seller
                      {row.sellers === 1 ? "" : "s"}, oldest {format(row.earliestAt, "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>

              <form action={generatePayoutsForPeriod} className="mt-4 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Accrued from (UTC)
                  <input
                    type="date"
                    name="periodFrom"
                    required
                    max={today}
                    defaultValue={defaultFrom}
                    className="h-10 rounded-xl border border-border px-3 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  to (UTC, inclusive)
                  <input
                    type="date"
                    name="periodTo"
                    required
                    max={today}
                    defaultValue={today}
                    className="h-10 rounded-xl border border-border px-3 text-sm text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                  Seller
                  <select
                    name="sellerId"
                    defaultValue=""
                    className="h-10 rounded-xl border border-border px-3 text-sm text-foreground"
                  >
                    <option value="">All sellers with unsettled commission</option>
                    {claimableSellers.map((row) => (
                      <option key={row.sellerId} value={row.sellerId}>{row.sellerName}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 px-4 text-sm font-semibold text-white transition-colors"
                >
                  Generate payouts
                </button>
              </form>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {["Seller", "Currency", "Orders", "Commission awaiting settlement"].map((h) => (
                        <th key={h} className="px-3 py-2 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {claimable.bySeller.map((row) => (
                      <tr key={`${row.sellerId}:${row.currency}`}>
                        <td className="px-3 py-2">{row.sellerName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.currency}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.orders}</td>
                        <td className="px-3 py-2 font-medium">{money(row.amount, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {claimable.truncated && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing the largest {claimable.bySeller.length} seller/currency positions. A run with no seller
                    selected settles every seller, including those not listed here.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([undefined, ...Object.values(PayoutStatus)] as const).map((s) => {
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

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Seller", "Period", "Orders", "Payout total", "Status", "Reference", "Created", "Record settlement"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {status
                          ? "No payouts match the current filter."
                          : claimable.byCurrency.length > 0
                            ? "No payouts have been generated yet. The commission above is awaiting a settlement run."
                            : "No payouts have been generated, and no commission is awaiting settlement."}
                      </p>
                    </td>
                  </tr>
                )}
                {payouts.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const StatusIcon = cfg.icon;
                  // Totals are aggregated over every line; p.items is a preview.
                  const { gross, commission, net: lineNet } = p.lineTotals;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 align-top">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center">
                            <Store className="h-3.5 w-3.5 text-orange-600" />
                          </span>
                          <span className="font-medium">{p.seller.businessNameEn}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(p.periodFrom, "MMM d")} – {format(p.periodTo, "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <details className="max-w-[22rem]">
                          <summary className="cursor-pointer select-none">
                            {p._count.items} order{p._count.items === 1 ? "" : "s"}
                          </summary>
                          <table className="mt-2 w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="py-1 text-start font-medium">Order</th>
                                <th className="py-1 text-end font-medium">Gross</th>
                                <th className="py-1 text-end font-medium">Commission</th>
                                <th className="py-1 text-end font-medium">Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-1 font-mono">{item.order.orderNumber}</td>
                                  <td className="py-1 text-end">{money(item.amount, p.currency)}</td>
                                  <td className="py-1 text-end text-red-600">-{money(item.commission, p.currency)}</td>
                                  <td className="py-1 text-end font-medium">{money(item.net, p.currency)}</td>
                                </tr>
                              ))}
                              <tr className="border-t border-border font-semibold">
                                <td className="py-1">Total</td>
                                <td className="py-1 text-end">{money(gross, p.currency)}</td>
                                <td className="py-1 text-end text-red-600">-{money(commission, p.currency)}</td>
                                <td className="py-1 text-end">{money(lineNet, p.currency)}</td>
                              </tr>
                            </tbody>
                          </table>
                          {p._count.items > p.items.length && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              First {p.items.length} of {p._count.items} lines shown; the totals cover every line.
                            </p>
                          )}
                          {p.notes && <p className="mt-2 text-[11px] text-muted-foreground">{p.notes}</p>}
                        </details>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {money(p.amount, p.currency)}
                        {/* Refund netting decrements the payout and its lines
                            together, so these agree unless something wrote one
                            without the other. Say so rather than pick one. */}
                        {!lineNet.equals(p.amount) && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-600">
                            <AlertTriangle className="h-3 w-3" /> lines total {money(lineNet, p.currency)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" /> {cfg.label}
                        </span>
                        {p.processedAt && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{format(p.processedAt, "MMM d, yyyy")}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(p.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        {p.status === "PAID" ? (
                          <span className="text-xs text-muted-foreground">Settled</span>
                        ) : p.status === "FAILED" ? (
                          // The only transition out of FAILED is back to PROCESSING
                          // (finance.setPayoutStatus); a Paid control here would always error.
                          <form action={startPayoutProcessing.bind(null, p.id)}>
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 text-primary hover:bg-blue-50 transition-colors"
                            >
                              <RefreshCw className="h-3.5 w-3.5" /> Retry transfer
                            </button>
                          </form>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {p.status === "PENDING" && (
                              <form action={startPayoutProcessing.bind(null, p.id)}>
                                <button
                                  type="submit"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 text-primary hover:bg-blue-50 transition-colors"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" /> Mark in transfer
                                </button>
                              </form>
                            )}
                            <form action={markPayoutPaid.bind(null, p.id)} className="flex items-center gap-1.5">
                              <input
                                name="reference"
                                required
                                maxLength={120}
                                placeholder="Bank reference"
                                className="h-8 w-32 rounded-lg border border-border px-2 text-xs"
                              />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                                title="Records the transfer and settles the commission on this payout's orders. This cannot be undone."
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Paid
                              </button>
                            </form>
                          </div>
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
              <span className="text-muted-foreground">Page {page} of {totalPages} · {total} payouts</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={filterHref({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Previous</Link>
                )}
                {page < totalPages && (
                  <Link href={filterHref({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">Next</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
