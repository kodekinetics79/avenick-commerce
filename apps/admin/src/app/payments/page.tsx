import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getPayments, PaymentStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { CreditCard, CheckCircle, Clock, XCircle, RotateCcw, Building2, Smartphone, Search, Beaker } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

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

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(PaymentStatus).includes(searchParams.status as PaymentStatus)
    ? (searchParams.status as PaymentStatus)
    : undefined;
  const search = searchParams.search?.trim() || undefined;

  const { payments, total, statusCounts } = await getPayments({ page, limit, status, search });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const sumFor = (s: PaymentStatus) => Number(statusCounts.find((c) => c.status === s)?._sum.amount ?? 0);
  const countFor = (s: PaymentStatus) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/payments?${qs}` : "/payments";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-muted-foreground text-sm">Gateway transactions across all orders, straight from the ledger.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Collected", value: formatCurrency(sumFor(PaymentStatus.PAID), "AED"), sub: `${countFor(PaymentStatus.PAID)} payments`, color: "bg-green-50 border-green-200" },
            { label: "Pending", value: formatCurrency(sumFor(PaymentStatus.UNPAID) + sumFor(PaymentStatus.PARTIALLY_PAID), "AED"), sub: `${countFor(PaymentStatus.UNPAID) + countFor(PaymentStatus.PARTIALLY_PAID)} payments`, color: "bg-amber-50 border-amber-200" },
            { label: "Failed", value: formatCurrency(sumFor(PaymentStatus.FAILED), "AED"), sub: `${countFor(PaymentStatus.FAILED)} payments`, color: "bg-red-50 border-red-200" },
            { label: "Refunded", value: formatCurrency(sumFor(PaymentStatus.REFUNDED), "AED"), sub: `${countFor(PaymentStatus.REFUNDED)} payments`, color: "bg-white border-border" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-xl font-bold mt-1">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
            </div>
          ))}
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
                  {["Order", "Customer", "Method", "Amount", "Status", "Gateway Ref", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
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
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
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
      </div>
    </AdminLayout>
  );
}
