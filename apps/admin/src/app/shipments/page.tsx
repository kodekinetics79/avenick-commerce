import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ShipmentStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Truck, CheckCircle, Clock, AlertTriangle, Package, RotateCcw, CircleOff } from "lucide-react";
import { format } from "date-fns";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Dateline, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.shipments");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/**
 * This page previously rendered four invented shipments — invented carriers,
 * tracking numbers, routes and values — under two status codes (PENDING_PICKUP,
 * EXCEPTION) that do not exist in the ShipmentStatus enum. An operator could not
 * tell that no shipment has ever been recorded.
 *
 * The Shipment and ShipmentEvent models exist, but no code path in the repository
 * creates a Shipment row — not the checkout flow, not the seller portal, not the
 * seed (which only deletes). apps/seller/src/app/shipments/actions.ts advances
 * rows it finds and returns early when there are none. So the table is empty and
 * stays empty until fulfilment learns to create shipments.
 *
 * The query below is real, so this page becomes correct the moment that happens.
 * Until then the empty state names the capability gap, because "no shipments
 * today" and "shipments are never recorded" mean very different things to an
 * operator and only the second one is true.
 */

/** Tone and icon per status; the label is translated from `shipments.status`. */
const STATUS: Record<ShipmentStatus, { tone: PillTone; icon: typeof Truck }> = {
  PENDING: { tone: "warning", icon: Clock },
  PICKED_UP: { tone: "neutral", icon: Package },
  IN_TRANSIT: { tone: "neutral", icon: Truck },
  OUT_FOR_DELIVERY: { tone: "neutral", icon: Truck },
  DELIVERED: { tone: "success", icon: CheckCircle },
  FAILED: { tone: "danger", icon: AlertTriangle },
  RETURNED: { tone: "neutral", icon: RotateCcw },
};

const fmtDate = (d: Date | null) => (d ? format(d, "d MMM yyyy") : "—");

export default async function ShipmentsPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.shipments");

  const shipments = await db.shipment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: {
        select: {
          orderNumber: true,
          total: true,
          currency: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      seller: { select: { businessNameEn: true } },
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const countFor = (statuses: ShipmentStatus[]) => shipments.filter((s) => statuses.includes(s.status)).length;
  const failed = countFor(["FAILED"]);
  // take: 100 above, so the tiles below count the loaded page, not all history.
  const truncated = shipments.length === 100;

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
          actions={
            <>
              {shipments.length === 0 && (
                <StatusPill tone="neutral">
                  <CircleOff className="h-3.5 w-3.5" aria-hidden="true" /> {t("noRecords")}
                </StatusPill>
              )}
              <Button variant="secondary" size="sm" asChild>
                <Link href="/warehouse/pickpack">
                  <Package className="h-3.5 w-3.5" aria-hidden="true" /> {t("pickpackLink")}
                </Link>
              </Button>
            </>
          }
        />

        {shipments.length === 0 ? (
          <Surface>
            <EmptyState
              eyebrow={t("gap.eyebrow")}
              headline={t("gap.headline")}
              body={t("gap.body")}
              icon={<Truck className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/warehouse/pickpack">{t("gap.action")}</Link>
                </Button>
              }
            />
            <Dateline className="mx-auto max-w-desc px-6 pb-10 text-center">{t("gap.note")}</Dateline>
          </Surface>
        ) : (
          <>
            <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
              <CountStat label={t("stats.pending")} value={countFor(["PENDING"])} tone={countFor(["PENDING"]) > 0 ? "warning" : "default"} />
              <CountStat label={t("stats.inTransit")} value={countFor(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"])} />
              <CountStat label={t("stats.delivered")} value={countFor(["DELIVERED"])} />
              <CountStat
                label={t("stats.failed")}
                value={failed}
                tone={failed > 0 ? "danger" : "default"}
                note={failed > 0 ? t("stats.failedNote") : undefined}
              />
            </CellGrid>

            {truncated && (
              <Dateline>{t("truncated")}</Dateline>
            )}

            {failed > 0 && (
              <Surface role="status" tone="danger" className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-danger-ink" aria-hidden="true" />
                <p className="u-ui font-medium text-ink-1">
                  {t("failedAlert", {
                    count: failed,
                    value: String(failed),
                    scope: truncated ? t("failedAlertScope") : "",
                  })}
                </p>
              </Surface>
            )}

            <LedgerTable
              rows={shipments}
              getRowKey={(s) => s.id}
              stickyHead
              dateline={t("table.dateline")}
              // The hover state deepens the same hue rather than letting the
              // generic row hover replace the wash that marks the failure.
              rowProps={(s) => ({ className: s.status === "FAILED" ? "bg-danger-soft hover:bg-danger/10" : undefined })}
              columns={[
                {
                  key: "shipmentNumber",
                  label: t("columns.shipment"),
                  render: (s) => (
                    <div className="py-1">
                      <p className="u-mono text-meta font-medium text-ink-1">{s.shipmentNumber}</p>
                      {s.events[0]?.location && <p className="u-meta mt-0.5 text-ink-3">{s.events[0].location}</p>}
                    </div>
                  ),
                },
                {
                  key: "order",
                  label: t("columns.order"),
                  render: (s) => <span className="u-mono text-meta text-ink-2">{s.order.orderNumber}</span>,
                },
                { key: "seller", label: t("columns.seller"), render: (s) => <span className="font-medium text-ink-1">{s.seller.businessNameEn}</span> },
                {
                  key: "buyer",
                  label: t("columns.buyer"),
                  hideOnMobile: true,
                  render: (s) => <span className="text-ink-2">{s.order.user.firstName} {s.order.user.lastName}</span>,
                },
                {
                  key: "carrier",
                  label: t("columns.carrier"),
                  hideOnMobile: true,
                  render: (s) => (
                    <div className="py-1">
                      <p className="text-ink-1">{s.carrier ?? <span className="text-ink-3">{t("carrierNotSet")}</span>}</p>
                      {s.trackingNumber && <p className="u-mono u-meta text-ink-3">{s.trackingNumber}</p>}
                    </div>
                  ),
                },
                {
                  key: "value",
                  label: t("columns.value"),
                  numeric: true,
                  // Shipment carries no value of its own; this is the parent order total, which
                  // is not the shipment's value when an order ships in more than one parcel.
                  render: (s) => (
                    <Num value={formatCurrency(Number(s.order.total), s.order.currency as never)} className="whitespace-nowrap" />
                  ),
                },
                {
                  key: "status",
                  label: t("columns.status"),
                  render: (s) => {
                    const sc = STATUS[s.status];
                    const StatusIcon = sc.icon;
                    return (
                      <StatusPill tone={sc.tone} className="whitespace-nowrap">
                        <StatusIcon className="h-3 w-3" aria-hidden="true" /> {t(`status.${s.status}`)}
                      </StatusPill>
                    );
                  },
                },
                { key: "promisedBy", label: t("columns.promised"), hideOnMobile: true, render: (s) => <span className="whitespace-nowrap text-ink-2">{fmtDate(s.promisedBy)}</span> },
                { key: "deliveredAt", label: t("columns.delivered"), hideOnMobile: true, render: (s) => <span className="whitespace-nowrap text-ink-2">{fmtDate(s.deliveredAt)}</span> },
              ]}
              empty={
                <EmptyState
                  eyebrow={t("empty.eyebrow")}
                  headline={t("empty.headline")}
                  body={t("empty.body")}
                />
              }
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
