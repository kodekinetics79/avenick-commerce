import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getPickPackQueue } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Truck, PackageCheck, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.pickpack");
  return { title: t("meta.title") };
}
export const dynamic = "force-dynamic";

/** Tone per in-flight shipment status; labels come from `pickpack.shipmentStatus`. */
const SHIPMENT_TONE: Record<string, PillTone> = {
  PENDING: "warning",
  PICKED_UP: "neutral",
  IN_TRANSIT: "neutral",
  OUT_FOR_DELIVERY: "neutral",
};

export default async function PickPackPage() {
  await requireAdminSession();
  const t = await getTranslations("adminCommerce.pickpack");

  const { queue, shipments } = await getPickPackQueue();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: t("breadcrumbWarehouse"), href: "/warehouse" }, { label: t("breadcrumbSelf") }]}
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label={t("stats.queue")} value={queue.length} rank="section" />
          <CountStat
            label={t("stats.units")}
            value={queue.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0)}
          />
          <CountStat label={t("stats.shipments")} value={shipments.length} />
          <CountStat
            label={t("stats.withoutShipment")}
            value={queue.filter((o) => o.shipments.length === 0).length}
            tone={queue.filter((o) => o.shipments.length === 0).length > 0 ? "danger" : "default"}
            note={t("stats.withoutShipmentNote")}
          />
        </CellGrid>

        {/* Fulfilment queue */}
        <LedgerTable
          title={t("queue.title")}
          dateline={t("queue.dateline")}
          toolbar={<span className="u-meta text-ink-3">{t("queue.toolbar")}</span>}
          rows={queue}
          getRowKey={(o) => o.id}
          stickyHead
          // Hover deepens the same hue rather than replacing the wash.
          rowProps={(o) => ({ className: o.shipments.length === 0 ? "bg-warning-soft hover:bg-warning/10" : undefined })}
          columns={[
            {
              key: "order",
              label: t("queue.columns.order"),
              render: (o) => (
                <div className="py-1">
                  <Link
                    href={`/orders/${o.id}`}
                    className="u-focus u-mono rounded-nested text-meta font-medium text-primary-ink hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <p className="u-meta text-ink-3">{o.type} · {o.status}</p>
                </div>
              ),
            },
            {
              key: "age",
              label: t("queue.columns.age"),
              render: (o) => (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-2">
                  <Clock className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" /> {formatDistanceToNow(o.createdAt)}
                </span>
              ),
            },
            {
              key: "customer",
              label: t("queue.columns.customer"),
              hideOnMobile: true,
              render: (o) => <span className="text-ink-2">{o.user.firstName} {o.user.lastName}</span>,
            },
            {
              key: "items",
              label: t("queue.columns.items"),
              hideOnMobile: true,
              render: (o) => (
                <p className="max-w-xs truncate text-ink-2">
                  {o.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                  {o.items.length > 2 ? t("queue.moreItems", { count: String(o.items.length - 2) }) : ""}
                </p>
              ),
            },
            {
              key: "value",
              label: t("queue.columns.value"),
              numeric: true,
              render: (o) => <Num value={formatCurrency(Number(o.total), o.currency as never)} className="whitespace-nowrap" />,
            },
            {
              key: "shipment",
              label: t("queue.columns.shipment"),
              render: (o) =>
                o.shipments.length > 0 ? (
                  <StatusPill tone="success">
                    {t("queue.shipmentCount", { count: o.shipments.length, value: String(o.shipments.length) })}
                  </StatusPill>
                ) : (
                  <StatusPill tone="danger">{t("queue.notShipped")}</StatusPill>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("queue.emptyEyebrow")}
              headline={t("queue.emptyHeadline")}
              body={t("queue.emptyBody")}
              icon={<PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />

        {/* Active shipments */}
        <LedgerTable
          title={t("shipments.title")}
          dateline={t("shipments.dateline")}
          rows={shipments}
          getRowKey={(s) => s.id}
          stickyHead
          columns={[
            { key: "shipmentNumber", label: t("shipments.columns.shipment"), render: (s) => <span className="u-mono text-meta font-medium text-ink-1">{s.shipmentNumber}</span> },
            { key: "order", label: t("shipments.columns.order"), render: (s) => <span className="u-mono text-meta text-ink-2">{s.order.orderNumber}</span> },
            { key: "seller", label: t("shipments.columns.seller"), render: (s) => <span className="text-ink-2">{s.seller.businessNameEn}</span> },
            { key: "carrier", label: t("shipments.columns.carrier"), hideOnMobile: true, render: (s) => <span className="text-ink-2">{s.carrier ?? "—"}</span> },
            { key: "tracking", label: t("shipments.columns.tracking"), hideOnMobile: true, render: (s) => <span className="u-mono text-meta text-ink-3">{s.trackingNumber ?? "—"}</span> },
            {
              key: "status",
              label: t("shipments.columns.status"),
              render: (s) => {
                // A status this screen does not model is shown by its own code
                // rather than under an invented label.
                const tone = SHIPMENT_TONE[s.status];
                return (
                  <StatusPill tone={tone ?? "neutral"} className="whitespace-nowrap">
                    {tone ? t(`shipmentStatus.${s.status}`) : s.status}
                  </StatusPill>
                );
              },
            },
            {
              key: "promisedBy",
              label: t("shipments.columns.promised"),
              hideOnMobile: true,
              render: (s) => <span className="whitespace-nowrap text-ink-2">{s.promisedBy ? format(s.promisedBy, "MMM d, yyyy") : "—"}</span>,
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("shipments.emptyEyebrow")}
              headline={t("shipments.emptyHeadline")}
              body={t("shipments.emptyBody")}
              icon={<Truck className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
