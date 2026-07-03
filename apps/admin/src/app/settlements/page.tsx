import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getPayouts, PayoutStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { PayoutActions } from "./payout-actions";
import { Receipt, ArrowLeft, CheckCircle, Clock, RefreshCw, XCircle, Store } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Settlements" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<PayoutStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700", icon: Clock },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-primary", icon: RefreshCw },
  PAID: { label: "Paid", color: "bg-green-100 text-green-700", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle },
};

interface PageProps {
  searchParams: { status?: string; page?: string };
}

export default async function SettlementsPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(PayoutStatus).includes(searchParams.status as PayoutStatus)
    ? (searchParams.status as PayoutStatus)
    : undefined;

  const { payouts, total, statusCounts } = await getPayouts({ page, limit, status });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const sumFor = (s: PayoutStatus) => Number(statusCounts.find((c) => c.status === s)?._sum.amount ?? 0);
  const countFor = (s: PayoutStatus) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/settlements?${qs}` : "/settlements";
  };

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
            <p className="text-sm text-muted-foreground">Payouts to sellers net of commission. Status changes are audit-logged.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Awaiting settlement", value: formatCurrency(sumFor(PayoutStatus.PENDING), "AED"), sub: `${countFor(PayoutStatus.PENDING)} payouts`, color: "bg-amber-50 border-amber-200" },
            { label: "In transfer", value: formatCurrency(sumFor(PayoutStatus.PROCESSING), "AED"), sub: `${countFor(PayoutStatus.PROCESSING)} payouts`, color: "bg-blue-50 border-blue-200" },
            { label: "Settled", value: formatCurrency(sumFor(PayoutStatus.PAID), "AED"), sub: `${countFor(PayoutStatus.PAID)} payouts`, color: "bg-green-50 border-green-200" },
            { label: "Failed", value: formatCurrency(sumFor(PayoutStatus.FAILED), "AED"), sub: `${countFor(PayoutStatus.FAILED)} payouts`, color: "bg-red-50 border-red-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-xl font-bold mt-1">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
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
                  {["Seller", "Period", "Orders", "Amount", "Status", "Reference", "Created", "Actions"].map((h) => (
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
                        {status ? "No payouts match the current filter." : "No payouts have been generated yet."}
                      </p>
                    </td>
                  </tr>
                )}
                {payouts.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
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
                      <td className="px-4 py-3 text-muted-foreground">{p._count.items}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(Number(p.amount), p.currency as never)}</td>
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
                        <PayoutActions payoutId={p.id} status={p.status} />
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
