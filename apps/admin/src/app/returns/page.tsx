import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ReturnStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { ReturnActions } from "../disputes/return-actions";
import { RotateCcw, Clock, CheckCircle, XCircle, Truck, PackageCheck, Banknote, CornerDownRight } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, Button, type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";
import { FilterTabs } from "@/components/console/chrome";

export const metadata = { title: "Returns" };
export const dynamic = "force-dynamic";

const STATUS: Record<ReturnStatus, { label: string; tone: PillTone; icon: typeof Clock }> = {
  REQUESTED:  { label: "Awaiting decision", tone: "warning", icon: Clock },
  APPROVED:   { label: "Approved",          tone: "accent",  icon: CheckCircle },
  IN_TRANSIT: { label: "In transit",        tone: "neutral", icon: Truck },
  RECEIVED:   { label: "Received",          tone: "neutral", icon: PackageCheck },
  REFUNDED:   { label: "Refunded",          tone: "success", icon: Banknote },
  REJECTED:   { label: "Rejected",          tone: "danger",  icon: XCircle },
};

const PAGE_SIZE = 100;

export default async function ReturnsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();

  const status = Object.values(ReturnStatus).includes(searchParams.status as ReturnStatus)
    ? (searchParams.status as ReturnStatus)
    : undefined;
  const where = status ? { status } : {};

  const [returns, statusCounts, refundedSum, refundedCurrencies] = await Promise.all([
    db.returnRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        seller: { select: { businessNameEn: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            currency: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            company: { select: { nameEn: true } },
          },
        },
        items: { select: { id: true, quantity: true, orderItem: { select: { nameEn: true } } } },
      },
    }),
    // Tiles and tab counts describe the whole marketplace, not the filtered page.
    db.returnRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.returnRequest.aggregate({ where: { status: ReturnStatus.REFUNDED }, _sum: { refundAmount: true } }),
    // Refund value only means something inside a single currency, and orders may
    // be placed in any GCC currency — so establish which currencies are actually
    // represented before showing a total.
    db.order.groupBy({ by: ["currency"], where: { returnRequests: { some: { status: ReturnStatus.REFUNDED } } }, _count: { _all: true } }),
  ]);

  const countFor = (statuses: ReturnStatus[]) =>
    statusCounts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count._all, 0);

  const totalRequests = statusCounts.reduce((sum, c) => sum + c._count._all, 0);
  const awaiting = countFor([ReturnStatus.REQUESTED]);
  const inProgress = countFor([ReturnStatus.APPROVED, ReturnStatus.IN_TRANSIT, ReturnStatus.RECEIVED]);

  // One currency: report the real total. Several: report how many refunds there
  // were rather than adding AED to KWD and calling the result money.
  const refundValue =
    refundedCurrencies.length === 0
      ? "None yet"
      : refundedCurrencies.length === 1
        ? formatCurrency(Number(refundedSum._sum.refundAmount ?? 0), refundedCurrencies[0]!.currency)
        : `${countFor([ReturnStatus.REFUNDED])} refunds`;
  const refundValueLabel = refundedCurrencies.length > 1 ? "Refunded (mixed currencies)" : "Refunded value";

  const tabs: Array<{ value?: ReturnStatus; label: string; count: number }> = [
    { value: undefined, label: "All", count: totalRequests },
    ...Object.values(ReturnStatus).map((s) => ({ value: s, label: STATUS[s].label, count: countFor([s]) })),
  ];

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Money out"
          title="Returns & refunds"
          description="Buyer return requests across every seller. Approvals, rejections and refunds are audit-logged."
          dateline={`Newest first · latest ${PAGE_SIZE} shown · refund amounts in the currency of the order`}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat
            label="Awaiting decision"
            value={awaiting}
            rank="section"
            tone={awaiting > 0 ? "warning" : "default"}
          />
          <CountStat label="In progress" value={inProgress} note="approved, in transit or received" />
          {/* One currency: the real total. Several: a count, because adding AED
              to KWD and calling the result money would be a fiction. */}
          <CountStat
            label={refundValueLabel}
            value={refundValue}
            dateline={
              refundedCurrencies.length > 1
                ? "Refunds were taken in more than one currency, so a total cannot be stated"
                : undefined
            }
          />
          <CountStat label="Total requests" value={totalRequests} />
        </CellGrid>

        <FilterTabs
          label="Filter returns by status"
          tabs={tabs.map((t) => ({
            href: t.value ? `/returns?status=${t.value}` : "/returns",
            label: t.label,
            count: t.count,
            active: status === t.value,
          }))}
        />

        <LedgerTable
          rows={returns}
          getRowKey={(r) => r.id}
          stickyHead
          dateline="Buyer-opened requests, as recorded · refund amounts in the currency of the order, no conversion applied"
          rowProps={(r) => ({
            // The rows that need a human decision are the reason this page exists.
            // Hover deepens the same hue; the generic row hover is a plain
            // background-color and would otherwise wipe this wash on contact.
            className: r.status === ReturnStatus.REQUESTED ? "bg-warning-soft hover:bg-warning/10" : undefined,
          })}
          columns={[
            {
              key: "returnNumber",
              label: "Return #",
              render: (r) => <span className="u-mono whitespace-nowrap text-meta font-medium text-ink-1">{r.returnNumber}</span>,
            },
            {
              key: "order",
              label: "Order",
              render: (r) => (
                <Link
                  href={`/orders/${r.order.id}`}
                  className="u-focus u-mono whitespace-nowrap rounded-nested text-meta text-primary-ink hover:underline"
                >
                  {r.order.orderNumber}
                </Link>
              ),
            },
            {
              key: "buyer",
              label: "Buyer",
              render: (r) => {
                const buyer = r.order.company?.nameEn ?? `${r.order.user.firstName} ${r.order.user.lastName}`.trim();
                return (
                  <div className="max-w-[180px] py-1">
                    <p className="truncate font-medium text-ink-1" title={buyer}>{buyer}</p>
                    <p className="u-meta truncate text-ink-3">{r.order.user.email}</p>
                  </div>
                );
              },
            },
            {
              key: "seller",
              label: "Seller",
              hideOnMobile: true,
              render: (r) => (
                <span className="block max-w-[160px] truncate text-ink-2" title={r.seller.businessNameEn}>
                  {r.seller.businessNameEn}
                </span>
              ),
            },
            {
              key: "items",
              label: "Items",
              hideOnMobile: true,
              render: (r) => {
                const [firstItem, ...otherItems] = r.items;
                const itemTitle = r.items.map((i) => `${i.orderItem.nameEn} × ${i.quantity}`).join("\n");
                if (!firstItem) {
                  // Legacy/admin-opened returns predate line selection; there is
                  // nothing itemised to show and nothing to infer.
                  return <span className="u-meta text-ink-3">Not itemised</span>;
                }
                return (
                  <div className="max-w-[200px] py-1">
                    <p className="truncate text-ink-1" title={itemTitle}>{firstItem.orderItem.nameEn} × {firstItem.quantity}</p>
                    {otherItems.length > 0 && (
                      <p className="u-meta text-ink-3">+{otherItems.length} more line{otherItems.length !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "reason",
              label: "Reason",
              render: (r) => (
                <div className="max-w-[220px] py-1">
                  <p className="truncate text-ink-2" title={r.reason}>{r.reason}</p>
                  {r.resolution && (
                    // The resolution hangs off the reason. A "↳" glyph is not
                    // mirrored by the bidi algorithm, so in Arabic it pointed
                    // back the way the text had come; an icon flips with the
                    // direction and the relationship survives.
                    <p className="u-meta flex items-center gap-1 truncate text-ink-3" title={r.resolution}>
                      <CornerDownRight className="h-3 w-3 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
                      <span className="truncate">{r.resolution}</span>
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: "refundAmount",
              label: "Amount",
              numeric: true,
              render: (r) =>
                r.refundAmount ? (
                  <Num value={formatCurrency(Number(r.refundAmount), r.order.currency)} className="whitespace-nowrap" />
                ) : (
                  <span className="u-meta text-ink-3" title="No authorised refund amount is recorded on this request.">
                    Not set
                  </span>
                ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => {
                const sc = STATUS[r.status];
                const StatusIcon = sc.icon;
                return (
                  <StatusPill tone={sc.tone} className="whitespace-nowrap">
                    <StatusIcon className="h-3 w-3" aria-hidden="true" /> {sc.label}
                  </StatusPill>
                );
              },
            },
            {
              key: "createdAt",
              label: "Requested",
              hideOnMobile: true,
              render: (r) => <span className="whitespace-nowrap text-ink-2">{format(r.createdAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "actions",
              label: "Actions",
              align: "end",
              render: (r) => (
                <div className="flex justify-end py-1">
                  <ReturnActions
                    returnId={r.id}
                    returnNumber={r.returnNumber}
                    status={r.status}
                    orderTotal={Number(r.refundAmount ?? r.order.total)}
                    currency={r.order.currency}
                  />
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline={status ? "No return is in that state." : "No buyer has opened a return."}
              body={
                status
                  ? "Clear the status filter to see every return on record."
                  : "A request appears here as soon as one is opened against a delivered order."
              }
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                status ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/returns">Show every return</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          footer={
            returns.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Showing <span className="fig text-ink-2">{returns.length}</span> of{" "}
                  <span className="fig text-ink-2">{status ? countFor([status]) : totalRequests}</span> return
                  {(status ? countFor([status]) : totalRequests) !== 1 ? "s" : ""}
                  {status ? ` with status ${STATUS[status].label.toLowerCase()}` : ""}
                </span>
                <span>Newest first, latest {PAGE_SIZE} shown</span>
              </div>
            ) : undefined
          }
        />
      </div>
    </AdminLayout>
  );
}
