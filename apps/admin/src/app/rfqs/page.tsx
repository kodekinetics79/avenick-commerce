import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminRFQs, RFQStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { FilterTabs, Pager, ConsoleSearch, queryHref } from "@/components/console/chrome";
import { FileQuestion, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "RFQ Management" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<RFQStatus, { label: string; tone: PillTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  SUBMITTED: { label: "Submitted", tone: "accent" },
  UNDER_REVIEW: { label: "Under review", tone: "accent" },
  QUOTED: { label: "Quoted", tone: "warning" },
  NEGOTIATING: { label: "Negotiating", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** The filters an operator actually works, in the order a request moves through them. */
const FILTERS: RFQStatus[] = ["SUBMITTED", "UNDER_REVIEW", "QUOTED", "NEGOTIATING", "ACCEPTED", "REJECTED"];

interface PageProps {
  searchParams: { status?: string; search?: string; page?: string };
}

type Rfq = Awaited<ReturnType<typeof getAdminRFQs>>["rfqs"][number];

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
  const allCount = statusCounts.reduce((s, c) => s + c._count._all, 0);
  const href = (next: Record<string, string | undefined>) => queryHref("/rfqs", searchParams, next);
  const filtered = Boolean(search || status);

  const open = countFor(["SUBMITTED", "UNDER_REVIEW"]);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="B2B trade"
          title="Requests for quote"
          description="Every request a buyer has raised, live from the RFQ workflow."
          dateline="Counts in the band below are of the whole register by status; the table shows one page of it. Quoted totals are shown in each request's own recorded currency and are never converted."
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label="Awaiting a supplier"
            value={open}
            icon={FileQuestion}
            chip={open > 0 ? "warning" : "neutral"}
            note="Submitted or under review"
            href={href({ status: RFQStatus.SUBMITTED })}
            linkComponent={Link}
          />
          <Stat label="Quoted or negotiating" value={countFor(["QUOTED", "NEGOTIATING"])} icon={FileQuestion} />
          <Stat label="Accepted" value={countFor(["ACCEPTED"])} icon={FileQuestion} />
          <Stat label="Rejected or expired" value={countFor(["REJECTED", "EXPIRED"])} icon={FileQuestion} />
        </CellGrid>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <FilterTabs
            label="Filter requests by status"
            tabs={[
              { href: href({ status: undefined }), label: "All", count: allCount, active: !status },
              ...FILTERS.map((s) => ({
                href: href({ status: s }),
                label: STATUS_CONFIG[s].label,
                count: countFor([s]),
                active: status === s,
              })),
            ]}
          />
          <ConsoleSearch
            action="/rfqs"
            label="Search requests by number or company"
            placeholder="RFQ number or company…"
            defaultValue={search}
            preserve={{ status }}
            clearHref={href({ search: undefined })}
          />
        </div>

        <LedgerTable<Rfq>
          rows={rfqs}
          getRowKey={(r) => r.id}
          stickyHead
          columns={[
            {
              key: "rfq",
              label: "Request",
              width: "160px",
              render: (r) => (
                <>
                  <span className="u-mono block truncate text-ink-1">{r.rfqNumber}</span>
                  {r._count.messages > 0 && (
                    <span className="u-meta inline-flex items-center gap-1 text-ink-3">
                      <MessageSquare className="h-3 w-3" aria-hidden="true" />
                      <span className="fig">{r._count.messages}</span> messages
                    </span>
                  )}
                </>
              ),
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (r) => (
                <>
                  <span className="block truncate text-ink-1">{r.company?.nameEn ?? "Individual buyer"}</span>
                  {r.buyer && <span className="u-meta block truncate text-ink-3">{r.buyer.email}</span>}
                </>
              ),
            },
            {
              key: "items",
              label: "Lines",
              hideOnMobile: true,
              render: (r) => {
                const shown = r.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ");
                return (
                  <>
                    <span className="block truncate text-ink-2">{shown || "No lines recorded"}</span>
                    {r.items.length > 2 && (
                      <span className="u-meta block text-ink-3">and {r.items.length - 2} more</span>
                    )}
                  </>
                );
              },
            },
            {
              key: "seller",
              label: "Supplier",
              hideOnMobile: true,
              width: "168px",
              render: (r) =>
                r.seller ? (
                  <span className="block truncate text-ink-2">{r.seller.businessNameEn}</span>
                ) : (
                  // "Unassigned" is a state a person acts on, so it carries a
                  // mark rather than sitting in the same grey as a supplier name.
                  <StatusPill tone="warning">Unassigned</StatusPill>
                ),
            },
            {
              key: "quoted",
              label: "Quoted",
              numeric: true,
              width: "136px",
              render: (r) =>
                r.totalQuoted ? (
                  formatCurrency(Number(r.totalQuoted), r.currency as never)
                ) : (
                  <span className="u-meta text-ink-3">Not quoted</span>
                ),
            },
            {
              key: "status",
              label: "Status",
              width: "132px",
              render: (r) => (
                <StatusPill tone={STATUS_CONFIG[r.status].tone} dot={r.status === "SUBMITTED" || r.status === "UNDER_REVIEW"}>
                  {STATUS_CONFIG[r.status].label}
                </StatusPill>
              ),
            },
            {
              key: "requiredBy",
              label: "Required by",
              hideOnMobile: true,
              align: "end",
              width: "112px",
              render: (r) =>
                r.requiredBy ? (
                  <span className="tnum text-ink-2">{format(r.requiredBy, "d MMM yyyy")}</span>
                ) : (
                  <span className="u-meta text-ink-3">No date</span>
                ),
            },
          ]}
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(p) => href({ page: String(p), search, status })}
              summary={`${total.toLocaleString()} ${total === 1 ? "request" : "requests"}${filtered ? " match these filters" : ""}`}
            />
          }
          empty={
            filtered ? (
              <EmptyState
                eyebrow="No match"
                headline="No request matches the filters currently applied."
                body="Clearing the search or the status filter returns the full register."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/rfqs">Clear the filters</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="certificate"
                glyph={<FileQuestion />}
                eyebrow="Nothing requested"
                headline="No buyer has raised a request for quote yet."
                body="A request appears here the moment a company submits one from the buyer suite, and stays through every step until it is accepted, rejected or expires."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/companies">Review buyer companies</Link>
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
