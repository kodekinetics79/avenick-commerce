"use client";

import * as React from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
  Button, CellGrid, Dateline, Divider, EmptyState, Eyebrow, FieldWell,
  LedgerTable, Meter, Num, SectionHeader, SpecularSurface, Stat, StatusPill, Surface, TierMark,
  type StatDelta,
} from "@avenick/ui";
import type { ExecutiveKpis } from "@avenick/database";
import { cn } from "@avenick/utils";
import {
  TrendingUp, TrendingDown, Building2, Users, Store, ShoppingCart, Coins, Truck,
  Boxes, FileQuestion, ArrowRight, Circle, Plus, UserPlus, Megaphone, Tag,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingDown, Truck, FileQuestion, ShoppingCart, Boxes, Coins,
};

const QUICK_ACTIONS = [
  { label: "Create RFQ", icon: Plus, href: "/rfqs" },
  { label: "Invite supplier", icon: UserPlus, href: "/sellers/pending" },
  { label: "Launch campaign", icon: Megaphone, href: "/campaigns" },
  { label: "Warehouse queue", icon: Boxes, href: "/warehouse/pickpack" },
];

// The KPI contract is the service's own declaration (a type-only import, so
// nothing from the database package reaches the client bundle). A trend is a
// month-over-month percentage, or null when the service did not measure one;
// a local copy of the interface would be a second place for that to drift.
interface ExecData {
  kpis: ExecutiveKpis;
  revenueSplit: { b2b: number; b2c: number };
  rfqFunnel: { stage: string; count: number; color: string }[];
  orderLifecycle: { stage: string; count: number; color: string }[];
  topCategories: { name: string; gmv: number; share: number }[];
  topSuppliers: { name: string; gmv: number; orders: number; rating: number; tier: string }[];
  aiRecommendations: { icon: string; iconStyle: string; title: string; description: string; confidence: number; tag: string; tagStyle: string; actionLabel: string; actionHref: string }[];
  operationalHealth: { label: string; value: number; severity: string; href: string }[];
}

interface TopCustomer { id: string; name: string; totalOrders: number; totalSpent: number; type: string }

export interface DashboardViewProps {
  exec: ExecData;
  topCustomers: TopCustomer[];
  gmvMonth: number;
  activeCompanies: number;
  activeSuppliers: number;
  pendingCount: number;
}

/* ── Reusable bits ─────────────────────────────────────── */

/**
 * A month-over-month delta, in the shape <Stat> renders it. Direction comes from
 * the sign of the number, never from a hard-coded "up" flag: an earlier version
 * painted every KPI green with an up arrow regardless of the value. A measured
 * 0 is a flat month and reads as one — neither green nor red.
 *
 * The window being compared is stated once, as the panel's dateline, rather than
 * hidden in a title attribute on each badge where no keyboard or screen-reader
 * user would ever reach it.
 */
function trendOf(percent: number): StatDelta {
  if (percent === 0) return { value: "0%", direction: "flat", tone: "neutral" };
  const up = percent > 0;
  return { value: `${up ? "+" : ""}${percent}%`, direction: up ? "up" : "down", tone: up ? "success" : "danger" };
}

/**
 * Order totals are summed as recorded in each order's own currency; nothing is
 * converted. Labelling that sum "AED" would be a claim the data does not
 * support, so amounts are shown as plain numbers with a disclosure below.
 */
function amount(n: number): string {
  return n.toLocaleString("en", { maximumFractionDigits: 0 });
}

/** A signal on the attention ledger: one live count and where to go about it. */
interface Signal {
  key: string;
  label: string;
  note?: string;
  value: number;
  href: string;
  /** "warning" and "danger" are the two states that need a person. */
  tone: "danger" | "warning" | "neutral";
}

