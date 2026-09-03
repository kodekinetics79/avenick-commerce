import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { getSupplierPerformance } from "@avenick/database";
import {
  CellGrid, EmptyState, LedgerTable, Meter, PageHeader, Stat, StatusPill, Surface, TierMark,
} from "@avenick/ui";
import { TrendingUp, Star, RotateCcw, Award, AlertTriangle, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";

// generateMetadata rather than a static object: the tab title is user-visible
// copy and a module-scope constant has no translator in scope.
export async function generateMetadata() {
  const t = await getTranslations("adminShell.meta");
  return { title: t("performance") };
}
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

/**
 * The tier enum values this screen has a label for. The tier is rendered as
 * stored; nothing here invents a rank, and a value with no label falls back to
 * the stored string rather than to an invented one. The labels themselves live
 * under `adminShell.performance.tier`, keyed by the enum value.
 */
const KNOWN_TIERS = ["PLATINUM", "GOLD", "VERIFIED", "STANDARD"];

export default async function PerformancePage() {
  await requireAdminSession();
  const t = await getTranslations("adminShell.performance");

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
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline")}
          actions={<StatusPill>{t("readOnly")}</StatusPill>}
        />

        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <Stat
            label={t("avgScore")}
            value={suppliers.length > 0 ? avg : "—"}
            unit={suppliers.length > 0 ? "/100" : undefined}
            rank="section"
            icon={Award}
            chip={suppliers.length > 0 ? scoreTone(avg) : "neutral"}
            // The count goes in twice: as a number so ICU selects the plural form
            // — Arabic has six — and as a string so the digits stay Western
            // inside the Arabic sentence.
            note={
              suppliers.length > 0
                ? t("avgScoreNote", { count: suppliers.length, value: String(suppliers.length) })
                : undefined
            }
          />
          <Stat
            label={t("avgOnTime")}
            value={avgOnTime !== null ? avgOnTime : "—"}
            unit={avgOnTime !== null ? "%" : undefined}
            icon={TrendingUp}
            chip="neutral"
            // Suppliers with no delivered shipment have no on-time figure, so the
            // average is over a smaller set than the table shows. Say which.
            dateline={
              avgOnTime !== null
                ? t("avgOnTimeDateline", { count: withOnTime.length, value: String(withOnTime.length) })
                : t("avgOnTimeNone")
            }
          />
          <Stat label={t("avgReturnRate")} value={avgReturn} unit="%" icon={RotateCcw} chip="neutral" />
          <Stat
            label={t("atRisk")}
            value={atRisk}
            icon={AlertTriangle}
            chip={atRisk > 0 ? "danger" : "neutral"}
            note={t("atRiskNote")}
          />
        </CellGrid>

        {atRisk > 0 && (
          <Surface rung={2} tone="danger" className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-ink" aria-hidden="true" />
            <p className="u-ui text-ink-1">
              {t.rich("atRiskBanner", {
                count: atRisk,
                value: String(atRisk),
                strong: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </p>
          </Surface>
        )}

        <LedgerTable
          title={t("table.title")}
          dateline={t("table.dateline")}
          stickyHead
          rows={suppliers}
          getRowKey={(s) => s.id}
          density="compact"
          columns={[
            {
              key: "name",
              label: t("table.columnSupplier"),
              render: (s) => (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-ink-1">{s.name}</span>
                  {/* Brass is scarce and STANDARD is the default, so only a tier
                      that actually distinguishes a supplier earns a mark. */}
                  {s.tier && s.tier !== "STANDARD" && (
                    <TierMark
                      tier={s.tier}
                      label={KNOWN_TIERS.includes(s.tier) ? t(`tier.${s.tier}`) : s.tier}
                      className="shrink-0"
                    />
                  )}
                </span>
              ),
            },
            {
              key: "score",
              label: t("table.columnScore"),
              width: "168px",
              // A <div>, not a <span>: <Meter> renders a div, and a div is not
              // legal inside phrasing content.
              render: (s) => (
                <div className="flex items-center gap-2">
                  <Meter
                    className="min-w-[5rem] flex-1"
                    value={s.score}
                    tone={scoreTone(s.score)}
                    label={t("table.scoreMeter", { name: s.name, score: String(s.score) })}
                  />
                  <span className="fig w-7 text-end text-ink-1">{s.score}</span>
                </div>
              ),
            },
            { key: "gmv", label: t("table.columnGmv"), numeric: true, render: (s) => amount(s.gmv) },
            { key: "orders", label: t("table.columnOrders"), numeric: true, width: "80px" },
            {
              key: "onTimePct",
              label: t("table.columnOnTime"),
              numeric: true,
              width: "88px",
              hideOnMobile: true,
              render: (s) => (s.onTimePct !== null ? `${s.onTimePct}%` : "—"),
            },
            {
              key: "returnRate",
              label: t("table.columnReturnRate"),
              numeric: true,
              width: "104px",
              hideOnMobile: true,
              render: (s) => `${s.returnRate}%`,
            },
            {
              key: "health",
              label: t("table.columnHealth"),
              numeric: true,
              width: "120px",
              hideOnMobile: true,
              render: (s) => (s.health !== null ? `${s.health}/100` : "—"),
            },
            {
              key: "rating",
              label: t("table.columnRating"),
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
                  <span className="text-ink-3">{t("table.noReviews")}</span>
                ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("table.empty.eyebrow")}
              headline={t("table.empty.headline")}
              body={t("table.empty.body")}
              icon={<Store className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
        />
      </div>
    </AdminLayout>
  );
}
