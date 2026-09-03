import { requireSellerPermission } from "@/lib/auth";
import { SellerLayout } from "@/components/layout/seller-layout";
import {
  computeSellerPerformanceScore,
  db,
  MIN_ORDER_ITEMS_FOR_SCORE,
  MIN_RFQS_FOR_SCORE,
  PERFORMANCE_WINDOW_DAYS,
} from "@avenick/database";
import {
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  Meter,
  Num,
  PageHeader,
  SectionHeader,
  Stat,
  Surface,
} from "@avenick/ui";
import { TrendingUp, RotateCcw, MessageSquare, Star, Truck } from "lucide-react";
import { ColumnChart } from "../analytics/column-chart";

export const metadata = { title: "Performance" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Every figure on this page is measured from the seller's own records or is
 * shown as "—". There are no targets, no "platform average" and no colouring
 * by threshold: the platform publishes no benchmark, and the "illustrative
 * marketplace averages" this page used to print (91% on-time, 2.8% returns,
 * 3.5h response) were invented numbers presented as a comparison.
 */
export default async function PerformancePage() {
  const { seller, membership } = await requireSellerPermission("analytics.view");

  const [sellerOrders, deliveredShipments, returnsCount, threads, performance, reviews] = await Promise.all([
    db.order.findMany({ where: { items: { some: { sellerId: seller.id } } }, select: { createdAt: true } }),
    db.shipment.findMany({ where: { sellerId: seller.id, status: "DELIVERED", promisedBy: { not: null } }, select: { deliveredAt: true, promisedBy: true } }),
    db.returnRequest.count({ where: { sellerId: seller.id } }),
    db.messageThread.findMany({ where: { sellerId: seller.id, firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true } }),
    // The real score (paid lines shipped, listing health, current compliance
    // documents over a rolling window), or null when there is too little
    // activity to state one. SellerProfile.accountHealth is never recomputed
    // and is not used here.
    computeSellerPerformanceScore(seller.id),
    // SellerProfile.rating / reviewCount are columns nothing in the application
    // writes (the seed no longer does either), so they are not a measurement. The rating is
    // aggregated from the reviews buyers actually left on this seller's products.
    db.productReview.aggregate({ where: { product: { sellerId: seller.id } }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const reviewCount = reviews._count._all;

  const totalOrders = sellerOrders.length;

  // On-time delivery — only stated once at least one delivered shipment carried
  // a promised date; "100%" with nothing delivered was a claim, not a measurement.
  const onTimeCount = deliveredShipments.filter((s) => s.deliveredAt && s.promisedBy && s.deliveredAt <= s.promisedBy).length;
  const onTimeDelivery = deliveredShipments.length > 0 ? Math.round((onTimeCount / deliveredShipments.length) * 100) : null;

  // Return rate — requires at least one order to be a rate of anything.
  const returnRate = totalOrders > 0 ? Math.round((returnsCount / totalOrders) * 1000) / 10 : null;

  // Avg first-response time (hours) across threads that received a reply.
  const responseHours = threads.length > 0
    ? Math.round((threads.reduce((s, t) => s + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) / threads.length / 3600000) * 10) / 10
    : null;

  const rating = reviewCount > 0 && reviews._avg.rating !== null ? Number(reviews._avg.rating) : null;

  // Monthly order trend (last 6 months)
  const now = new Date();
  const trend: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = sellerOrders.filter((o) => o.createdAt.getMonth() === d.getMonth() && o.createdAt.getFullYear() === d.getFullYear()).length;
    trend.push({ label: MONTHS[d.getMonth()]!, count });
  }
  const metrics = [
    {
      label: "On-time delivery",
      value: onTimeDelivery === null ? "—" : `${onTimeDelivery}%`,
      basis: deliveredShipments.length > 0 ? `${onTimeCount} of ${deliveredShipments.length} delivered shipments with a promised date` : "No delivered shipments with a promised date yet",
      icon: Truck,
    },
    {
      label: "Return rate",
      value: returnRate === null ? "—" : `${returnRate}%`,
      basis: totalOrders > 0 ? `${returnsCount} return request${returnsCount === 1 ? "" : "s"} across ${totalOrders} order${totalOrders === 1 ? "" : "s"}` : "No orders yet",
      icon: RotateCcw,
    },
    {
      label: "Avg first response",
      value: responseHours === null ? "—" : `${responseHours}h`,
      basis: threads.length > 0 ? `Across ${threads.length} buyer thread${threads.length === 1 ? "" : "s"} you replied to` : "No buyer threads answered yet",
      icon: MessageSquare,
    },
    {
      label: "Buyer rating",
      value: rating === null ? "—" : rating.toFixed(1),
      basis: reviewCount > 0 ? `From ${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No reviews yet",
      icon: Star,
    },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions} performance={performance}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Overview"
          title="Performance"
          description="Measured from your own orders, shipments, returns, and messages"
          dateline="No target, no platform average and no colouring by threshold — the platform publishes no benchmark"
        />

        {/* Score — the computed score or an honest "not enough data". The old
            hero was a gradient panel with a blurred orb behind it; the figure is
            now carried by rank and by a recessed meter instead. */}
        <Surface rung={2} className="p-5 sm:p-6">
          {performance === null ? (
            <EmptyState
              eyebrow="Not enough data"
              headline="There is no performance score for this account yet."
              body={`A score needs at least ${MIN_ORDER_ITEMS_FOR_SCORE} paid order lines or ${MIN_RFQS_FOR_SCORE} quoted RFQs in the last ${PERFORMANCE_WINDOW_DAYS} days. Everything further down this page is measured and shown regardless; the score is the only figure that waits.`}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div className="min-w-0">
                  <Eyebrow>Performance score</Eyebrow>
                  <div className="mt-1">
                    <Num value={performance.score} unit="/100" rank="hero" />
                  </div>
                </div>
                {/* Recessed track, raised fill. No red/amber/green banding: the
                    platform publishes no threshold, so colouring the number
                    would state a judgement nothing behind it supports. */}
                <Meter
                  className="min-w-[14rem] flex-1"
                  value={performance.score}
                  tone="accent"
                  size="lg"
                  label={`Performance score: ${performance.score} out of 100`}
                />
              </div>
              <Dateline className="mt-3">
                Orders from the last {performance.windowDays} days; listings and documents as they stand now
              </Dateline>
              <p className="u-ui mt-1 text-ink-2">The score has no effect on commission or ranking.</p>

              <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                {performance.components.map((component, index) => (
                  <div key={component.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <Eyebrow className="truncate">{component.label}</Eyebrow>
                      <span className="fig u-meta shrink-0 text-ink-1">
                        {component.share === null ? "—" : `${Math.round(component.share * 100)}%`}
                      </span>
                    </div>
                    <Meter
                      className="mt-1.5"
                      value={component.share ?? 0}
                      max={1}
                      tone="accent"
                      index={index}
                      label={`${component.label}: ${component.share === null ? "no data in this window" : `${component.good} of ${component.total}`}`}
                    />
                    <p className="u-meta mt-1 text-ink-3">
                      {component.share === null ? "No data in this window" : `${component.good} of ${component.total}`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Surface>

        {/* Metric cells — each value with the exact basis it was computed from,
            as a Dateline rather than as 11px grey fine print. A metric with no
            basis reads "—" and says why underneath. */}
        <section aria-label="Service metrics">
          <SectionHeader title="Service metrics" description="Each figure is either measured or shown as “—”. None of them feeds the score above." />
          <CellGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {metrics.map((m) => (
              <Stat key={m.label} label={m.label} value={m.value} rank="section" icon={m.icon} dateline={m.basis} />
            ))}
          </CellGrid>
        </section>

        {/* Monthly order trend */}
        <Surface rung={2} className="p-5">
          <SectionHeader
            icon={TrendingUp}
            title="Monthly orders"
            dateline="Orders containing a line of yours, by the month they were placed · last six calendar months"
          />
          <ColumnChart
            label="Orders by month"
            plotHeight="h-36"
            data={trend.map((m) => ({
              label: m.label,
              value: m.count,
              caption: m.count > 0 ? m.count.toLocaleString() : "—",
              exact: `${m.count} order${m.count === 1 ? "" : "s"}`,
            }))}
          />
        </Surface>
      </div>
    </SellerLayout>
  );
}
