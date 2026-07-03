import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminRFQs, RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { FileQuestion, Search, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "RFQ Management" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<RFQStatus, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-slate-100 text-muted-foreground" },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-primary" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-purple-100 text-purple-700" },
  QUOTED: { label: "Quoted", color: "bg-amber-100 text-amber-700" },
  NEGOTIATING: { label: "Negotiating", color: "bg-orange-100 text-orange-700" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700" },
  EXPIRED: { label: "Expired", color: "bg-slate-100 text-muted-foreground" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-muted-foreground" },
};

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

export default async function RFQsPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(RFQStatus).includes(searchParams.status as RFQStatus)
    ? (searchParams.status as RFQStatus)
    : undefined;
  const search = searchParams.search?.trim() || undefined;

  const { rfqs, total, statusCounts } = await getAdminRFQs({ page, limit, status, search });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const countFor = (statuses: RFQStatus[]) =>
    statusCounts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/rfqs?${qs}` : "/rfqs";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">RFQ Management</h1>
            <p className="text-muted-foreground text-sm">Every request-for-quote across the platform, live from the RFQ workflow.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open", value: countFor(["SUBMITTED", "UNDER_REVIEW"]), color: "bg-blue-50 border-blue-200" },
            { label: "Quoted / Negotiating", value: countFor(["QUOTED", "NEGOTIATING"]), color: "bg-amber-50 border-amber-200" },
            { label: "Accepted", value: countFor(["ACCEPTED"]), color: "bg-green-50 border-green-200" },
            { label: "Rejected / Expired", value: countFor(["REJECTED", "EXPIRED"]), color: "bg-white border-border" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([undefined, "SUBMITTED", "UNDER_REVIEW", "QUOTED", "NEGOTIATING", "ACCEPTED", "REJECTED"] as const).map((s) => {
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

        <form method="get" action="/rfqs" className="relative max-w-sm">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by RFQ # or company…"
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["RFQ", "Buyer", "Items", "Assigned Seller", "Quoted Total", "Status", "Required By", "Created"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rfqs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <FileQuestion className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search || status ? "No RFQs match the current filters." : "No RFQs submitted yet."}
                      </p>
                    </td>
                  </tr>
                )}
                {rfqs.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  const itemSummary = r.items
                    .slice(0, 2)
                    .map((i) => `${i.quantity}× ${i.nameEn}`)
                    .join(", ");
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.rfqNumber}</p>
                        {r._count.messages > 0 && (
                          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                            <MessageSquare className="h-3 w-3" /> {r._count.messages} messages
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.company?.nameEn ?? "Individual buyer"}</p>
                        {r.buyer && <p className="text-xs text-muted-foreground">{r.buyer.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <p className="truncate">{itemSummary || "—"}</p>
                        {r.items.length > 2 && <p className="text-[11px]">+{r.items.length - 2} more</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.seller?.businessNameEn ?? "Unassigned"}</td>
                      <td className="px-4 py-3 font-semibold">
                        {r.totalQuoted ? formatCurrency(Number(r.totalQuoted), r.currency as never) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {r.requiredBy ? format(r.requiredBy, "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(r.createdAt, "MMM d, yyyy")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} · {total} RFQs</span>
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
