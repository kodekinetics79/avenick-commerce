import { requireSellerAnyPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import { db } from "@avenick/database";
import Link from "next/link";
import { format } from "date-fns";
import { advanceShipment } from "./actions";
import {
  PageHeader,
  Surface,
  CellGrid,
  Stat,
  StatusPill,
  Eyebrow,
  Dateline,
  Divider,
  EmptyState,
  Button,
  type PillTone,
} from "@avenick/ui";
import { Truck, Package, CheckCircle2, MapPin, ArrowRight } from "lucide-react";

export const metadata = { title: "Shipments" };

/**
 * Every ShipmentStatus in the schema, with the label a seller reads and the tone
 * it maps to. The seven raw wash colours this map used to carry — including a
 * hardcoded `bg-amber-500/15 text-amber-600 dark:text-amber-400` — had no dark
 * counterpart for the two soft washes and no shared vocabulary with the rest of
 * the portal. Tone names do both jobs in one place.
 */
const STATUS: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: "Pending", tone: "neutral" },
  PICKED_UP: { label: "Picked up", tone: "accent" },
  IN_TRANSIT: { label: "In transit", tone: "primary" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "warning" },
  DELIVERED: { label: "Delivered", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  RETURNED: { label: "Returned", tone: "neutral" },
};

/**
 * The carrier state machine, in the order actions.ts is permitted to advance it.
 * Drawn from one list so the rail on the card and the button that moves it can
 * never disagree about what comes next.
 */
