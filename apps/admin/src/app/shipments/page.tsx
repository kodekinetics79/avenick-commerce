import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ShipmentStatus } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import Link from "next/link";
import { Truck, CheckCircle, Clock, AlertTriangle, Package, RotateCcw, CircleOff } from "lucide-react";
import { format } from "date-fns";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Surface, Num, Dateline, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat } from "@/app/finance/money-figures";

export const metadata = { title: "Shipments" };
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

const STATUS: Record<ShipmentStatus, { label: string; tone: PillTone; icon: typeof Truck }> = {
  PENDING: { label: "Pending pickup", tone: "warning", icon: Clock },
  PICKED_UP: { label: "Picked up", tone: "neutral", icon: Package },
  IN_TRANSIT: { label: "In transit", tone: "neutral", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "neutral", icon: Truck },
  DELIVERED: { label: "Delivered", tone: "success", icon: CheckCircle },
  FAILED: { label: "Failed", tone: "danger", icon: AlertTriangle },
  RETURNED: { label: "Returned", tone: "neutral", icon: RotateCcw },
};

const fmtDate = (d: Date | null) => (d ? format(d, "d MMM yyyy") : "—");

export default async function ShipmentsPage() {
  await requireAdminSession();

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
          eyebrow="Fulfilment"
          title="Shipments"
          description="Marketplace-wide outbound shipment oversight."
          dateline="Latest 100 shipment records · order value is the parent order's total, not the parcel's"
          actions={
            <>
              {shipments.length === 0 && (
                <StatusPill tone="neutral">
                  <CircleOff className="h-3.5 w-3.5" aria-hidden="true" /> No records
                </StatusPill>
              )}
              <Button variant="secondary" size="sm" asChild>
                <Link href="/warehouse/pickpack">
                  <Package className="h-3.5 w-3.5" aria-hidden="true" /> Pick &amp; pack queue
                </Link>
              </Button>
            </>
          }
        />

        {shipments.length === 0 ? (
          <Surface>
            <EmptyState
              eyebrow="Capability gap"
              headline="No shipment has ever been recorded."
              body="This is a capability gap, not a quiet day. Nothing in the platform creates a shipment record — not checkout, not order confirmation, not the seller portal — so carrier tracking, delivery dates and transit exceptions are unavailable marketplace-wide. The seller fulfilment screen can only advance a shipment that already exists."
              icon={<Truck className="h-3.5 w-3.5" aria-hidden="true" />}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/warehouse/pickpack">Open the pick &amp; pack queue</Link>
                </Button>
              }
            />
            <Dateline className="mx-auto max-w-desc px-6 pb-10 text-center">
              Paid orders awaiting fulfilment are real and visible in the pick &amp; pack queue. This register will
              populate on its own once fulfilment begins writing shipments.
            </Dateline>
          </Surface>
        ) : (
          <>
            <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
              <CountStat label="Pending pickup" value={countFor(["PENDING"])} tone={countFor(["PENDING"]) > 0 ? "warning" : "default"} />
              <CountStat label="In transit" value={countFor(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"])} />
              <CountStat label="Delivered" value={countFor(["DELIVERED"])} />
              <CountStat
                label="Failed"
                value={failed}
                tone={failed > 0 ? "danger" : "default"}
                note={failed > 0 ? "needs resolution to avoid order disputes" : undefined}
              />
            </CellGrid>

            {truncated && (
              <Dateline>
                Showing the 100 most recent shipments. The counts above cover only those, not the full shipment history.
              </Dateline>
            )}

            {failed > 0 && (
              <Surface role="status" tone="danger" className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-danger-ink" aria-hidden="true" />
                <p className="u-ui font-medium text-ink-1">
                  {failed} failed shipment{failed !== 1 ? "s" : ""} {failed !== 1 ? "need" : "needs"} resolution to avoid order disputes{truncated ? " (within the 100 most recent)" : ""}.
                </p>
              </Surface>
            )}

            <LedgerTable
              rows={shipments}
              getRowKey={(s) => s.id}
              stickyHead
              dateline="Order value is the parent order's total in its own currency — not this shipment's value when an order ships in more than one parcel"
              // The hover state deepens the same hue rather than letting the
              // generic row hover replace the wash that marks the failure.
              rowProps={(s) => ({ className: s.status === "FAILED" ? "bg-danger-soft hover:bg-danger/10" : undefined })}
              columns={[
                {
                  key: "shipmentNumber",
                  label: "Shipment",
                  render: (s) => (
                    <div className="py-1">
                      <p className="u-mono text-meta font-medium text-ink-1">{s.shipmentNumber}</p>
                      {s.events[0]?.location && <p className="u-meta mt-0.5 text-ink-3">{s.events[0].location}</p>}
                    </div>
                  ),
                },
                {
                  key: "order",
                  label: "Order",
                  render: (s) => <span className="u-mono text-meta text-ink-2">{s.order.orderNumber}</span>,
                },
                { key: "seller", label: "Seller", render: (s) => <span className="font-medium text-ink-1">{s.seller.businessNameEn}</span> },
                {
                  key: "buyer",
                  label: "Buyer",
                  hideOnMobile: true,
                  render: (s) => <span className="text-ink-2">{s.order.user.firstName} {s.order.user.lastName}</span>,
                },
                {
                  key: "carrier",
                  label: "Carrier",
                  hideOnMobile: true,
                  render: (s) => (
                    <div className="py-1">
                      <p className="text-ink-1">{s.carrier ?? <span className="text-ink-3">Not set</span>}</p>
                      {s.trackingNumber && <p className="u-mono u-meta text-ink-3">{s.trackingNumber}</p>}
                    </div>
                  ),
                },
                {
                  key: "value",
                  label: "Order value",
                  numeric: true,
                  // Shipment carries no value of its own; this is the parent order total, which
                  // is not the shipment's value when an order ships in more than one parcel.
                  render: (s) => (
                    <Num value={formatCurrency(Number(s.order.total), s.order.currency as never)} className="whitespace-nowrap" />
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (s) => {
                    const sc = STATUS[s.status];
                    const StatusIcon = sc.icon;
                    return (
                      <StatusPill tone={sc.tone} className="whitespace-nowrap">
                        <StatusIcon className="h-3 w-3" aria-hidden="true" /> {sc.label}
                      </StatusPill>
                    );
                  },
                },
                { key: "promisedBy", label: "Promised", hideOnMobile: true, render: (s) => <span className="whitespace-nowrap text-ink-2">{fmtDate(s.promisedBy)}</span> },
                { key: "deliveredAt", label: "Delivered", hideOnMobile: true, render: (s) => <span className="whitespace-nowrap text-ink-2">{fmtDate(s.deliveredAt)}</span> },
              ]}
              empty={
                <EmptyState
                  eyebrow="Nothing recorded"
                  headline="No shipment matches this view."
                  body="This register populates once fulfilment begins writing shipment records."
                />
              }
            />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
