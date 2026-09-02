import { requireSellerPermission } from "@/lib/auth";
import { db } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency, type SupportedCurrency } from "@avenick/utils";
import { format } from "date-fns";
import { DollarSign } from "lucide-react";

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
  const money = (n: number, currency: string) => formatCurrency(n, currency as SupportedCurrency);
  const lines = (totals: Totals, empty: string) =>
    currencies.length === 0 ? (
      <p className="text-2xl font-bold mt-1">{empty}</p>
    ) : (
      <div className="mt-1 space-y-0.5">
        {currencies.map((c) => (
          <p key={c} className="text-xl font-bold leading-tight">{money(totals[c] ?? 0, c)}</p>
        ))}
      </div>
    );

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Payouts — المدفوعات</h1>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Pending Payout</p>
            <div className="text-orange-600 dark:text-orange-400">{lines(pendingByCurrency, "—")}</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">Total Paid Out</p>
            <div className="text-green-600 dark:text-green-400">{lines(paidByCurrency, "—")}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Commission Rate</p>
            <p className="text-2xl font-bold mt-1">{Number(seller.commissionRate)}%</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">Refund receivable</p>
            <div className="text-red-600 dark:text-red-400">{lines(receivableByCurrency, "—")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {openAdjustments} open adjustment{openAdjustments === 1 ? "" : "s"}
              {currencies.length > 0 && (
                <>
                  ; net position{" "}
                  {currencies.map((c, i) => (
                    <span key={c}>{i > 0 ? " · " : ""}{money((pendingByCurrency[c] ?? 0) - (receivableByCurrency[c] ?? 0), c)}</span>
                  ))}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Period</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Gross</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Commission</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Net</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Reference</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => {
                  const gross = p.items.reduce((s, i) => s + Number(i.amount), 0);
                  const comm = p.items.reduce((s, i) => s + Number(i.commission), 0);
                  const net = p.items.reduce((s, i) => s + Number(i.net), 0);
                  return (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-sm">{format(p.periodFrom, "MMM d")} – {format(p.periodTo, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">{formatCurrency(gross || Number(p.amount), p.currency)}</td>
                      <td className="px-4 py-3 text-red-600 dark:text-red-400">-{formatCurrency(comm, p.currency)}</td>
                      <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{formatCurrency(net || Number(p.amount), p.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status === "PAID" ? "bg-green-500/10 text-green-600 dark:text-green-400" : p.status === "PENDING" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{p.processedAt ? format(p.processedAt, "MMM d, yyyy") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payouts.length === 0 && (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No payouts yet</p>
                <p className="text-sm">Payouts are issued as your orders settle.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
