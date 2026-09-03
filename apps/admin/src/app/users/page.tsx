import type { ElementType } from "react";
import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminUsers, UserRole, UserStatus } from "@avenick/database";
import { UserStatusActions } from "./user-actions";
import { FilterTabs, Pager, ConsoleSearch, queryHref } from "@/components/console/chrome";
import { Shield, Store, ShoppingBag, User, Users } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill, type PillTone,
} from "@avenick/ui";

// generateMetadata rather than a static object: the tab title is user-visible
// copy and a module-scope constant has no translator in scope.
export async function generateMetadata() {
  const t = await getTranslations("adminShell.meta");
  return { title: t("users") };
}
export const dynamic = "force-dynamic";

/**
 * The four audiences an operator distinguishes, and the roles inside each. The
 * group carries a stable `key`, not a display string — this map sits at module
 * scope where no translator is in scope, so the label is looked up at render
 * from `adminShell.users.roleGroups`.
 */
const ROLE_GROUPS: Array<{ key: string; icon: ElementType; roles: UserRole[]; filter: UserRole }> = [
  { key: "platformStaff", icon: Shield, roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN], filter: UserRole.ADMIN },
  { key: "suppliers", icon: Store, roles: [UserRole.SELLER_OWNER, UserRole.SELLER_STAFF], filter: UserRole.SELLER_OWNER },
  {
    key: "b2bBuyers",
    icon: ShoppingBag,
    roles: [UserRole.COMPANY_ADMIN, UserRole.COMPANY_BUYER, UserRole.COMPANY_APPROVER],
    filter: UserRole.COMPANY_ADMIN,
  },
  { key: "consumers", icon: User, roles: [UserRole.CONSUMER], filter: UserRole.CONSUMER },
];

// Tone is presentation, not copy, so it stays here; the enum keys are the
// stored values and are never translated — only their labels are, under
// `adminShell.users.statuses`.
const STATUS_TONE: Record<UserStatus, PillTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  SUSPENDED: "danger",
  BANNED: "neutral",
};

interface PageProps {
  searchParams: { role?: string; status?: string; search?: string; page?: string };
}

type AdminUser = Awaited<ReturnType<typeof getAdminUsers>>["users"][number];

export default async function UsersPage({ searchParams }: PageProps) {
  const { userId: currentUserId } = await requireAdminSession();
  const t = await getTranslations("adminShell.users");
  const locale = await getLocale();

  // The joined date, in the reader's language. `format(d, "d MMM yyyy")`
  // from date-fns has no locale argument here, so it printed "3 Sep 2026" on
  // the Arabic page — a column of English month abbreviations is the same
  // defect as an English label in an Arabic sentence.
  //
  // `Intl` rather than a date-fns locale bundle, matching the buyer suite's
  // own formatter: it is in every runtime, and it lets the numbering system
  // be PINNED. A bare `ar` returns Arabic-Indic digits; `-u-nu-latn` holds the
  // one numeral system this product uses. `en-AE` is the GCC English locale
  // and renders "3 Sep 2026" — byte-identical to what this column already
  // showed, so the English console is unchanged.
  const joinedFormat = new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          {ROLE_GROUPS.map((group) => (
            <Stat
              key={group.key}
              label={t(`roleGroups.${group.key}`)}
              value={countFor(group.roles)}
              icon={group.icon}
              href={href({ role: group.filter })}
              linkComponent={Link}
            />
          ))}
        </CellGrid>

        <div className="flex flex-wrap items-start gap-3">
          <FilterTabs
            label={t("filterByRole")}
            tabs={[
              { href: href({ role: undefined }), label: t("allRoles"), count: allRoles, active: !role },
              ...ROLE_GROUPS.map((g) => ({
                href: href({ role: g.filter }),
                // The count is of the GROUP, but the filter is one role inside
                // it — so the count is deliberately omitted rather than shown
                // next to a filter that will not return it. A number a reader
                // can falsify by clicking it is worse than no number.
                label: t(`roles.${g.filter}`),
                active: role === g.filter,
              })),
            ]}
          />
          <FilterTabs
            label={t("filterByStatus")}
            tabs={[
              { href: href({ status: undefined }), label: t("anyStatus"), active: !status },
              ...([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING] as const).map((s) => ({
                href: href({ status: s }),
                label: t(`statuses.${s}`),
                active: status === s,
              })),
            ]}
          />
          <ConsoleSearch
            className="ms-auto"
            action="/users"
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
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
              label: t("columnUser"),
              render: (u) => (
                <>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-medium text-ink-1">
                      {`${u.firstName} ${u.lastName}`.trim() || u.email}
                    </span>
                    {/* Marking the operator's own row is what stops somebody
                        suspending themselves out of the console. */}
                    {u.id === currentUserId && <StatusPill>{t("you")}</StatusPill>}
                  </span>
                  <span className="u-meta block truncate text-ink-3">{u.email}</span>
                </>
              ),
            },
            {
              key: "role",
              label: t("columnRole"),
              width: "152px",
              render: (u) => <span className="u-meta text-ink-2">{t(`roles.${u.role}`)}</span>,
            },
            {
              key: "org",
              label: t("columnOrg"),
              hideOnMobile: true,
              render: (u) => {
                const org = u.sellerProfile?.businessNameEn ?? u.companyMember?.company.nameEn;
                return org ? (
                  <span className="block truncate text-ink-2">{org}</span>
                ) : (
                  <span className="u-meta text-ink-3">{t("noOrg")}</span>
                );
              },
            },
            {
              key: "status",
              label: t("columnStatus"),
              width: "120px",
              render: (u) => (
                <StatusPill tone={STATUS_TONE[u.status]} dot={u.status !== "ACTIVE"}>
                  {t(`statuses.${u.status}`)}
                </StatusPill>
              ),
            },
            {
              key: "joined",
              label: t("columnJoined"),
              hideOnMobile: true,
              width: "104px",
              render: (u) => <span className="tnum text-ink-2">{joinedFormat.format(u.createdAt)}</span>,
            },
            {
              key: "decision",
              label: t("columnAccess"),
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
              // The total goes in twice: as a number so ICU selects the plural
              // form — Arabic has six — and as a Western-digit string, because a
              // bare number would render in the locale's own numeral system.
              summary={
                filtered
                  ? t("pagerFiltered", { count: total, value: total.toLocaleString("en") })
                  : t("pagerAll", { count: total, value: total.toLocaleString("en") })
              }
            />
          }
          empty={
            filtered ? (
              <EmptyState
                eyebrow={t("emptyFiltered.eyebrow")}
                headline={t("emptyFiltered.headline")}
                body={t("emptyFiltered.body")}
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/users">{t("emptyFiltered.action")}</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="certificate"
                glyph={<Users />}
                eyebrow={t("emptyRegister.eyebrow")}
                headline={t("emptyRegister.headline")}
                body={t("emptyRegister.body")}
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/audit">{t("emptyRegister.action")}</Link>
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
