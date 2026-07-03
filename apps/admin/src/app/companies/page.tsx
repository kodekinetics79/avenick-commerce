import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminCompanies, CompanyStatus } from "@avenick/database";
import { CompanyStatusActions } from "./company-actions";
import { Building2, Users, Search, ShoppingCart, FileText } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "B2B Companies" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<CompanyStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-700" },
  PENDING_VERIFICATION: { label: "Pending Verification", color: "bg-amber-100 text-amber-700" },
};

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 20;
  const status = Object.values(CompanyStatus).includes(searchParams.status as CompanyStatus)
    ? (searchParams.status as CompanyStatus)
    : undefined;
  const search = searchParams.search?.trim() || undefined;

  const { companies, total, statusCounts } = await getAdminCompanies({ page, limit, status, search });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const countFor = (s: CompanyStatus) =>
    statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/companies?${qs}` : "/companies";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">B2B Companies</h1>
            <p className="text-muted-foreground text-sm">
              Verify, activate, and suspend buyer organizations. Status changes are audit-logged.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total companies", value: statusCounts.reduce((s, c) => s + c._count._all, 0), color: "bg-white border-border" },
            { label: "Active", value: countFor(CompanyStatus.ACTIVE), color: "bg-green-50 border-green-200" },
            { label: "Pending verification", value: countFor(CompanyStatus.PENDING_VERIFICATION), color: "bg-amber-50 border-amber-200" },
            { label: "Suspended", value: countFor(CompanyStatus.SUSPENDED), color: "bg-red-50 border-red-200" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.color}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([undefined, ...Object.values(CompanyStatus)] as const).map((s) => {
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

        <form method="get" action="/companies" className="relative max-w-sm">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by name or CR number…"
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Company", "CR / VAT", "Location", "Members", "Orders", "Credit", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Building2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search || status
                          ? "No companies match the current filters."
                          : "No B2B companies registered yet."}
                      </p>
                    </td>
                  </tr>
                )}
                {companies.map((c) => {
                  const statusCfg = STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium">{c.nameEn}</p>
                            {c.nameAr && <p className="text-xs text-muted-foreground">{c.nameAr}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <p className="font-mono text-xs">{c.crNumber ?? "—"}</p>
                        {c.vatNumber && <p className="font-mono text-[11px] text-muted-foreground/70">{c.vatNumber}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.city}, {c.country}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" /> {c._count.members}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <ShoppingCart className="h-3.5 w-3.5" /> {c._count.orders}
                        </span>
                        {c._count.rfqRequests > 0 && (
                          <span className="ms-2 inline-flex items-center gap-1 text-muted-foreground text-xs">
                            <FileText className="h-3 w-3" /> {c._count.rfqRequests} RFQs
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.creditLimit ? `${Number(c.creditLimit).toLocaleString()} · ${c.paymentTerms}d terms` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(c.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <CompanyStatusActions companyId={c.id} status={c.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {total} companies
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={filterHref({ page: String(page - 1), search })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={filterHref({ page: String(page + 1), search })} className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs">
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
