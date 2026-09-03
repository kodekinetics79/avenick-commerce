import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSupplierPerformance } from "@avenick/database";
import {
  CellGrid, EmptyState, LedgerTable, Meter, PageHeader, Stat, StatusPill, Surface, TierMark,
} from "@avenick/ui";
import { TrendingUp, Star, RotateCcw, Award, AlertTriangle, Store } from "lucide-react";

export const metadata = { title: "Supplier Performance" };
export const dynamic = "force-dynamic";

/**
 * The score bands are the one place colour is allowed to carry meaning on this
 * screen: it is a state, not decoration. Everything else that used to be
 * coloured here — a purple tier chip, a yellow one, a blue one, a grey one, an
 * amber star — carried no information at all and is now type and depth.
 */
type ScoreTone = "success" | "warning" | "danger";
const scoreTone = (s: number): ScoreTone => (s >= 85 ? "success" : s >= 70 ? "warning" : "danger");

// GMV is SUM(order total) as recorded in each order's own currency; nothing is
// converted, so no currency symbol is attached to the figure.
const amount = (n: number) => n.toLocaleString("en", { maximumFractionDigits: 0 });

/** Enum → label. The tier is rendered as stored; nothing here invents a rank. */
const TIER_LABEL: Record<string, string> = {
  PLATINUM: "Platinum",
  GOLD: "Gold",
  VERIFIED: "Verified",
  STANDARD: "Standard",
};

export default async function PerformancePage() {
  await requireAdminSession();

  const suppliers = await getSupplierPerformance();
  const avg = suppliers.length > 0 ? Math.round(suppliers.reduce((s, x) => s + x.score, 0) / suppliers.length) : 0;
  const atRisk = suppliers.filter((s) => s.score < 70).length;
  const withOnTime = suppliers.filter((s) => s.onTimePct !== null);
  const avgOnTime = withOnTime.length > 0 ? Math.round(withOnTime.reduce((s, x) => s + (x.onTimePct ?? 0), 0) / withOnTime.length) : null;
  const avgReturn = suppliers.length > 0 ? Math.round((suppliers.reduce((s, x) => s + x.returnRate, 0) / suppliers.length) * 10) / 10 : 0;

  return (
    <AdminLayout>
      <div className="space-y-section">
        <PageHeader
          eyebrow="Supplier network"
          title="Supplier Performance"
          description="Scorecards computed from live orders, shipments, returns, reviews, and listing health."
          dateline="Weights: listing health 40 · on-time delivery 30 · rating 20 · returns 10. A reporting view — no score on this screen can be edited."
          actions={<StatusPill>Read only</StatusPill>}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label="Avg supplier score"
            value={suppliers.length > 0 ? avg : "—"}
            unit={suppliers.length > 0 ? "/100" : undefined}
            rank="section"
            icon={Award}
            chip={suppliers.length > 0 ? scoreTone(avg) : "neutral"}
            note={suppliers.length > 0 ? `Across ${suppliers.length} active supplier${suppliers.length === 1 ? "" : "s"}` : undefined}
          />
          <Stat
            label="Avg on-time delivery"
            value={avgOnTime !== null ? avgOnTime : "—"}
            unit={avgOnTime !== null ? "%" : undefined}
            icon={TrendingUp}
            chip="neutral"
            // Suppliers with no delivered shipment have no on-time figure, so the
            // average is over a smaller set than the table shows. Say which.
            dateline={
              avgOnTime !== null
                ? `Over the ${withOnTime.length} supplier${withOnTime.length === 1 ? "" : "s"} with a recorded delivery`
                : "No supplier has a recorded delivery yet"
            }
          />
          <Stat label="Avg return rate" value={avgReturn} unit="%" icon={RotateCcw} chip="neutral" />
          <Stat
            label="Suppliers at risk"
            value={atRisk}
            icon={AlertTriangle}
            chip={atRisk > 0 ? "danger" : "neutral"}
            note="Scoring below 70"
          />
        </CellGrid>

        {atRisk > 0 && (
          <Surface rung={2} tone="danger" className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">
              <span className="font-medium">{atRisk} supplier{atRisk === 1 ? "" : "s"}</span> scoring below 70 — review
              listing health, delivery reliability, and return rates.
            </p>
          </Surface>
        )}

        <LedgerTable
          title="Scorecards"
          dateline="One row per active supplier, ordered as the service returns them."
          stickyHead
          rows={suppliers}
          getRowKey={(s) => s.id}
          density="compact"
          columns={[
            {
              key: "name",
              label: "Supplier",
              render: (s) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-ink-1">{s.name}</span>
                  {/* Brass is scarce and STANDARD is the default, so only a tier
                      that actually distinguishes a supplier earns a mark. */}
                  {s.tier && s.tier !== "STANDARD" && (
                    <TierMark tier={s.tier} label={TIER_LABEL[s.tier] ?? s.tier} className="shrink-0" />
                  )}
                </span>
              ),
            },
            {
              key: "score",
              label: "Score",
              width: "168px",
              // A <div>, not a <span>: <Meter> renders a div, and a div is not
              // legal inside phrasing content.
              render: (s) => (
                <div className="flex items-center gap-2">
                  <Meter
                    className="min-w-[5rem] flex-1"
                    value={s.score}
                    tone={scoreTone(s.score)}
                    label={`${s.name} score: ${s.score} of 100`}
                  />
                  <span className="fig w-7 text-end text-ink-1">{s.score}</span>
                </div>
              ),
            },
            { key: "gmv", label: "GMV (as recorded)", numeric: true, render: (s) => amount(s.gmv) },
            { key: "orders", label: "Orders", numeric: true, width: "80px" },
            {
              key: "onTimePct",
              label: "On-time",
              numeric: true,
              width: "88px",
              hideOnMobile: true,
              render: (s) => (s.onTimePct !== null ? `${s.onTimePct}%` : "—"),
            },
            {
              key: "returnRate",
              label: "Return rate",
              numeric: true,
              width: "104px",
              hideOnMobile: true,
              render: (s) => `${s.returnRate}%`,
            },
            {
              key: "health",
              label: "Listing health",
              numeric: true,
              width: "120px",
              hideOnMobile: true,
              render: (s) => (s.health !== null ? `${s.health}/100` : "—"),
            },
            {
              key: "rating",
              label: "Rating",
              align: "end",
              width: "96px",
              hideOnMobile: true,
              // A supplier with no reviews has no rating; the service returns
              // null and the cell says so rather than printing a zero.
              render: (s) =>
                s.rating !== null ? (
                  <span className="inline-flex items-center gap-1 text-ink-1">
                    <Star className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                    <span className="fig">{s.rating}</span>
                  </span>
                ) : (
                  <span className="text-ink-3">No reviews</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline="No active supplier has a scorecard yet."
              body="A supplier appears here once their account is active; the score is computed from their own orders, shipments, returns, reviews and listing health."
              icon={<Store className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