export function DashboardView({ exec, topCustomers, gmvMonth, activeCompanies, activeSuppliers, pendingCount }: DashboardViewProps) {
  const k = exec.kpis;

  // The service reports null for any trend it did not measure — no prior
  // month to compare against, or a figure it never compares at all — and the
  // card says so instead of showing a badge. A 0 that does arrive is a
  // measured flat month and is shown as one.
  const revenueKpis: { label: string; value: string; icon: React.ElementType; trend: number | null; rank: "hero" | "section" }[] = [
    // Labels are short enough to survive the micro-caps step without being
    // truncated: losing "· this month" would turn a monthly figure into an
    // unqualified one, which is exactly the kind of quiet untruth this codebase
    // spent a hardening programme removing.
    // Section rank, not hero. The masthead already spends this page's one
    // hero-rank figure on the count that needs a person, and a console that
    // shouts its revenue as loudly as its alarms has told the operator nothing
    // about which to read first.
    { label: "GMV · this month", value: amount(gmvMonth), icon: TrendingUp, trend: k.gmvTrend, rank: "section" },
    // The service computes the B2B/B2C split and commission over all paid
    // orders, not the current month, so the labels say so; each trend is that
    // channel's own month-over-month movement.
    { label: "B2B revenue · all time", value: amount(k.b2bRevenue), icon: Building2, trend: k.b2bTrend, rank: "section" },
    { label: "B2C revenue · all time", value: amount(k.b2cRevenue), icon: ShoppingCart, trend: k.b2cTrend, rank: "section" },
    { label: "Commission · all time", value: amount(k.commission), icon: Coins, trend: k.commissionTrend, rank: "section" },
  ];

  const countKpis: { label: string; value: string | number; unit?: string; icon: React.ElementType }[] = [
    { label: "Active companies", value: activeCompanies || k.activeCompanies, icon: Building2 },
    { label: "B2C customers", value: k.activeCustomers.toLocaleString(), icon: Users },
    { label: "Active suppliers", value: activeSuppliers || k.activeSuppliers, icon: Store },
    { label: "RFQ conversion", value: k.rfqConversion, unit: "%", icon: FileQuestion },
    { label: "Fulfillment rate", value: k.fulfillmentRate, unit: "%", icon: TrendingUp },
    { label: "Warehouse use", value: k.warehouseUtilization, unit: "%", icon: Boxes },
  ];

  // One ledger for everything that might need a person, instead of the three
  // separate shapes this page used to render the same signals in. The service's
  // severity is "warn" or "ok" and nothing else — the previous version tested
  // for "danger", which never arrives, so every healthy row was painted amber.
  const signals: Signal[] = [
    ...exec.operationalHealth.map<Signal>((item) => ({
      key: item.label,
      label: item.label,
      value: item.value,
      href: item.href,
      tone: item.severity === "warn" ? "warning" : "neutral",
    })),
    // The service counts paid orders still CONFIRMED/PROCESSING past its own
    // age threshold; no SLA is published, so none is claimed here.
    { key: "delayed", label: "Delayed orders", note: "paid, still awaiting shipment", value: k.delayedOrders, href: "/orders?status=PROCESSING", tone: "danger" as const },
    { key: "disputes", label: "Open disputes", note: "awaiting resolution", value: k.openDisputes, href: "/disputes", tone: "danger" as const },
  ]
    // A danger signal at zero is not a signal; a health row at zero still is,
    // because "0 open tickets" is a reading an operator came here to take.
    .filter((s) => s.tone !== "danger" || s.value > 0)
    .sort((a, b) => Number(b.tone !== "neutral") - Number(a.tone !== "neutral"));

  const flagged = signals.filter((s) => s.tone !== "neutral").length;

  const revTotal = exec.revenueSplit.b2b + exec.revenueSplit.b2c;
  const b2bPct = revTotal > 0 ? Math.round((exec.revenueSplit.b2b / revTotal) * 100) : 0;
  const rfqMax = Math.max(1, ...exec.rfqFunnel.map((s) => s.count));
  const lifeMax = Math.max(1, ...exec.orderLifecycle.map((s) => s.count));
  const catMax = Math.max(1, ...exec.topCategories.map((c) => c.share));

  return (
    <AdminLayout pendingCount={pendingCount}>
      {/* Sections are separated by --space-section (32px in admin) while the
          grids inside them use 16px, so the page has a real rhythm: a section
          break reads as bigger than a card break. space-y-block would have made
          both 16px, which is a stack of undifferentiated slabs. */}
      <div className="space-y-section">
        {/* THE MASTHEAD, and the one place on this page with real range.
            Round one set the whole console at document scale: a 44px title over
            a 15px lead, and every other block within one order of magnitude of
            it. That is not restraint, it is a page with no dynamics — and it is
            why an operator opening this screen has to READ it to find out
            whether anything is wrong.

            So the composition states the reading instead. The band is still
            RECESSED, because it is context; the ATTENTION PLATE inside it is the
            single rung-3 surface on the page, because it is the one raised,
            actionable object here and law A is read off elevation before it is
            read off colour. The page title deliberately steps down to h2 rank:
            the enormous thing on a console is the number that needs a person,
            not the name of the screen. Two 44px blocks side by side are the same
            rank twice, which is exactly the failure the seven-lever rule names.

            Nothing here is invented. The figure is a count of rows already on
            this page, and the sentence beneath it says what was counted. */}
        <FieldWell className="p-4">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-end">
            <div className="min-w-0 lg:col-span-7">
              <Eyebrow>Platform operations</Eyebrow>
              <h1 className="u-h2 mt-1 text-ink-1">Executive Command Center</h1>
              <p className="u-body mt-1.5 max-w-prose text-ink-2">
                Marketplace performance across B2B and B2C — revenue, suppliers, fulfillment, and rule-based actions.
              </p>
              <Dateline className="mt-2">
                Every figure on this page is read from the platform database at request time.
              </Dateline>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
                  <Button key={label} variant="secondary" size="sm" asChild>
                    <Link href={href}>
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>

            {/* The rung-3 plate, and the console's ONE lit object.

                `rim` is the fresnel shoulder — admin carries the strongest
                shoulders of the three portals despite being the calmest,
                because at a 32px row height a console has to separate its
                objects with material, having no space to separate them with.

                <SpecularSurface> is the whole admin specular budget spent here
                and nowhere else: the portal posture allows one pointer-tracked
                surface, the single hero KPI, and this is it. It writes --mx/--my
                at most once a frame and early-RETURNS before attaching any
                listener at all on a coarse pointer or under reduced motion, so
                on a phone the handler is never registered. Never a table row —
                forty rows tracking a pointer is a composite storm. */}
            <SpecularSurface className="lg:col-span-5">
              <Surface rung={3} rim specular className="h-full p-4">
                <Eyebrow tone={flagged > 0 ? "brass" : "muted"}>Needs a person now</Eyebrow>
                {/* <Num>, not a hand-set figure: it is the structural guarantee
                    that a digit is never the animated element. A count that ticks
                    up is a count an operator cannot trust. */}
                <Num value={flagged} rank="hero" className="mt-1 block text-ink-1" />
                {/* No denominator here on purpose. `signals` has already had
                    the danger rows sitting at zero filtered out of it, so
                    `signals.length` is the number of rows the table below
                    happens to show, not the number of things this console
                    watches — quoting it as "of the N this console tracks" would
                    state a total that shrinks whenever the platform gets
                    healthier. The ledger under it carries the denominator, where
                    it is the true one. */}
                <p className="u-provenance mt-1 text-ui text-ink-2">
                  {flagged > 0
                    ? `${flagged === 1 ? "One signal" : `${flagged} signals`} on this console ${flagged === 1 ? "is" : "are"} flagged right now.`
                    : "No signal on this console is flagged right now."}
                </p>
                {/* The flagged signals themselves, at metadata rank, each one a
                    route to the screen that resolves it. The 3px inline-start rule
                    is the system's one gesture in another posture — always
                    present, only its colour changes, so nothing reflows. */}
                {flagged > 0 ? (
                  <ul className="mt-3 space-y-px">
                    {signals
                      .filter((s) => s.tone !== "neutral")
                      .slice(0, 4)
                      .map((s) => (
                        <li key={s.key}>
                          <Link
                            href={s.href}
                            className={cn(
                              "u-focus u-state-wash flex items-baseline gap-2 rounded-nested border-s-[3px] py-1 ps-2.5 pe-1.5",
                              s.tone === "danger" ? "border-s-danger" : "border-s-warning",
                            )}
                          >
                            <span className="u-ui min-w-0 flex-1 truncate text-ink-1">{s.label}</span>
                            <span className="fig u-ui shrink-0 font-medium text-ink-1">{s.value}</span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="u-meta mt-3 text-ink-3">
                    Seller applications, support tickets, stock lines and unfulfilled paid orders are all inside their
                    thresholds.
                  </p>
                )}
              </Surface>
            </SpecularSurface>
          </div>
        </FieldWell>

        {/* The full ledger behind the reading above. It stays a table because an
            operator works it row by row; the masthead only states its headline. */}
        <section aria-label="Operational signals">
          <SectionHeader
            title="Operational signals"
            description={
              flagged > 0
                ? `${flagged} of ${signals.length} ${flagged === 1 ? "needs" : "need"} attention.`
                : `${signals.length} tracked, none currently flagged.`
            }
            dateline="Live counts of seller applications, support tickets, stock lines and unfulfilled paid orders."
          />
          <LedgerTable
            rows={signals}
            getRowKey={(s) => s.key}
            density="compact"
            // Every row reserves the 3px rule and only a flagged one colours it
            // in — the same construction .u-commit uses, so marking a row can
            // never reflow the rows under it, and the flagged ones are findable
            // in a scan without reading a word.
            rowProps={(s) => ({
              className: cn(
                "border-s-[3px]",
                s.tone === "danger" ? "border-s-danger" : s.tone === "warning" ? "border-s-warning" : "border-s-transparent",
              ),
            })}
            columns={[
              {
                key: "label",
                label: "Signal",
                render: (s) => (
                  <>
                    <Link
                      href={s.href}
                      className="u-focus rounded-nested font-medium text-ink-1 underline-offset-4 hover:underline"
                    >
                      {s.label}
                    </Link>
                    {s.note && <span className="u-meta ms-1.5 text-ink-3">{s.note}</span>}
                  </>
                ),
              },
              { key: "value", label: "Count", numeric: true, width: "96px" },
              {
                key: "tone",
                label: "State",
                align: "end",
                width: "128px",
                render: (s) => (
                  <StatusPill tone={s.tone} dot={s.tone !== "neutral"}>
                    {s.tone === "neutral" ? "Clear" : "Needs attention"}
                  </StatusPill>
                ),
              },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing flagged"
                headline="No operational signal is currently being tracked."
                body="Seller applications, support tickets, stock lines and unfulfilled paid orders appear here as soon as the platform records any."
              />
            }
          />
        </section>

        {/* Rule-derived actions. The old cards carried a "Confidence 100%" meter
            on every row — a confidence score for a deterministic count, which is
            exactly the sort of claim this codebase spent a hardening programme
            removing. The provenance line below says what these actually are. */}
        <section aria-label="Recommended actions">
          <SectionHeader
            title="Recommended actions"
            dateline="Derived by fixed rules from the live counts above. No model is involved and nothing here is a prediction."
            action={
              <Link href="/ai-insights" className="u-focus u-ui rounded-nested text-primary-ink underline-offset-4 hover:underline">
                AI status
              </Link>
            }
          />
          {exec.aiRecommendations.length === 0 ? (
            <Surface rung={2}>
              <EmptyState
                eyebrow="No rule triggered"
                headline="Nothing needs routing right now."
                body="A recommendation appears here when seller applications, unfulfilled paid orders, low stock lines or unassigned RFQs cross their thresholds."
              />
            </Surface>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {exec.aiRecommendations.map((rec) => {
                // A plain mark, not a brain: the service only ever emits the six
                // names above, and a fallback that implied a model would contradict
                // the provenance line directly beneath this heading.
                const Icon = ICON_MAP[rec.icon] ?? Circle;
                return (
                  // The whole card is the link. Raised = actionable, so it sits
                  // at rung 2 and crosses to 3 on hover; nothing is nested inside
                  // the anchor that would itself be interactive, which is what
                  // keeps a single tab stop per recommendation.
                  <Link key={rec.title} href={rec.actionHref} className="u-focus block rounded-lg no-underline">
                    <Surface rung={2} interactive className="flex h-full items-start gap-3 p-4">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-nested bg-neutral-soft text-ink-3">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="u-ui font-medium text-ink-1">{rec.title}</span>
                          {/* The tag names a domain, not a severity, so it is
                              neutral — the four raw hues it used to carry
                              (amber / blue / red / purple) said nothing. */}
                          {rec.tag && <StatusPill>{rec.tag}</StatusPill>}
                        </span>
                        <span className="u-meta mt-1 block text-ink-2">{rec.description}</span>
                        <span className="u-meta mt-2 inline-flex items-center gap-1 font-medium text-primary-ink">
                          {rec.actionLabel}
                          {/* A direction-implying icon must flip in Arabic. */}
                          <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />
                        </span>
                      </span>
                    </Surface>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* The money. One panel divided by hairlines, not four floating cards,
            with the month's GMV promoted to hero rank so the grid has an
            unmistakable first reading. */}
        <section aria-label="Recorded revenue">
          <SectionHeader title="Recorded revenue" />
          <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
            {revenueKpis.map((kpi) => (
              <Stat
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                rank={kpi.rank}
                icon={kpi.icon}
                delta={kpi.trend !== null ? trendOf(kpi.trend) : undefined}
                // Nothing was recorded in the previous month, so there is no
                // delta to state. An empty corner would let the reader assume
                // "flat"; saying what was withheld costs one line.
                deltaWithheld={kpi.trend === null ? "No prior-month figure" : undefined}
              />
            ))}
          </CellGrid>
          <Dateline className="mt-2">
            Paid order totals summed as recorded in each order&apos;s own currency; no conversion between currencies is
            applied. Deltas compare this month so far against the previous whole month.
          </Dateline>
        </section>

        {/* Point-in-time counts, at inline rank so they read as subordinate to
            the revenue panel above rather than competing with it. */}
        <section aria-label="Platform counts">
          <SectionHeader title="Platform counts" />
          <CellGrid cols={{ base: 2, sm: 3, lg: 6 }} density="compact">
            {countKpis.map((kpi) => (
              <Stat key={kpi.label} label={kpi.label} value={kpi.value} unit={kpi.unit} icon={kpi.icon} />
            ))}
          </CellGrid>
          <Dateline className="mt-2">Point-in-time counts and ratios; no prior period is compared.</Dateline>
        </section>

        {/* Flow. Thirty divs of hand-rolled segment bars, each carrying a raw
            bg-green-500 / bg-amber-500 / bg-purple-500, are now one <Meter> per
            reading: a recessed track with a raised fill, scaled on X from the
            inline start so it is correct in Arabic without a mirrored rule. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Surface rung={2} className="p-4">
            <SectionHeader title="Revenue split" description="B2B against B2C, as recorded" />
            <Num value={amount(revTotal)} rank="section" />
            <Eyebrow className="mt-0.5">Total recorded</Eyebrow>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="u-ui text-ink-2">B2B</span>
                  <span className="fig u-ui text-ink-1">{amount(exec.revenueSplit.b2b)} · {b2bPct}%</span>
                </div>
                <Meter className="mt-1.5" value={exec.revenueSplit.b2b} max={Math.max(1, revTotal)} tone="accent" label="B2B share of recorded revenue" />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="u-ui text-ink-2">B2C</span>
                  <span className="fig u-ui text-ink-1">{amount(exec.revenueSplit.b2c)} · {revTotal > 0 ? 100 - b2bPct : 0}%</span>
                </div>
                <Meter className="mt-1.5" value={exec.revenueSplit.b2c} max={Math.max(1, revTotal)} tone="accent" index={1} label="B2C share of recorded revenue" />
              </div>
            </div>
          </Surface>

          <Surface rung={2} className="p-4">
            <SectionHeader
              title="RFQ funnel"
              description="Submitted through accepted"
              action={
                <Link href="/rfqs" className="u-focus u-meta rounded-nested text-primary-ink underline-offset-4 hover:underline">
                  View
                </Link>
              }
            />
            <div className="space-y-2.5">
              {exec.rfqFunnel.map((s, i) => (
                <div key={s.stage}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="u-meta text-ink-2">{s.stage}</span>
                    <span className="fig u-meta text-ink-1">{s.count}</span>
                  </div>
                  <Meter className="mt-1" value={s.count} max={rfqMax} tone="accent" size="sm" index={i} label={`${s.stage}: ${s.count}`} />
                </div>
              ))}
            </div>
          </Surface>

          <Surface rung={2} className="p-4">
            <SectionHeader
              title="Order lifecycle"
              description="Active pipeline"
              action={
                <Link href="/orders" className="u-focus u-meta rounded-nested text-primary-ink underline-offset-4 hover:underline">
                  View
                </Link>
              }
            />
            <div className="space-y-2.5">
              {exec.orderLifecycle.map((s, i) => (
                <div key={s.stage}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="u-meta text-ink-2">{s.stage}</span>
                    <span className="fig u-meta text-ink-1">{s.count}</span>
                  </div>
                  <Meter className="mt-1" value={s.count} max={lifeMax} tone="accent" size="sm" index={i} label={`${s.stage}: ${s.count}`} />
                </div>
              ))}
            </div>
          </Surface>
        </div>

        {/* Three ledgers. Each one now has to declare an empty state, which is
            what the hand-rolled divide-y lists could silently skip. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LedgerTable
            title="Top categories"
            dateline="By share of recorded GMV"
            rows={exec.topCategories}
            getRowKey={(c) => c.name}
            density="compact"
            columns={[
              {
                key: "name",
                label: "Category",
                render: (c) => (
                  <>
                    <span className="block truncate text-ink-1">{c.name}</span>
                    <Meter className="mt-1" value={c.share} max={catMax} tone="accent" size="sm" label={`${c.name}: ${c.share}% of recorded GMV`} />
                  </>
                ),
              },
              { key: "share", label: "Share", numeric: true, width: "64px", render: (c) => `${c.share}%` },
              { key: "gmv", label: "GMV", numeric: true, render: (c) => amount(c.gmv) },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No category has recorded GMV yet."
                body="A category appears here once a paid order contains a product in it."
                icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />

          <LedgerTable
            title="Top suppliers"
            dateline="By recorded GMV, as stored"
            toolbar={
              <Link href="/sellers" className="u-focus u-meta rounded-nested text-primary-ink underline-offset-4 hover:underline">
                All suppliers
              </Link>
            }
            rows={exec.topSuppliers}
            getRowKey={(s) => s.name}
            density="compact"
            columns={[
              {
                key: "name",
                label: "Supplier",
                render: (s) => (
                  <>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-ink-1">{s.name}</span>
                      {/* Tier is brass, and brass is scarce: only the tiers that
                          mean something get a mark. STANDARD is the default and
                          says nothing, so it earns none. */}
                      {s.tier && s.tier !== "STANDARD" && <TierMark tier={s.tier} className="shrink-0" />}
                    </span>
                    {/* The service returns 0 when a supplier has no reviews, and
                        0 is not a rating. Round one printed "No reviews" on
                        every row instead — technically true, and it turned a
                        five-row supplier ledger into a column of absence whose
                        loudest signal was that nobody has reviewed anyone.
                        Truth does not require printing the same null five times:
                        the slot simply is not there until a rating exists. */}
                    {s.rating > 0 && <span className="u-meta block text-ink-3">Rated {s.rating}</span>}
                  </>
                ),
              },
              { key: "orders", label: "Orders", numeric: true, width: "72px" },
              { key: "gmv", label: "GMV", numeric: true, render: (s) => amount(s.gmv) },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No supplier has recorded GMV yet."
                body="A supplier appears here once one of their orders is paid."
                icon={<Store className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />

          <LedgerTable
            title="Top customers"
            dateline="By recorded spend, as stored"
            toolbar={
              <Link href="/crm" className="u-focus u-meta rounded-nested text-primary-ink underline-offset-4 hover:underline">
                CRM
              </Link>
            }
            rows={topCustomers.slice(0, 5)}
            getRowKey={(c) => c.id}
            density="compact"
            columns={[
              {
                key: "name",
                label: "Customer",
                render: (c) => (
                  <>
                    <span className="block truncate text-ink-1">{c.name}</span>
                    <span className="u-meta block text-ink-3">{c.totalOrders} orders</span>
                  </>
                ),
              },
              {
                key: "type",
                label: "Type",
                align: "end",
                width: "72px",
                render: (c) => <StatusPill tone={c.type === "B2B" ? "accent" : "neutral"}>{c.type}</StatusPill>,
              },
              { key: "totalSpent", label: "Spend", numeric: true, render: (c) => amount(c.totalSpent) },
            ]}
            empty={
              <EmptyState
                eyebrow="Nothing recorded"
                headline="No customer has recorded spend yet."
                body="A customer appears here once one of their orders is paid."
                icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            }
          />
        </div>

        {/* The one rule on the page that is not a table's own: it closes the
            console the way a printed report closes, rather than the content
            simply stopping. */}
        <Divider tone="hairline" />
        {/* <Dateline>, not a hand-written .u-provenance paragraph: the
            provenance voice has a component, and a page that reimplements it
            locally is where a second dialect starts. */}
        <Dateline className="pb-2">
          Figures are read from the platform database when this page is requested. Nothing on this screen is cached,
          estimated or projected.
        </Dateline>
      </div>
    </AdminLayout>
  );
}
