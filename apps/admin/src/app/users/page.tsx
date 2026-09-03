import type { ElementType } from "react";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminUsers, UserRole, UserStatus } from "@avenick/database";
import { UserStatusActions } from "./user-actions";
import { FilterTabs, Pager, ConsoleSearch, queryHref } from "@/components/console/chrome";
import { Shield, Store, ShoppingBag, User, Users } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "User Management" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  SELLER_OWNER: "Seller owner",
  SELLER_STAFF: "Seller staff",
  COMPANY_ADMIN: "Company admin",
  COMPANY_BUYER: "Company buyer",
  COMPANY_APPROVER: "Company approver",
  CONSUMER: "Consumer",
};

/** The four audiences an operator distinguishes, and the roles inside each. */
const ROLE_GROUPS: Array<{ label: string; icon: ElementType; roles: UserRole[]; filter: UserRole }> = [
  { label: "Platform staff", icon: Shield, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN], filter: UserRole.ADMIN },
  { label: "Suppliers", icon: Store, roles: [UserRole.SELLER_OWNER, UserRole.SELLER_STAFF], filter: UserRole.SELLER_OWNER },
  {
    label: "B2B buyers",
    icon: ShoppingBag,
    roles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_BUYER, UserRole.COMPANY_APPROVER],
    filter: UserRole.COMPANY_ADMIN,
  },
  { label: "Consumers", icon: User, roles: [UserRole.CONSUMER], filter: UserRole.CONSUMER },
];

const STATUS_TONE: Record<UserStatus, PillTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "danger",
  BANNED: "neutral",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Active",
  PENDING: "Pending",
  SUSPENDED: "Suspended",
  BANNED: "Banned",
};

interface PageProps {
  searchParams: { role?: string; status?: string; search?: string; page?: string };
}

type AdminUser = Awaited<ReturnType<typeof getAdminUsers>>["users"][number];

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
  const allRoles = roleCounts.reduce((sum, r) => sum + r._count._all, 0);
  const href = (next: Record<string, string | undefined>) => queryHref("/users", searchParams, next);
  const filtered = Boolean(search || role || status);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Settings"
          title="Users and access"
          description="Platform identities, their role and their access. Every status change is written to the audit stream."
          dateline="Counts in the band below are of the whole register by role; the table shows one page of it. Erased subjects are excluded everywhere."
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          {ROLE_GROUPS.map((group) => (
            <Stat
              key={group.label}
              label={group.label}
              value={countFor(group.roles)}
              icon={group.icon}
              href={href({ role: group.filter })}
              linkComponent={Link}
            />
          ))}
        </CellGrid>

        <div className="flex flex-wrap items-start gap-3">
          <FilterTabs
            label="Filter users by role"
            tabs={[
              { href: href({ role: undefined }), label: "All roles", count: allRoles, active: !role },
              ...ROLE_GROUPS.map((g) => ({
                href: href({ role: g.filter }),
                // The count is of the GROUP, but the filter is one role inside
                // it — so the count is deliberately omitted rather than shown
                // next to a filter that will not return it. A number a reader
                // can falsify by clicking it is worse than no number.
                label: ROLE_LABEL[g.filter],
                active: role === g.filter,
              })),
            ]}
          />
          <FilterTabs
            label="Filter users by status"
            tabs={[
              { href: href({ status: undefined }), label: "Any status", active: !status },
              ...([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING] as const).map((s) => ({
                href: href({ status: s }),
                label: STATUS_LABEL[s],
                active: status === s,
              })),
            ]}
          />
          <ConsoleSearch
            className="ms-auto"
            action="/users"
            label="Search users by name or email"
            placeholder="Name or email…"
            defaultValue={search}
            preserve={{ role, status }}
            clearHref={href({ search: undefined })}
          />
        </div>

        <LedgerTable<AdminUser>
          rows={users}
          getRowKey={(u) => u.id}
          stickyHead
          columns={[
            {
              key: "user",
              label: "User",
              render: (u) => (
                <>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium text-ink-1">
                      {`${u.firstName} ${u.lastName}`.trim() || u.email}
                    </span>
                    {/* Marking the operator's own row is what stops somebody
                        suspending themselves out of the console. */}
                    {u.id === currentUserId && <StatusPill>You</StatusPill>}
                  </span>
                  <span className="u-meta block truncate text-ink-3">{u.email}</span>
                </>
              ),
            },
            {
              key: "role",
              label: "Role",
              width: "152px",
              render: (u) => <span className="u-meta text-ink-2">{ROLE_LABEL[u.role]}</span>,
            },
            {
              key: "org",
              label: "Organisation",
              hideOnMobile: true,
              render: (u) => {
                const org = u.sellerProfile?.businessNameEn ?? u.companyMember?.company.nameEn;
                return org ? (
                  <span className="block truncate text-ink-2">{org}</span>
                ) : (
                  <span className="u-meta text-ink-3">Not attached to one</span>
                );
              },
            },
            {
              key: "status",
              label: "Status",
              width: "120px",
              render: (u) => (
                <StatusPill tone={STATUS_TONE[u.status]} dot={u.status !== "ACTIVE"}>
                  {STATUS_LABEL[u.status]}
                </StatusPill>
              ),
            },
            {
              key: "joined",
              label: "Joined",
              hideOnMobile: true,
              width: "104px",
              render: (u) => <span className="tnum text-ink-2">{format(u.createdAt, "d MMM yyyy")}</span>,
            },
            {
              key: "decision",
              label: "Access",
              align: "end",
              width: "184px",
              render: (u) => (
                <UserStatusActions
                  userId={u.id}
                  name={`${u.firstName} ${u.lastName}`.trim() || u.email}
                  status={u.status}
                  isSelf={u.id === currentUserId}
                />
              ),
            },
          ]}
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(p) => href({ page: String(p), search, role, status })}
              summary={`${total.toLocaleString()} ${total === 1 ? "user" : "users"}${filtered ? " match these filters" : " registered"}`}
            />
          }
          empty={
            filtered ? (
              <EmptyState
                eyebrow="No match"
                headline="No user matches the filters currently applied."
                body="Clearing the search, the role or the status filter returns the full register."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/users">Clear the filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="certificate"
                glyph={<Users />}
                eyebrow="Nothing registered"
                headline="No user account exists on the platform yet."
                body="An account appears here the moment anyone registers, whether as a consumer, a supplier or a member of a buyer company."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/audit">Open the audit trail</Link>
                  </Button>
                }
              />
            )
          }
        />
      </div>
    </AdminLayout>
  );
}
