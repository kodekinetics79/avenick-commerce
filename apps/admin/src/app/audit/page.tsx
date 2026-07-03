import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAuditLogs, getAuditEntityTypes, AuditAction } from "@avenick/database";
import { ScrollText, Search, Shield, User, DollarSign, Package, Building2, FileText } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "Audit Trail" };
export const dynamic = "force-dynamic";

const ENTITY_CONFIG: Record<string, { color: string; icon: typeof Shield }> = {
  User: { color: "bg-blue-100 text-primary", icon: User },
  Company: { color: "bg-indigo-100 text-indigo-700", icon: Building2 },
  SellerProfile: { color: "bg-orange-100 text-orange-700", icon: Package },
  Product: { color: "bg-cyan-100 text-cyan-700", icon: Package },
  Order: { color: "bg-green-100 text-green-700", icon: DollarSign },
  default: { color: "bg-slate-100 text-muted-foreground", icon: FileText },
};

const ACTION_COLOR: Record<string, string> = {
  APPROVE: "text-green-600",
  ACTIVATE: "text-green-600",
  CREATE: "text-purple-600",
  UPDATE: "text-primary",
  STATUS_CHANGE: "text-primary",
  PRICE_CHANGE: "text-amber-600",
  REJECT: "text-red-600",
  SUSPEND: "text-red-600",
  DELETE: "text-red-600",
  LOGIN: "text-muted-foreground",
  LOGOUT: "text-muted-foreground",
};

interface PageProps {
  searchParams: { entityType?: string; action?: string; search?: string; page?: string };
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 50;
  const action = Object.values(AuditAction).includes(searchParams.action as AuditAction)
    ? (searchParams.action as AuditAction)
    : undefined;
  const entityType = searchParams.entityType?.trim() || undefined;
  const search = searchParams.search?.trim() || undefined;

  const [{ logs, total }, entityTypes] = await Promise.all([
    getAuditLogs({ page, limit, entityType, action, search }),
    getAuditEntityTypes(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/audit?${qs}` : "/audit";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit Trail</h1>
            <p className="text-muted-foreground text-sm">
              Immutable log of administrative and system actions, sourced from the audit database.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total events", value: total },
            { label: "Entity types", value: entityTypes.length },
            { label: "Actions tracked", value: Object.keys(AuditAction).length },
            { label: "Page", value: `${page} / ${totalPages}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-white p-4">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={filterHref({ entityType: undefined })}
            className={`text-xs px-3 py-1.5 rounded-lg border ${!entityType ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
          >
            All
          </Link>
          {entityTypes.map((t) => (
            <Link
              key={t}
              href={filterHref({ entityType: t })}
              className={`text-xs px-3 py-1.5 rounded-lg border ${entityType === t ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
            >
              {t}
            </Link>
          ))}
        </div>

        <form method="get" action="/audit" className="relative max-w-sm">
          {entityType && <input type="hidden" name="entityType" value={entityType} />}
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by entity id or actor email…"
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Time", "Actor", "Action", "Entity", "Details"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <ScrollText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search || entityType || action
                          ? "No audit events match the current filters."
                          : "No audit events recorded yet. Administrative actions will appear here."}
                      </p>
                    </td>
                  </tr>
                )}
                {logs.map((log) => {
                  const cfg = ENTITY_CONFIG[log.entityType] ?? ENTITY_CONFIG["default"]!;
                  const Icon = cfg.icon;
                  const after = (log.after ?? {}) as Record<string, unknown>;
                  const before = (log.before ?? {}) as Record<string, unknown>;
                  const detail =
                    typeof after["reason"] === "string"
                      ? String(after["reason"])
                      : before["status"] && after["status"]
                        ? `${before["status"]} → ${after["status"]}`
                        : after["status"]
                          ? `→ ${after["status"]}`
                          : "—";
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {format(log.createdAt, "MMM d, yyyy HH:mm:ss")}
                      </td>
                      <td className="px-4 py-3">
                        {log.actor ? (
                          <div>
                            <p className="font-medium">
                              {log.actor.firstName} {log.actor.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{log.actor.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 font-semibold text-xs ${ACTION_COLOR[log.action] ?? "text-foreground"}`}>
                        {log.action.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                          <Icon className="h-3 w-3" /> {log.entityType}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{log.entityId}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {total} events
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
