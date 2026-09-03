import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ReturnStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { ReturnActions } from "../disputes/return-actions";
import { RotateCcw, Clock, CheckCircle, XCircle, Truck, PackageCheck, Banknote } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Returns" };
export const dynamic = "force-dynamic";

const STATUS: Record<ReturnStatus, { label: string; cls: string; icon: typeof Clock }> = {
  REQUESTED:  { label: "Awaiting decision", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: Clock },
  APPROVED:   { label: "Approved",          cls: "bg-primary/15 text-primary",                          icon: CheckCircle },
  IN_TRANSIT: { label: "In transit",        cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400", icon: Truck },
  RECEIVED:   { label: "Received",          cls: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",     icon: PackageCheck },
  REFUNDED:   { label: "Refunded",          cls: "bg-green-500/15 text-green-700 dark:text-green-400",  icon: Banknote },
  REJECTED:   { label: "Rejected",          cls: "bg-red-500/15 text-red-700 dark:text-red-400",        icon: XCircle },
};

const PAGE_SIZE = 100;

export default async function ReturnsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();

  const status = Object.values(ReturnStatus).includes(searchParams.status as ReturnStatus)
    ? (searchParams.status as ReturnStatus)
    : undefined;
  const where = status ? { status } : {};

  const [returns, statusCounts, refundedSum, refundedCurrencies] = await Promise.all([
    db.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        seller: { select: { businessNameEn: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            company: { select: { nameEn: true } },
          },
        },
        items: { select: { id: true, quantity: true, orderItem: { select: { nameEn: true } } } },
      },
    }),
    // Tiles and tab counts describe the whole marketplace, not the filtered page.
    db.returnRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.returnRequest.aggregate({ where: { status: ReturnStatus.REFUNDED }, _sum: { refundAmount: true } }),
    // Refund value only means something inside a single currency, and orders may
    // be placed in any GCC currency — so establish which currencies are actually
    // represented before showing a total.
    db.order.groupBy({ by: ["currency"], where: { returnRequests: { some: { status: ReturnStatus.REFUNDED } } }, _count: { _all: true } }),
  ]);

  const countFor = (statuses: ReturnStatus[]) =>
    statusCounts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count._all, 0);

  const totalRequests = statusCounts.reduce((sum, c) => sum + c._count._all, 0);
  const awaiting = countFor([ReturnStatus.REQUESTED]);
  const inProgress = countFor([ReturnStatus.APPROVED, ReturnStatus.IN_TRANSIT, ReturnStatus.RECEIVED]);

  // One currency: report the real total. Several: report how many refunds there
  // were rather than adding AED to KWD and calling the result money.
  const refundValue =
    refundedCurrencies.length === 0
      ? "None yet"
      : refundedCurrencies.length === 1
        ? formatCurrency(Number(refundedSum._sum.refundAmount ?? 0), refundedCurrencies[0]!.currency)
        : `${countFor([ReturnStatus.REFUNDED])} refunds`;
  const refundValueLabel = refundedCurrencies.length > 1 ? "Refunded (mixed currencies)" : "Refunded value";

  const tabs: Array<{ value?: ReturnStatus; label: string; count: number }> = [
    { value: undefined, label: "All", count: totalRequests },
    ...Object.values(ReturnStatus).map((s) => ({ value: s, label: STATUS[s].label, count: countFor([s]) })),
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns &amp; Refunds</h1>
          <p className="text-sm text-muted-foreground">
            Buyer return requests across every seller. Approvals, rejections and refunds are audit-logged.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Awaiting decision", value: awaiting, color: awaiting > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground", bg: awaiting > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-card border-border" },
            { label: "In progress", value: inProgress, color: "text-foreground", bg: "bg-card border-border" },
            { label: refundValueLabel, value: refundValue, color: "text-green-700 dark:text-green-400", bg: "bg-card border-border" },
            { label: "Total requests", value: totalRequests, color: "text-foreground", bg: "bg-card border-border" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit max-w-full overflow-x-auto">
          {tabs.map((t) => (
            <Link
              key={t.value ?? "all"}
              href={t.value ? `/returns?status=${t.value}` : "/returns"}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${status === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              {t.label} <span className="opacity-70">({t.count})</span>
            </Link>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          {returns.length === 0 ? (
            <div className="p-12 text-center">
              <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold">{status ? "No returns match this filter" : "No return requests yet"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {status
                  ? "Try another status tab."
                  : "Buyer return requests appear here as soon as one is opened against a delivered order."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 border-b border-border">
                  <tr>{["Return #", "Order", "Buyer", "Seller", "Items", "Reason", "Amount", "Status", "Requested", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {returns.map((r) => {
                    const sc = STATUS[r.status];
                    const StatusIcon = sc.icon;
                    const buyer = r.order.company?.nameEn ?? `${r.order.user.firstName} ${r.order.user.lastName}`.trim();
                    const [firstItem, ...otherItems] = r.items;
                    const itemTitle = r.items.map((i) => `${i.orderItem.nameEn} × ${i.quantity}`).join("\n");
                    return (
                      <tr key={r.id} className={`hover:bg-secondary/40 transition-colors ${r.status === ReturnStatus.REQUESTED ? "bg-amber-500/5" : ""}`}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">{r.returnNumber}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Link href={`/orders/${r.order.id}`} className="font-mono text-xs text-primary hover:underline">{r.order.orderNumber}</Link>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p className="font-medium truncate" title={buyer}>{buyer}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.order.user.email}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={r.seller.businessNameEn}>{r.seller.businessNameEn}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {firstItem ? (
                            <>
                              <p className="truncate" title={itemTitle}>{firstItem.orderItem.nameEn} × {firstItem.quantity}</p>
                              {otherItems.length > 0 && (
                                <p className="text-xs text-muted-foreground">+{otherItems.length} more line{otherItems.length !== 1 ? "s" : ""}</p>
                              )}
                            </>
                          ) : (
                            // Legacy/admin-opened returns predate line selection; there is
                            // nothing itemised to show and nothing to infer.
                            <span className="text-xs text-muted-foreground">Not itemised</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[220px]">
                          <p className="truncate" title={r.reason}>{r.reason}</p>
                          {r.resolution && <p className="text-xs text-muted-foreground/80 truncate" title={r.resolution}>↳ {r.resolution}</p>}
                        </td>
                        <td className="px-4 py-3 font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                          {r.refundAmount
                            ? formatCurrency(Number(r.refundAmount), r.order.currency)
                            : <span className="font-normal text-muted-foreground" title="No authorised refund amount is recorded on this request.">Not set</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${sc.cls}`}>
                            <StatusIcon className="h-3 w-3" /> {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{format(r.createdAt, "MMM d, yyyy")}</td>
                        <td className="px-4 py-3">
                          <ReturnActions
                            returnId={r.id}
                            status={r.status}
                            orderTotal={Number(r.refundAmount ?? r.order.total)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {returns.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-secondary/30 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {returns.length} of {status ? countFor([status]) : totalRequests} return{(status ? countFor([status]) : totalRequests) !== 1 ? "s" : ""}
                {status ? ` with status ${STATUS[status].label.toLowerCase()}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">Newest first, latest {PAGE_SIZE} shown</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
