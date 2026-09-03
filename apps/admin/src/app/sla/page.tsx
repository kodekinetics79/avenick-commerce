import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSlaMetrics } from "@avenick/database";
import { Clock, Truck, AlertTriangle, LifeBuoy, Gauge } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Button, CellGrid, EmptyState, LedgerTable, PageHeader, Stat, StatusPill,
} from "@avenick/ui";

export const metadata = { title: "SLA Monitor" };
export const dynamic = "force-dynamic";

type Metrics = Awaited<ReturnType<typeof getSlaMetrics>>;
type AgingTicket = Metrics["oldestOpen"][number];
type LateShipment = Metrics["lateShipments"][number];

export default async function SlaPage() {
  await requireAdminSession();

  const m = await getSlaMetrics();

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Support"
          // The nav entry, the registry and this title all say SLA Monitor, and
          // they stay in step. The correction belongs in what the page CLAIMS,
          // not in what it is called.
          title="SLA Monitor"
          description="Support turnaround and delivery promise-keeping, measured from the live ticket and shipment registers. No service level is contracted or published — these are measurements, not a scorecard."
          actions={<StatusPill>Read only</StatusPill>}
          /* LAW E, and a correction. Round one closed this page with the line
             "SLA targets: first response < 4h, resolution < 24h, delivery by
             promise date". No first-response time is measured anywhere in this
             platform, and no service level is published or contracted — 24h is
             the WINDOW this figure is counted over, not a target it is being
             held to. The dashboard already refuses to claim an SLA for exactly
             this reason; the page named after them cannot claim three. What is
             stated here is only what the query actually counts. */
          dateline="Counted from SupportTicket and Shipment at request time. The 24-hour figure is the share of already-resolved tickets closed within a day of being opened; it is a measurement window, not a published service level. A shipment is on time when it was delivered on or before a promise date it actually carries."
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label="Open tickets"
            value={m.openTickets}
            icon={LifeBuoy}
            chip={m.openTickets > 0 ? "warning" : "neutral"}
          />
          <Stat
            label="Resolved within 24h"
            value={m.resolvedWithin24hPct ?? "—"}
            unit={m.resolvedWithin24hPct !== null ? "%" : undefined}
            icon={Clock}
            // A withheld figure is stated as withheld. An em dash with no
            // explanation reads as zero to anyone scanning the band.
            deltaWithheld={m.resolvedWithin24hPct === null ? "No ticket has been resolved yet" : undefined}
          />
          <Stat
            label="Delivered on time"
            value={m.onTimeDeliveryPct ?? "—"}
            unit={m.onTimeDeliveryPct !== null ? "%" : undefined}
            icon={Truck}
            note={m.onTimeDeliveryPct !== null ? `Across ${m.deliveredShipments.toLocaleString()} delivered shipments` : undefined}
            deltaWithheld={m.onTimeDeliveryPct === null ? "No shipment has been delivered yet" : undefined}
          />
          <Stat
            label="Past promise date"
            value={m.lateShipments.length}
            icon={AlertTriangle}
            chip={m.lateShipments.length > 0 ? "danger" : "neutral"}
            note="Undelivered, promise date already passed"
          />
        </CellGrid>

        <div className="grid grid-cols-1 gap-block xl:grid-cols-2">
          <LedgerTable<AgingTicket>
            title="Oldest open tickets"
            dateline="Tickets in OPEN or IN_PROGRESS, oldest first · at most 10 loaded"
            toolbar={
              <Link href="/support" className="u-focus u-meta rounded-nested text-primary-ink underline-offset-4 hover:underline">
                All tickets
              </Link>
            }
            rows={m.oldestOpen}
            getRowKey={(t) => t.id}
            density="compact"
            columns={[
              {
                key: "subject",
                label: "Ticket",
                render: (t) => (
                  <Link href={`/support/${t.id}`} className="u-focus block min-w-0 rounded-nested">
                    <span className="block truncate font-medium text-ink-1">{t.subject}</span>
                    <span className="u-meta block truncate text-ink-3">
                      <span className="u-mono">{t.ticketNumber}</span> · {t.user.firstName} {t.user.lastName}
                    </span>
                  </Link>
                ),
              },
              {
                key: "priority",
                label: "Priority",
                width: "96px",
                render: (t) => (
                  <StatusPill tone={t.priority === "URGENT" ? "danger" : t.priority === "HIGH" ? "warning" : "neutral"}>
                    {t.priority}
                  </StatusPill>
                ),
              },
              {
                key: "age",
                label: "Open for",
                align: "end",
                width: "120px",
                render: (t) => <span className="tnum text-ink-2">{formatDistanceToNow(t.createdAt)}</span>,
              },
            ]}
            empty={
              <EmptyState
                eyebrow="Queue clear"
                headline="No ticket is open."
                body="A ticket appears here the moment a customer files one and stays until it is resolved or closed."
              />
            }
          />

          <LedgerTable<LateShipment>
            title="Shipments past their promise date"
            dateline="Undelivered shipments carrying a promise date that has already passed · at most 10 loaded"
            rows={m.lateShipments}
            getRowKey={(s) => s.id}
            density="compact"
            columns={[
              {
                key: "shipment",
                label: "Shipment",
                render: (s) => (
                  <>
                    <span className="u-mono block truncate text-ink-1">{s.shipmentNumber}</span>
                    <span className="u-meta u-mono block truncate text-ink-3">{s.order.orderNumber}</span>
                  </>
                ),
              },
              {
                key: "seller",
                label: "Supplier",
                hideOnMobile: true,
                render: (s) => (
                  <>
                    <span className="block truncate text-ink-2">{s.seller.businessNameEn}</span>
                    {/* No carrier recorded is a fact about the shipment, and it
                        is the one an operator chasing it needs first. */}
                    <span className="u-meta block truncate text-ink-3">{s.carrier ?? "No carrier recorded"}</span>
                  </>
                ),
              },
              {
                key: "promised",
                label: "Promised",
                align: "end",
                width: "112px",
                render: (s) => (
                  <span className="tnum text-danger-ink">{s.promisedBy ? format(s.promisedBy, "MMM d") : "—"}</span>
                ),
              },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing overdue"
                headline="No undelivered shipment has passed a promise date."
                body="Only shipments that carry a promise date can appear here; one without a date is never counted as late."
              />
            }
          />
        </div>

        {/* The page's own closing state, rather than a stray sentence of fine
            print: when neither register has anything in it there is genuinely
            nothing to work, and saying so is the reading an operator opened this
            screen to take. */}
        {m.openTickets === 0 && m.lateShipments.length === 0 && (
          <EmptyState
            variant="certificate"
            glyph={<Gauge />}
            eyebrow="Nothing outstanding"
            headline="No ticket is open and no shipment has passed a promise date."
            body="This is the whole of what this screen watches. It is a reading of the two live registers, taken when the page was requested — not a cached summary and not a health score."
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/dashboard">Back to the command center</Link>
              </Button>
            }
          />
        )}
      </div>
    </AdminLayout>
  );
}
