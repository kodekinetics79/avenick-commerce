import { getTranslations } from "next-intl/server";
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

// generateMetadata rather than a static object: a document title is a
// user-visible string, and a literal here read English at an Arabic desk.
export async function generateMetadata() {
  const t = await getTranslations("sellerOps");
  return { title: t("shipments.metaTitle") };
}

/**
 * Every ShipmentStatus in the schema, mapped to the tone it carries. The seven
 * raw wash colours this map used to carry — including a hardcoded
 * `bg-amber-500/15 text-amber-600 dark:text-amber-400` — had no dark counterpart
 * for the two soft washes and no shared vocabulary with the rest of the portal.
 * Tone names do both jobs in one place.
 *
 * The LABEL half of this map has moved to the message tree, at
 * sellerOps.shipments.status.<ENUM> — this is module scope and has no translator
 * in it, and a label a seller reads has to be able to be Arabic. The enum keys
 * stay exactly as the schema writes them.
 */
const STATUS_TONE: Record<string, PillTone> = {
  PENDING: "neutral",
  PICKED_UP: "accent",
  IN_TRANSIT: "primary",
  OUT_FOR_DELIVERY: "warning",
  DELIVERED: "success",
  FAILED: "danger",
  RETURNED: "neutral",
};

/**
 * The carrier state machine, in the order actions.ts is permitted to advance it.
 * Drawn from one list so the rail on the card and the button that moves it can
 * never disagree about what comes next.
 */
const STAGES = ["PENDING", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

// Current status → the status the button writes. The button's VERB for each
// current status is sellerOps.shipments.advance.<ENUM>, in the message tree for
// the same reason the labels are.
const NEXT_TARGET: Record<string, string> = {
  PENDING: "PICKED_UP",
  PICKED_UP: "IN_TRANSIT",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

const fmt = (d: Date | null) => (d ? format(d, "MMM d · HH:mm") : "—");

export default async function ShipmentsPage() {
  const t = await getTranslations("sellerOps");
  const { seller, membership } = await requireSellerAnyPermission(["shipments.view", "shipments.manage"]);

  /**
   * A status arrives as a string from this page's own query. An enum nobody has
   * named yet is still a fact about the shipment, so it is shown as it reads
   * rather than dropped or relabelled — the same rule the map above kept before
   * its labels moved into the message tree.
   */
  const statusLabel = (status: string) =>
    t.has(`shipments.status.${status}`) ? t(`shipments.status.${status}`) : status.replace(/_/g, " ");
  const statusTone = (status: string): PillTone => STATUS_TONE[status] ?? "neutral";

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
          eyebrow={t("shipments.eyebrow")}
          title={t("shipments.title")}
          description={t("shipments.description")}
          // LAW E. These three counts are computed from the 100 rows this query
          // takes, not from the seller's whole shipment history, and the tile
          // labelled "Total" used to read as if it were the latter.
          // `n` is the same figure as `count`, passed as a STRING: `count`
          // selects the plural form, and a bare number would render in the
          // locale's own numeral system where this product uses Western digits.
          dateline={t("shipments.dateline", { count: shipments.length, n: String(shipments.length) })}
        />

        <CellGrid cols={{ base: 3 }}>
          <Stat label={t("shipments.stats.inTransit")} value={inTransit} icon={Truck} chip={inTransit > 0 ? "warning" : "neutral"} />
          {/* Conditional, like the tile beside it: a success chip over a zero
              count colours an absence as an achievement. */}
          <Stat label={t("shipments.stats.delivered")} value={delivered} icon={CheckCircle2} chip={delivered > 0 ? "success" : "neutral"} />
          <Stat label={t("shipments.stats.shownHere")} value={shipments.length} icon={Package} />
        </CellGrid>

        {shipments.length === 0 ? (
          <Surface rung={1}>
            <EmptyState
              eyebrow={t("shipments.empty.eyebrow")}
              headline={t("shipments.empty.headline")}
              body={t("shipments.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/orders">{t("shipments.empty.action")}</Link>
                </Button>
              }
            />
          </Surface>
        ) : (
          <ul className="space-y-3">
            {shipments.map((sh) => {
              const stLabel = statusLabel(sh.status);
              const nextTarget = NEXT_TARGET[sh.status];
              const nextVerb = nextTarget ? t(`shipments.advance.${sh.status}`) : "";
              const stageIndex = (STAGES as readonly string[]).indexOf(sh.status);

              return (
                <li key={sh.id}>
                  <Surface rung={2} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Mono is for identifiers. A shipment number is one. */}
                          <span className="u-mono text-ui font-medium text-ink-1">{sh.shipmentNumber}</span>
                          <StatusPill tone={statusTone(sh.status)} dot>{stLabel}</StatusPill>
                        </div>
                        <p className="u-meta mt-1 text-ink-3">
                          {t("shipments.orderLabel")} <span className="u-mono text-ink-2">{sh.order.orderNumber}</span>
                          {" · "}
                          {sh.carrier ?? t("shipments.carrierNotRecorded")}
                          {sh.trackingNumber ? <> · <span className="u-mono text-ink-2">{sh.trackingNumber}</span></> : null}
                        </p>
                      </div>

                      {nextTarget && (
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
                            aria-label={t("shipments.advanceAria", { verb: nextVerb, number: sh.shipmentNumber })}
                          >
                            {nextVerb}
                            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                          </Button>
                          {/* u-meta, not u-micro: this is a sentence, and the
                              eyebrow step would uppercase it — turning the
                              status label it quotes into "PICKED UP", which no
                              longer matches the pill it is naming. ink-2 for the
                              same reason: ink-3 is reserved for labels and
                              metadata, never for prose. */}
                          <p className="u-meta mt-1.5 text-ink-2">
                            {t("shipments.recordsEvent", { status: statusLabel(nextTarget) })}
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
                        aria-label={t("shipments.railLabel", {
                          index: String(stageIndex + 1),
                          total: String(STAGES.length),
                          status: stLabel,
                        })}
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
                        {t("shipments.offSequence", { status: stLabel.toLowerCase() })}
                      </Dateline>
                    )}

                    {sh.events.length > 0 && (
                      <>
                        <Divider className="my-3" />
                        <Eyebrow className="mb-2">{t("shipments.eventsHeading")}</Eyebrow>
                        <ol className="space-y-2">
                          {sh.events.map((ev, i) => (
                            <li key={ev.id} className="flex gap-2.5">
                              <span
                                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill ${i === 0 ? "bg-ink-1" : "bg-border"}`}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className={`u-ui ${i === 0 ? "text-ink-1" : "text-ink-2"}`}>
                                  {/* ev.note is a stored record written at the
                                      time of the event, so it is shown verbatim;
                                      only the fallback — the event's own status —
                                      is read out of the message tree. */}
                                  {ev.note ?? statusLabel(ev.status)}
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
