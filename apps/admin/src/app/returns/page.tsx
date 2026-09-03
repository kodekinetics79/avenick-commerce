import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ReturnStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { ReturnActions } from "../disputes/return-actions";
import { RotateCcw, Clock, CheckCircle, XCircle, Truck, PackageCheck, Banknote, CornerDownRight } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, Button, type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";
import { FilterTabs } from "@/components/console/chrome";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.returns");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Tone and icon per status; the label is translated from `returns.status`. */
const STATUS: Record<ReturnStatus, { tone: PillTone; icon: typeof Clock }> = {
  REQUESTED:  { tone: "warning", icon: Clock },
  APPROVED:   { tone: "accent",  icon: CheckCircle },
  IN_TRANSIT: { tone: "neutral", icon: Truck },
  RECEIVED:   { tone: "neutral", icon: PackageCheck },
  REFUNDED:   { tone: "success", icon: Banknote },
  REJECTED:   { tone: "danger",  icon: XCircle },
};

const PAGE_SIZE = 100;

export default async function ReturnsPage({ searchParams }: { searchParams: { status?: string } }) {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.returns");

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
      ? t("refund.none")
      : refundedCurrencies.length === 1
        ? formatCurrency(Number(refundedSum._sum.refundAmount ?? 0), refundedCurrencies[0]!.currency)
        : t("refund.count", {
            count: countFor([ReturnStatus.REFUNDED]),
            value: String(countFor([ReturnStatus.REFUNDED])),
          });
  const refundValueLabel = refundedCurrencies.length > 1 ? t("refund.labelMixed") : t("refund.label");

  const tabs: Array<{ value?: ReturnStatus; label: string; count: number }> = [
    { value: undefined, label: t("filters.all"), count: totalRequests },
    ...Object.values(ReturnStatus).map((s) => ({ value: s, label: t(`status.${s}`), count: countFor([s]) })),
  ];

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline", { count: String(PAGE_SIZE) })}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat
            label={t("stats.awaiting")}
            value={awaiting}
            rank="section"
            tone={awaiting > 0 ? "warning" : "default"}
          />
          <CountStat label={t("stats.inProgress")} value={inProgress} note={t("stats.inProgressNote")} />
          {/* One currency: the real total. Several: a count, because adding AED
              to KWD and calling the result money would be a fiction. */}
          <CountStat
            label={refundValueLabel}
            value={refundValue}
            dateline={
              refundedCurrencies.length > 1 ? t("refund.mixedDateline") : undefined
            }
          />
          <CountStat label={t("stats.total")} value={totalRequests} />
        </CellGrid>

        <FilterTabs
          label={t("filters.label")}
          tabs={tabs.map((tab) => ({
            href: tab.value ? `/returns?status=${tab.value}` : "/returns",
            label: tab.label,
            count: tab.count,
            active: status === tab.value,
          }))}
        />

        <LedgerTable
          rows={returns}
          getRowKey={(r) => r.id}
          stickyHead
          dateline={t("table.dateline")}
          rowProps={(r) => ({
            // The rows that need a human decision are the reason this page exists.
            // Hover deepens the same hue; the generic row hover is a plain
            // background-color and would otherwise wipe this wash on contact.
            className: r.status === ReturnStatus.REQUESTED ? "bg-warning-soft hover:bg-warning/10" : undefined,
          })}
          columns={[
            {
              key: "returnNumber",
              label: t("columns.returnNumber"),
              render: (r) => <span className="u-mono whitespace-nowrap text-meta font-medium text-ink-1">{r.returnNumber}</span>,
            },
            {
              key: "order",
              label: t("columns.order"),
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
              label: t("columns.buyer"),
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
              label: t("columns.seller"),
              hideOnMobile: true,
              render: (r) => (
                <span className="block max-w-[160px] truncate text-ink-2" title={r.seller.businessNameEn}>
                  {r.seller.businessNameEn}
                </span>
              ),
            },
            {
              key: "items",
              label: t("columns.items"),
              hideOnMobile: true,
              render: (r) => {
                const [firstItem, ...otherItems] = r.items;
                const itemTitle = r.items.map((i) => `${i.orderItem.nameEn} × ${i.quantity}`).join("\n");
                if (!firstItem) {
                  // Legacy/admin-opened returns predate line selection; there is
                  // nothing itemised to show and nothing to infer.
                  return <span className="u-meta text-ink-3">{t("notItemised")}</span>;
                }
                return (
                  <div className="max-w-[200px] py-1">
                    <p className="truncate text-ink-1" title={itemTitle}>{firstItem.orderItem.nameEn} × {firstItem.quantity}</p>
                    {otherItems.length > 0 && (
                      <p className="u-meta text-ink-3">
                        {t("moreLines", { count: otherItems.length, value: String(otherItems.length) })}
                      </p>
                    )}
                  </div>
                );
              },
            },
            {
              key: "reason",
              label: t("columns.reason"),
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
              label: t("columns.amount"),
              numeric: true,
              render: (r) =>
                r.refundAmount ? (
                  <Num value={formatCurrency(Number(r.refundAmount), r.order.currency)} className="whitespace-nowrap" />
                ) : (
                  <span className="u-meta text-ink-3" title={t("amountNotSetTitle")}>
                    {t("amountNotSet")}
                  </span>
                ),
            },
            {
              key: "status",
              label: t("columns.status"),
              render: (r) => {
                const sc = STATUS[r.status];
                const StatusIcon = sc.icon;
                return (
                  <StatusPill tone={sc.tone} className="whitespace-nowrap">
                    <StatusIcon className="h-3 w-3" aria-hidden="true" /> {t(`status.${r.status}`)}
                  </StatusPill>
                );
              },
            },
            {
              key: "createdAt",
              label: t("columns.requested"),
              hideOnMobile: true,
              render: (r) => <span className="whitespace-nowrap text-ink-2">{format(r.createdAt, "MMM d, yyyy")}</span>,
            },
            {
              key: "actions",
              label: t("columns.actions"),
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
              eyebrow={t("empty.eyebrow")}
              headline={status ? t("empty.headlineFiltered") : t("empty.headline")}
              body={status ? t("empty.bodyFiltered") : t("empty.body")}
              icon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                status ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/returns">{t("empty.action")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          footer={
            returns.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t.rich("footer.showing", {
                    shown: String(returns.length),
                    total: String(status ? countFor([status]) : totalRequests),
                    count: status ? countFor([status]) : totalRequests,
                    scope: status ? t("footer.scope", { status: t(`status.${status}`).toLowerCase() }) : "",
                    n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
                  })}
                </span>
                <span>{t("footer.newest", { count: String(PAGE_SIZE) })}</span>
              </div>
            ) : undefined
          }
        />
      </div>
    </AdminLayout>
  );
}
