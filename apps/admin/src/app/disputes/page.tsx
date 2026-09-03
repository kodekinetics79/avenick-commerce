import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminReturns, ReturnStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { ReturnActions } from "./return-actions";
import { Scale, Clock, CheckCircle, XCircle, Truck, PackageCheck, Banknote } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Disputes & Returns" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string; icon: typeof Clock }> = {
  REQUESTED: { label: "Requested", color: "bg-blue-100 text-primary", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-amber-100 text-amber-700", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
  IN_TRANSIT: { label: "In Transit", color: "bg-purple-100 text-purple-700", icon: Truck },
  RECEIVED: { label: "Received", color: "bg-indigo-100 text-indigo-700", icon: PackageCheck },
  REFUNDED: { label: "Refunded", color: "bg-green-100 text-green-700", icon: Banknote },
};

interface PageProps {
  searchParams: { status?: string; page?: string };
}

export default async function DisputesPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(ReturnStatus).includes(searchParams.status as ReturnStatus)
    ? (searchParams.status as ReturnStatus)
    : undefined;

  const { returns, total, statusCounts } = await getAdminReturns({ page, limit, status });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const countFor = (statuses: ReturnStatus[]) =>
    statusCounts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/disputes?${qs}` : "/disputes";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Disputes & Returns</h1>
            <p className="text-muted-foreground text-sm">
              Buyer return requests and their resolution. Approvals, rejections, and refunds are audit-logged.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Awaiting decision", value: countFor(["REQUESTED"]), color: "bg-blue-50 border-blue-200" },
            { label: "In progress", value: countFor(["APPROVED", "IN_TRANSIT", "RECEIVED"]), color: "bg-amber-50 border-amber-200" },
            { label: "Refunded", value: countFor(["REFUNDED"]), color: "bg-green-50 border-green-200" },
            { label: "Rejected", value: countFor(["REJECTED"]), color: "bg-red-50 border-red-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([undefined, ...Object.values(ReturnStatus)] as const).map((s) => {
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
                  {["Return", "Order", "Buyer", "Seller", "Reason", "Refund", "Status", "Opened", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {returns.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Scale className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {status ? "No returns match the current filter." : "No return requests yet."}
                      </p>
                    </td>
                  </tr>
                )}
                {returns.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium">{r.returnNumber}</td>
                      <td className="px-4 py-3">
                        <Link href={`/orders/${r.order.id}`} className="text-primary hover:underline">
                          {r.order.orderNumber}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {formatCurrency(Number(r.order.total), r.order.currency as never)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.order.user.firstName} {r.order.user.lastName}</p>
                        <p className="text-xs text-muted-foreground">{r.order.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.seller.businessNameEn}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[16rem]">
                        <p className="truncate" title={r.reason}>{r.reason}</p>
                        {r.resolution && (
                          <p className="text-[11px] text-muted-foreground/80 truncate" title={r.resolution}>↳ {r.resolution}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {r.refundAmount ? formatCurrency(Number(r.refundAmount), r.order.currency as never) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(r.createdAt, "MMM d, yyyy")}</td>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} · {total} returns</span>
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
