import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getPickPackQueue } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { Truck, PackageCheck, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

export const metadata = { title: "Pick & Pack" };
export const dynamic = "force-dynamic";

const SHIPMENT_STATUS: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: "Pending pickup", tone: "warning" },
  PICKED_UP: { label: "Picked up", tone: "neutral" },
  IN_TRANSIT: { label: "In transit", tone: "neutral" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "neutral" },
};

export default async function PickPackPage() {
  await requireAdminSession();

  const { queue, shipments } = await getPickPackQueue();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: "Warehouse", href: "/warehouse" }, { label: "Pick & pack" }]}
          eyebrow="Operations"
          title="Pick & pack queue"
          description="Paid orders awaiting fulfilment, oldest first, plus shipments in the carrier network."
          dateline="Order values in the currency each order was billed in · no conversion applied"
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="Orders in queue" value={queue.length} rank="section" />
          <CountStat
            label="Units to pick"
            value={queue.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0)}
          />
          <CountStat label="Active shipments" value={shipments.length} />
          <CountStat
            label="Without shipment"
            value={queue.filter((o) => o.shipments.length === 0).length}
            tone={queue.filter((o) => o.shipments.length === 0).length > 0 ? "danger" : "default"}
            note="paid, but nothing booked with a carrier"
          />
        </CellGrid>

        {/* Fulfilment queue */}
        <LedgerTable
          title="Awaiting fulfilment"
          dateline="Paid orders that have not shipped, oldest first"
          toolbar={<span className="u-meta text-ink-3">FIFO · oldest first</span>}
          rows={queue}
          getRowKey={(o) => o.id}
          stickyHead
          // Hover deepens the same hue rather than replacing the wash.
          rowProps={(o) => ({ className: o.shipments.length === 0 ? "bg-warning-soft hover:bg-warning/10" : undefined })}
          columns={[
            {
              key: "order",
              label: "Order",
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
              label: "Age",
              render: (o) => (
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-2">
                  <Clock className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" /> {formatDistanceToNow(o.createdAt)}
                </span>
              ),
            },
            {
              key: "customer",
              label: "Customer",
              hideOnMobile: true,
              render: (o) => <span className="text-ink-2">{o.user.firstName} {o.user.lastName}</span>,
            },
            {
              key: "items",
              label: "Items",
              hideOnMobile: true,
              render: (o) => (
                <p className="max-w-xs truncate text-ink-2">
                  {o.items.slice(0, 2).map((i) => `${i.quantity}× ${i.nameEn}`).join(", ")}
                  {o.items.length > 2 ? ` +${o.items.length - 2} more` : ""}
                </p>
              ),
            },
            {
              key: "value",
              label: "Value",
              numeric: true,
              render: (o) => <Num value={formatCurrency(Number(o.total), o.currency as never)} className="whitespace-nowrap" />,
            },
            {
              key: "shipment",
              label: "Shipment",
              render: (o) =>
                o.shipments.length > 0 ? (
                  <StatusPill tone="success">
                    {o.shipments.length} shipment{o.shipments.length === 1 ? "" : "s"}
                  </StatusPill>
                ) : (
                  <StatusPill tone="danger">Not shipped</StatusPill>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Queue is clear"
              headline="No paid order is awaiting fulfilment."
              body="An order joins this queue as soon as its payment is confirmed and it has not yet shipped."
              icon={<PackageCheck className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />

        {/* Active shipments */}
        <LedgerTable
          title="Active shipments"
          dateline="Shipments currently in the carrier network"
          rows={shipments}
          getRowKey={(s) => s.id}
          stickyHead
          columns={[
            { key: "shipmentNumber", label: "Shipment", render: (s) => <span className="u-mono text-meta font-medium text-ink-1">{s.shipmentNumber}</span> },
            { key: "order", label: "Order", render: (s) => <span className="u-mono text-meta text-ink-2">{s.order.orderNumber}</span> },
            { key: "seller", label: "Seller", render: (s) => <span className="text-ink-2">{s.seller.businessNameEn}</span> },
            { key: "carrier", label: "Carrier", hideOnMobile: true, render: (s) => <span className="text-ink-2">{s.carrier ?? "—"}</span> },
            { key: "tracking", label: "Tracking", hideOnMobile: true, render: (s) => <span className="u-mono text-meta text-ink-3">{s.trackingNumber ?? "—"}</span> },
            {
              key: "status",
              label: "Status",
              render: (s) => {
                const cfg = SHIPMENT_STATUS[s.status] ?? { label: s.status, tone: "neutral" as PillTone };
                return <StatusPill tone={cfg.tone} className="whitespace-nowrap">{cfg.label}</StatusPill>;
              },
            },
            {
              key: "promisedBy",
              label: "Promised",
              hideOnMobile: true,
              render: (s) => <span className="whitespace-nowrap text-ink-2">{s.promisedBy ? format(s.promisedBy, "MMM d, yyyy") : "—"}</span>,
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing in transit"
              headline="No shipment is currently in the carrier network."
              body="A shipment appears here once fulfilment books one against an order."
              icon={<Truck className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
