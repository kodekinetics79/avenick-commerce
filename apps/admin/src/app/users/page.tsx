import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminUsers, UserRole, UserStatus } from "@avenick/database";
import { UserStatusActions } from "./user-actions";
import { UserCog, Search, Shield, Store, ShoppingBag, User, Users } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export const metadata = { title: "User Management" };
export const dynamic = "force-dynamic";

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: typeof Shield }> = {
  SUPER_ADMIN: { label: "Super Admin", color: "bg-red-100 text-red-700", icon: Shield },
  ADMIN: { label: "Admin", color: "bg-red-100 text-red-700", icon: Shield },
  SELLER_OWNER: { label: "Seller Owner", color: "bg-orange-100 text-orange-700", icon: Store },
  SELLER_STAFF: { label: "Seller Staff", color: "bg-orange-100 text-orange-700", icon: Store },
  COMPANY_ADMIN: { label: "Company Admin", color: "bg-blue-100 text-primary", icon: ShoppingBag },
  COMPANY_BUYER: { label: "Company Buyer", color: "bg-blue-100 text-primary", icon: ShoppingBag },
  COMPANY_APPROVER: { label: "Company Approver", color: "bg-blue-100 text-primary", icon: ShoppingBag },
  CONSUMER: { label: "Consumer", color: "bg-green-100 text-green-700", icon: User },
};

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-700" },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-600" },
  BANNED: { label: "Banned", color: "bg-slate-100 text-muted-foreground" },
};

const ROLE_FILTERS: Array<{ label: string; value?: UserRole }> = [
  { label: "All" },
  { label: "Admins", value: UserRole.ADMIN },
  { label: "Seller Owners", value: UserRole.SELLER_OWNER },
  { label: "Company Admins", value: UserRole.COMPANY_ADMIN },
  { label: "Consumers", value: UserRole.CONSUMER },
];

interface PageProps {
  searchParams: { role?: string; status?: string; search?: string; page?: string };
}

export default async function UsersPage({ searchParams }: PageProps) {
  const { userId: currentUserId } = await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 20;
  const role = Object.values(UserRole).includes(searchParams.role as UserRole)
    ? (searchParams.role as UserRole)
    : undefined;
  const status = Object.values(UserStatus).includes(searchParams.status as UserStatus)
    ? (searchParams.status as UserStatus)
    : undefined;
  const search = searchParams.search?.trim() || undefined;

  const { users, total, roleCounts } = await getAdminUsers({ page, limit, role, status, search });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const countFor = (roles: UserRole[]) =>
    roleCounts.filter((r) => roles.includes(r.role)).reduce((sum, r) => sum + r._count._all, 0);

  const stats = [
    { label: "Admins", value: countFor([UserRole.SUPER_ADMIN, UserRole.ADMIN]), icon: Shield, color: "text-red-600", bg: "bg-red-50 border-red-200" },
    { label: "Sellers", value: countFor([UserRole.SELLER_OWNER, UserRole.SELLER_STAFF]), icon: Store, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
    { label: "B2B Buyers", value: countFor([UserRole.COMPANY_ADMIN, UserRole.COMPANY_BUYER, UserRole.COMPANY_APPROVER]), icon: ShoppingBag, color: "text-primary", bg: "bg-blue-50 border-blue-200" },
    { label: "Consumers", value: countFor([UserRole.CONSUMER]), icon: User, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  ];

  const filterHref = (params: Record<string, string | undefined>) => {
    const merged = { ...searchParams, page: undefined, ...params };
    const qs = new URLSearchParams(
      Object.entries(merged).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return qs ? `/users?${qs}` : "/users";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-muted-foreground text-sm">
              Manage platform users, roles, and access. Status changes are audit-logged.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`rounded-2xl border p-4 ${stat.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ROLE_FILTERS.map((f) => {
            const active = role === f.value || (!role && !f.value);
            return (
              <Link
                key={f.label}
                href={filterHref({ role: f.value })}
                className={`text-xs px-3 py-1.5 rounded-lg border ${active ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}
              >
                {f.label}
              </Link>
            );
          })}
          <span className="mx-2 h-4 w-px bg-border" />
          {([undefined, "ACTIVE", "SUSPENDED", "PENDING"] as const).map((s) => {
            const active = status === s || (!status && !s);
            return (
              <Link
                key={s ?? "any"}
                href={filterHref({ status: s })}
                className={`text-xs px-3 py-1.5 rounded-lg border ${active ? "bg-slate-800 text-white border-slate-800" : "border-border hover:bg-muted"}`}
              >
                {s ? STATUS_CONFIG[s].label : "Any status"}
              </Link>
            );
          })}
        </div>

        <form method="get" action="/users" className="relative max-w-sm">
          {role && <input type="hidden" name="role" value={role} />}
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by name or email…"
            className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["User", "Role", "Organization", "Status", "Joined", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {search || role || status ? "No users match the current filters." : "No users yet."}
                      </p>
                    </td>
                  </tr>
                )}
                {users.map((u) => {
                  const roleCfg = ROLE_CONFIG[u.role];
                  const statusCfg = STATUS_CONFIG[u.status];
                  const RoleIcon = roleCfg.icon;
                  const org = u.sellerProfile?.businessNameEn ?? u.companyMember?.company.nameEn ?? "—";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <UserCog className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {u.firstName} {u.lastName}
                              {u.id === currentUserId && <span className="ms-1.5 text-[10px] text-muted-foreground">(you)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${roleCfg.color}`}>
                          <RoleIcon className="h-3 w-3" /> {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{org}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(u.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3">
                        <UserStatusActions userId={u.id} status={u.status} isSelf={u.id === currentUserId} />
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
                Page {page} of {totalPages} · {total} users
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
