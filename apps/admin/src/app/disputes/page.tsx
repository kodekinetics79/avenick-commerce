import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getAdminReturns, ReturnStatus } from "@avenick/database";
import { cn, formatCurrency } from "@avenick/utils";
import { ReturnActions } from "./return-actions";
import { FilterTabs, Pager, queryHref } from "@/components/console/chrome";
import { Scale } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill, type PillTone,
} from "@avenick/ui";

export const metadata = { title: "Disputes & Returns" };
export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<ReturnStatus, { label: string; tone: PillTone }> = {
  REQUESTED: { label: "Requested", tone: "warning" },
  APPROVED: { label: "Approved", tone: "accent" },
  REJECTED: { label: "Rejected", tone: "danger" },
  IN_TRANSIT: { label: "In transit", tone: "accent" },
  RECEIVED: { label: "Received", tone: "accent" },
  REFUNDED: { label: "Refunded", tone: "success" },
};

/** The two states that still need a person, and nothing else. */
const NEEDS_A_PERSON: ReturnStatus[] = ["REQUESTED", "RECEIVED"];

interface PageProps {
  searchParams: { status?: string; page?: string };
}

type ReturnRow = Awaited<ReturnType<typeof getAdminReturns>>["returns"][number];

export default async function DisputesPage({ searchParams }: PageProps) {
  await requireAdminSession();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const limit = 25;
  const status = Object.values(ReturnStatus).includes(searchParams.status as ReturnStatus)
    ? (searchParams.status as ReturnStatus)
    : undefined;

  const { returns, total, statusCounts } = await getAdminReturns({ page, limit, status });
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const countFor = (statuses: ReturnStatus[]) =>
    statusCounts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);
  const allCount = statusCounts.reduce((s, c) => s + c._count._all, 0);
  const href = (next: Record<string, string | undefined>) => queryHref("/disputes", searchParams, next);
  const awaiting = countFor(["REQUESTED"]);

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Support"
          title="Returns and disputes"
          description="Buyer return requests and their resolution. Approvals, rejections and recorded refunds are all written to the audit stream."
          actions={<StatusPill>Read only beyond this register</StatusPill>}
          dateline="Refund amounts are shown in each order's own recorded currency and are never converted. Recording a refund here is the platform's record of money already returned by the gateway or bank; it does not move any."
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label="Awaiting a decision"
            value={awaiting}
            icon={Scale}
            chip={awaiting > 0 ? "warning" : "neutral"}
            href={href({ status: ReturnStatus.REQUESTED })}
            linkComponent={Link}
          />
          <Stat label="In progress" value={countFor(["APPROVED", "IN_TRANSIT", "RECEIVED"])} icon={Scale} />
          <Stat label="Refunded" value={countFor(["REFUNDED"])} icon={Scale} />
          <Stat label="Rejected" value={countFor(["REJECTED"])} icon={Scale} />
        </CellGrid>

        <FilterTabs
          label="Filter returns by status"
          tabs={[
            { href: href({ status: undefined }), label: "All", count: allCount, active: !status },
            ...Object.values(ReturnStatus).map((s) => ({
              href: href({ status: s }),
              label: STATUS_CONFIG[s].label,
              count: countFor([s]),
              active: status === s,
            })),
          ]}
        />

        <LedgerTable<ReturnRow>
          rows={returns}
          getRowKey={(r) => r.id}
          stickyHead
          // Every row reserves the 3px inline-start rule and only a row that
          // still needs a person colours it in — the same construction .u-commit
          // uses, so marking one can never reflow the rows beneath it. In a
          // register that mixes six states, this is what makes the work findable
          // without reading a single status pill.
          rowProps={(r) => ({
            className: cn(
              "border-s-[3px]",
              NEEDS_A_PERSON.includes(r.status) ? "border-s-warning" : "border-s-transparent",
            ),
          })}
          columns={[
            {
              key: "return",
              label: "Return",
              width: "160px",
              render: (r) => (
                <>
                  <span className="u-mono block truncate text-ink-1">{r.returnNumber}</span>
                  <Link
                    href={`/orders/${r.order.id}`}
                    className="u-focus u-mono u-meta block truncate rounded-nested text-primary-ink underline-offset-4 hover:underline"
                  >
                    {r.order.orderNumber}
                  </Link>
                </>
              ),
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (r) => (
                <>
                  <span className="block truncate text-ink-1">
                    {`${r.order.user.firstName} ${r.order.user.lastName}`.trim() || r.order.user.email}
                  </span>
                  <span className="u-meta block truncate text-ink-3">{r.seller.businessNameEn}</span>
                </>
              ),
            },
            {
              key: "reason",
              label: "Reason",
              hideOnMobile: true,
              render: (r) => (
                <>
                  <span className="block truncate text-ink-2">{r.reason}</span>
                  {r.resolution && (
                    <span className="u-meta block truncate text-ink-3">Resolution: {r.resolution}</span>
                  )}
                </>
              ),
            },
            {
              key: "refund",
              label: "Refund",
              numeric: true,
              width: "140px",
              render: (r) =>
                r.refundAmount ? (
                  <>
                    <span className="block text-ink-1">
                      {formatCurrency(Number(r.refundAmount), r.order.currency as never)}
                    </span>
                    <span className="u-meta block text-ink-3">
                      of {formatCurrency(Number(r.order.total), r.order.currency as never)}
                    </span>
                  </>
                ) : (
                  <span className="u-meta text-ink-3">None recorded</span>
                ),
            },
            {
              key: "status",
              label: "Status",
              width: "124px",
              render: (r) => (
                <StatusPill tone={STATUS_CONFIG[r.status].tone} dot={NEEDS_A_PERSON.includes(r.status)}>
                  {STATUS_CONFIG[r.status].label}
                </StatusPill>
              ),
            },
            {
              key: "opened",
              label: "Opened",
              hideOnMobile: true,
              width: "104px",
              render: (r) => <span className="tnum text-ink-2">{format(r.createdAt, "d MMM yyyy")}</span>,
            },
            {
              key: "decision",
              label: "Decision",
              align: "end",
              width: "200px",
              render: (r) => (
                <ReturnActions
                  returnId={r.id}
                  returnNumber={r.returnNumber}
                  status={r.status}
                  orderTotal={Number(r.refundAmount ?? r.order.total)}
                  currency={r.order.currency}
                />
              ),
            },
          ]}
          footer={
            <Pager
              page={page}
              totalPages={totalPages}
              hrefFor={(p) => href({ page: String(p), status })}
              summary={`${total.toLocaleString()} ${total === 1 ? "return" : "returns"}${status ? ` in ${STATUS_CONFIG[status].label.toLowerCase()}` : ""}`}
            />
          }
          empty={
            status ? (
              <EmptyState
                eyebrow="No match"
                headline={`No return is currently ${STATUS_CONFIG[status].label.toLowerCase()}.`}
                body="The register itself is not empty — clearing the filter returns every request it holds."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/disputes">Show every return</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="certificate"
                glyph={<Scale />}
                eyebrow="Nothing disputed"
                headline="No buyer has raised a return request."
                body="A request appears here the moment a buyer opens one against a delivered order, and stays through approval, transit and receipt until a refund is recorded or it is rejected."
                action={
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/orders">Open the order register</Link>
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