const STAGES = ["PENDING", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

const NEXT_LABEL: Record<string, { verb: string; target: string }> = {
  PENDING: { verb: "Mark picked up", target: "PICKED_UP" },
  PICKED_UP: { verb: "Mark in transit", target: "IN_TRANSIT" },
  IN_TRANSIT: { verb: "Out for delivery", target: "OUT_FOR_DELIVERY" },
  OUT_FOR_DELIVERY: { verb: "Mark delivered", target: "DELIVERED" },
};

const fmt = (d: Date | null) => (d ? format(d, "MMM d · HH:mm") : "—");

export default async function ShipmentsPage() {
  const { seller, membership } = await requireSellerAnyPermission(["shipments.view", "shipments.manage"]);

  const shipments = await db.shipment.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: { select: { orderNumber: true } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  const inTransit = shipments.filter((s) => ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status)).length;
  const delivered = shipments.filter((s) => s.status === "DELIVERED").length;

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Fulfilment"
          title="Shipments"
          description="Track and update carrier progress for your orders."
          // LAW E. These three counts are computed from the 100 rows this query
          // takes, not from the seller's whole shipment history, and the tile
          // labelled "Total" used to read as if it were the latter.
          dateline={`Your ${shipments.length} most recent shipments · the counts below describe this view, not your full history`}
        />

        <CellGrid cols={{ base: 3 }}>
          <Stat label="In transit" value={inTransit} icon={Truck} chip={inTransit > 0 ? "warning" : "neutral"} />
          {/* Conditional, like the tile beside it: a success chip over a zero
              count colours an absence as an achievement. */}
          <Stat label="Delivered" value={delivered} icon={CheckCircle2} chip={delivered > 0 ? "success" : "neutral"} />
          <Stat label="Shown here" value={shipments.length} icon={Package} />
        </CellGrid>

        {shipments.length === 0 ? (
          <Surface rung={1}>
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No shipments have been created on your account."
              body="A shipment appears here once a confirmed order is released to a carrier."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">Review your orders</Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <ul className="space-y-3">
            {shipments.map((sh) => {
              const st = STATUS[sh.status] ?? { label: sh.status.replace(/_/g, " "), tone: "neutral" as PillTone };
              const next = NEXT_LABEL[sh.status];
              const stageIndex = (STAGES as readonly string[]).indexOf(sh.status);

              return (
                <li key={sh.id}>
                  <Surface rung={2} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mono is for identifiers. A shipment number is one. */}
                          <span className="u-mono text-ui font-medium text-ink-1">{sh.shipmentNumber}</span>
                          <StatusPill tone={st.tone} dot>{st.label}</StatusPill>
                        </div>
                        <p className="u-meta mt-1 text-ink-3">
                          Order <span className="u-mono text-ink-2">{sh.order.orderNumber}</span>
                          {" · "}
                          {sh.carrier ?? "Carrier not recorded"}
                          {sh.trackingNumber ? <> · <span className="u-mono text-ink-2">{sh.trackingNumber}</span></> : null}
                        </p>
                      </div>

                      {next && (
                        <form action={advanceShipment.bind(null, sh.id)} className="shrink-0 text-end">
                          {/* Secondary, not a primary fill. There can be a hundred
                              of these on one screen, and the portal's budget is a
                              single primary fill per view — but more to the point,
                              a wall of indigo buttons invites the misfire this
                              action must not have. Weight comes from naming the
                              destination state and from the line beneath saying
                              exactly what gets written. */}
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            aria-label={`${next.verb} for shipment ${sh.shipmentNumber}`}
                          >
                            {next.verb}
                            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                          </Button>
                          {/* u-meta, not u-micro: this is a sentence, and the
                              eyebrow step would uppercase it — turning the
                              status label it quotes into "PICKED UP", which no
                              longer matches the pill it is naming. ink-2 for the
                              same reason: ink-3 is reserved for labels and
                              metadata, never for prose. */}
                          <p className="u-meta mt-1.5 text-ink-2">
                            Records a {STATUS[next.target]?.label ?? next.target} event
                          </p>
                        </form>
                      )}
                    </div>

                    {/* THE CARRIER STATE MACHINE, at a glance. Five nodes, no
                        labels — the pill above already names the position — so a
                        supplier scanning a long list sees how far each shipment
                        has travelled without reading a word. A shipment that has
                        left the sequence (failed, returned) gets no rail, because
                        a five-step rail would imply a journey it is no longer on. */}
                    {stageIndex >= 0 ? (
                      <div
                        className="mt-3 flex items-center"
                        role="img"
                        aria-label={`Stage ${stageIndex + 1} of ${STAGES.length}: ${st.label}`}
                      >
                        {STAGES.map((stage, i) => (
                          <div key={stage} className="flex flex-1 items-center last:flex-none">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-pill ${
                                i < stageIndex ? "bg-success" : i === stageIndex ? "bg-ink-1" : "bg-border"
                              }`}
                              aria-hidden="true"
                            />
                            {i < STAGES.length - 1 && (
                              <span
                                className={`h-0.5 flex-1 ${i < stageIndex ? "bg-success" : "bg-border"}`}
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Dateline className="mt-2">
                        This shipment left the carrier sequence and is recorded as {st.label.toLowerCase()}
                      </Dateline>
                    )}

                    {sh.events.length > 0 && (
                      <>
                        <Divider className="my-3" />
                        <Eyebrow className="mb-2">Carrier events</Eyebrow>
                        <ol className="space-y-2">
                          {sh.events.map((ev, i) => (
                            <li key={ev.id} className="flex gap-2.5">
                              <span
                                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill ${i === 0 ? "bg-ink-1" : "bg-border"}`}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className={`u-ui ${i === 0 ? "text-ink-1" : "text-ink-2"}`}>
                                  {ev.note ?? (STATUS[ev.status]?.label ?? ev.status.replace(/_/g, " "))}
                                </p>
                                <p className="u-meta flex flex-wrap items-center gap-1 text-ink-3">
                                  {ev.location && (
                                    <>
                                      <MapPin className="h-3 w-3" aria-hidden="true" /> {ev.location} ·{" "}
                                    </>
                                  )}
                                  {/* A machine-readable timestamp beside the human
                                      one, and formatted through date-fns rather
                                      than a hardcoded "en-US" locale literal. */}
                                  <time dateTime={ev.createdAt.toISOString()}>{fmt(ev.createdAt)}</time>
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </Surface>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SellerLayout>
  );
}
