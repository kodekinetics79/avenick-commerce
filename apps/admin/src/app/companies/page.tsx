import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminCompanies, CompanyStatus } from "@avenick/database";
import { CompanyStatusActions } from "./company-actions";
import { FilterTabs, Pager, ConsoleSearch, queryHref } from "@/components/console/chrome";
import { Building2, Users, ShoppingCart, FileText } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "B2B Companies" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<CompanyStatus, { label: string; tone: PillTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  PENDING_VERIFICATION: { label: "Pending verification", tone: "warning" },
};

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

type Company = Awaited<ReturnType<typeof getAdminCompanies>>["companies"][number];

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

  const countFor = (s: CompanyStatus) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;
  const allCount = statusCounts.reduce((sum, c) => sum + c._count._all, 0);
  const href = (next: Record<string, string | undefined>) => queryHref("/companies", searchParams, next);
  const filtered = Boolean(search || status);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="B2B trade"
          title="Buyer companies"
          description="Verify, activate and suspend buyer organisations. Every status change is written to the audit stream."
          dateline="Registered companies, newest first. Counts in the band below are of the whole register; the table shows one page of it."
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat label="Registered" value={allCount} icon={Building2} />
          <Stat label="Active" value={countFor(CompanyStatus.ACTIVE)} icon={Building2} />
          <Stat
            label="Pending verification"
            value={countFor(CompanyStatus.PENDING_VERIFICATION)}
            icon={Building2}
            chip={countFor(CompanyStatus.PENDING_VERIFICATION) > 0 ? "warning" : "neutral"}
          />
          <Stat label="Suspended" value={countFor(CompanyStatus.SUSPENDED)} icon={Building2} />
        </CellGrid>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <FilterTabs
            label="Filter companies by status"
            tabs={[
              { href: href({ status: undefined }), label: "All", count: allCount, active: !status },
              ...Object.values(CompanyStatus).map((s) => ({
                href: href({ status: s }),
                label: STATUS_CONFIG[s].label,
                count: countFor(s),
                active: status === s,
              })),
            ]}
          />
          <ConsoleSearch
            action="/companies"
            label="Search companies by name or CR number"
            placeholder="Name or CR number…"
            defaultValue={search}
            preserve={{ status }}
            clearHref={href({ search: undefined })}
          />
        </div>

        <LedgerTable<Company>
          rows={companies}
          getRowKey={(c) => c.id}
          stickyHead
          dateline="Credit limits are stored without a currency and are shown exactly as recorded. Payment terms are in days."
          columns={[
            {
              key: "company",
              label: "Company",
              render: (c) => (
                <>
                  <span className="block truncate font-medium text-ink-1">{c.nameEn}</span>
                  {c.nameAr && <span className="u-meta block truncate text-ink-3" dir="rtl">{c.nameAr}</span>}
                </>
              ),
            },
            {
              key: "registration",
              label: "CR / VAT",
              hideOnMobile: true,
              width: "152px",
              render: (c) => (
                <>
                  {/* Mono is for identifiers. A registration number that is not
                      recorded is stated as not recorded, never as an em dash
                      that could be read as zero. */}
                  <span className="u-mono u-meta block text-ink-2">{c.crNumber ?? "No CR recorded"}</span>
                  {c.vatNumber && <span className="u-mono u-meta block text-ink-3">{c.vatNumber}</span>}
                </>
              ),
            },
            {
              key: "location",
              label: "Location",
              hideOnMobile: true,
              width: "144px",
              render: (c) => <span className="u-meta text-ink-2">{c.city}, {c.country}</span>,
            },
            {
              key: "activity",
              label: "Activity",
              width: "168px",
              render: (c) => (
                <span className="u-meta flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-ink-2">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3 text-ink-3" aria-hidden="true" />
                    <span className="fig">{c._count.members}</span> members
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3 text-ink-3" aria-hidden="true" />
                    <span className="fig">{c._count.orders}</span> orders
                  </span>
                  {c._count.rfqRequests > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3 w-3 text-ink-3" aria-hidden="true" />
                      <span className="fig">{c._count.rfqRequests}</span> RFQs
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: "credit",
              label: "Credit",
              numeric: true,
              width: "136px",
              render: (c) =>
                c.creditLimit ? (
                  <>
                    <span className="block text-ink-1">{Number(c.creditLimit).toLocaleString()}</span>
                    <span className="u-meta block text-ink-3">{c.paymentTerms}d terms</span>
                  </>
                ) : (
                  <span className="u-meta text-ink-3">No limit set</span>
                ),
            },
            {
              key: "status",
              label: "Status",
              width: "144px",
              render: (c) => (
                <StatusPill tone={STATUS_CONFIG[c.status].tone} dot={c.status !== "ACTIVE"}>
                  {STATUS_CONFIG[c.status].label}
                </StatusPill>
              ),
            },
            {
              key: "joined",
              label: "Joined",
              hideOnMobile: true,
              width: "104px",
              render: (c) => <span className="tnum text-ink-2">{format(c.createdAt, "d MMM yyyy")}</span>,
            },
            {
              key: "decision",
              label: "Decision",
              align: "end",
              width: "176px",
              render: (c) => <CompanyStatusActions companyId={c.id} name={c.nameEn} status={c.status} />,
            },
          ]}
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(p) => href({ page: String(p), search, status })}
              summary={`${total.toLocaleString()} ${total === 1 ? "company" : "companies"}${filtered ? " match these filters" : " registered"}`}
            />
          }
          empty={
            filtered ? (
              <EmptyState
                eyebrow="No match"
                headline="No company matches the filters currently applied."
                body="Clearing the search or the status filter returns the full register."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/companies">Clear the filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="certificate"
                glyph={<Building2 />}
                eyebrow="Nothing registered"
                headline="No buyer organisation has registered on the platform yet."
                body="A company appears here as soon as one completes B2B registration, and arrives awaiting verification. Nothing is filtered out of this view."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/users">Review registered users</Link>
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
