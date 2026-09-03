import {
  computeSellerPerformanceScore,
  db,
  getSellerDashboard,
  MIN_ORDER_ITEMS_FOR_SCORE,
  MIN_RFQS_FOR_SCORE,
  PERFORMANCE_WINDOW_DAYS,
  SELLER_RFQ_INBOX_WHERE,
  UNASSIGNED_RFQ_OPEN_STATUSES,
} from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireSellerPermission } from "@/lib/auth";
import { orderStatusMeta } from "@/components/orders/status-meta";
import { cn, formatCurrency } from "@avenick/utils";
import {
  Button,
  CellGrid,
  Dateline,
  EmptyState,
  Eyebrow,
  LedgerTable,
  Meter,
  Num,
  PageHeader,
  SectionHeader,
  Stat,
  StatusPill,
  Surface,
} from "@avenick/ui";
import {
  Activity, AlertTriangle, Clock, CreditCard, FileCheck,
  MessageSquare, Package, ShoppingCart, Wallet, Zap,
} from "lucide-react";

/**
 * Month keys, not month names. The "Placed" column used to be formatted with
 * date-fns' "MMM d, yyyy", which prints an English abbreviation whatever the
 * locale — so the Arabic build carried "Jan 5, 2026" in an otherwise Arabic
 * table. The abbreviation now comes from sellerShell.months and the order of the
 * three parts from dashboard.recentOrders.placedOn, which each language sets for
 * itself. The parts are read with getMonth/getDate/getFullYear, the same local
 * timezone date-fns used, so the English rendering is unchanged.
 */
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

export default async function DashboardPage() {
  const { seller, membership } = await requireSellerPermission("dashboard.view");
  const t = await getTranslations("sellerShell");
  const [dash, expiringDocs, openRfqCount, performance] = await Promise.all([
    getSellerDashboard(seller.id),
    db.sellerDocument.count({
      where: {
        sellerId: seller.id,
        expiryDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86_400_000) },
      },
    }),
    // "Open RFQs" is the part of the /messages inbox that still wants a quote:
    // the rfq service's inbox predicate (what getRFQsForSeller lists, what
    // dash.rfqCount counts in full) narrowed to the statuses still open to a
    // quote — the rows that page flags "Needs response". The full inbox count
    // is not used here because it also holds every RFQ this seller already
    // claimed, whatever its status, and this card promises work to do.
    db.rFQRequest.count({
      where: {
        AND: [SELLER_RFQ_INBOX_WHERE(seller.id), { status: { in: [...UNASSIGNED_RFQ_OPEN_STATUSES] } }],
      },
    }),
    // SellerProfile.accountHealth is never recomputed (schema default 100; the
    // seed no longer writes it), so it is not shown anywhere. The score below is derived from the
    // seller's own paid orders, listings and current documents (RFQs quoted
    // count as activity, not as a component), and is null when there is too
    // little activity to state one honestly.
    computeSellerPerformanceScore(seller.id),
  ]);

  // getSellerDashboard sums order-line totals and pending payouts across every
  // currency the seller trades in, and this page used to print both of them as
  // "AED". A cross-currency sum labelled with one currency is a figure that
  // exists in no ledger — the same defect /analytics fixed by computing in the
  // seller's most-used currency. Neither sum can be attributed to a currency
  // here without changing what the service returns, so the figure is shown
  // without a currency code and the dateline beneath it says exactly why.
  const amount = (value: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  // Everything the seller can clear themselves. A count of zero carries no
  // information, so a cleared item leaves the panel rather than sitting there as
  // a zero tile; when all three are clear the panel is replaced by one line that
  // names precisely what was checked.
  const attention = [
    {
      key: "issues",
      label: t("dashboard.attention.issues.label"),
      value: dash.issueCount,
      href: "/issues",
      icon: AlertTriangle,
      chip: "danger" as const,
      note: t("dashboard.attention.issues.note"),
    },
    {
      key: "stock",
      label: t("dashboard.attention.stock.label"),
      value: dash.lowStockItems,
      href: "/inventory",
      icon: Zap,
      chip: "warning" as const,
      note: t("dashboard.attention.stock.note"),
    },
    {
      key: "expiring",
      label: t("dashboard.attention.expiring.label"),
      value: expiringDocs,
      href: "/documents",
      icon: FileCheck,
      chip: "warning" as const,
      // The count above is every document row carrying an expiry date inside the
      // window, whatever its review status — so attention.expiring.note says the
      // documents are "on file" and does not claim they are all approved.
      note: t("dashboard.attention.expiring.note"),
    },
  ].filter((item) => item.value > 0);

  // The system's :focus-visible ring is an OUTWARD two-stop box-shadow, and a
  // CellGrid cell fills its grid track inside an overflow-hidden panel — so on
  // these cells the ring is clipped away to nothing and a keyboard user sees no
  // focus at all. An outline at a negative offset draws the same --ring token
  // INSIDE the cell, where nothing can clip it. It is additive: wherever the
  // box-shadow ring is not clipped, both are drawn on the same 2px band.
  const CELL_FOCUS =
    "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

  // Work that is queued rather than wrong. "Documents in review" belongs here
  // and not in the panel above: a filed document is waiting on the platform, not
  // on the seller, and listing it under "Action required" asked the supplier to
  // do something they cannot do.
  const workload = [
    // Lines, not orders: getSellerDashboard counts orderItem rows, so a basket
    // holding three of this seller's lines is three here. Naming it "orders"
    // overstated the figure by however many lines a single basket held — the
    // same defect that made the old "Today's Orders" label wrong. Both labels
    // now live under dashboard.queue.* and dashboard.trading.*, and both say
    // "order lines" in either language.
    { key: "orders", label: t("dashboard.queue.orders.label"), value: dash.pendingOrders, href: "/orders", icon: Clock, note: t("dashboard.queue.orders.note") },
    { key: "rfqs", label: t("dashboard.queue.rfqs.label"), value: openRfqCount, href: "/messages", icon: Activity, note: t("dashboard.queue.rfqs.note") },
    { key: "messages", label: t("dashboard.queue.messages.label"), value: dash.unreadMessages, href: "/messages", icon: MessageSquare, note: t("dashboard.queue.messages.note") },
    { key: "compliance", label: t("dashboard.queue.compliance.label"), value: dash.pendingCompliance, href: "/compliance", icon: FileCheck, note: t("dashboard.queue.compliance.note") },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={dash.issueCount} unreadMessages={dash.unreadMessages} performance={performance} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow={t("dashboard.eyebrow")}
          title={seller.businessNameAr ?? seller.businessNameEn}
          description={seller.businessNameEn}
        />

        <OnboardingChecklist seller={seller} />

        {/* ══ THE MASTHEAD ══
            The one thing on this page with real scale.

            What was here was three CellGrids in a row — action required, trading,
            queue — every cell the same size, the same weight and the same ink, so
            nothing on the page could be subordinate to anything and a supplier
            opening it at 9am had to read all eleven figures to find the two that
            wanted them. A console does not get a hero rung (the portal token
            makes --fs-hero resolve to --fs-h1 by design), so the range comes from
            the FIGURE ladder instead: one number at hero rank, 46px against the
            12px metadata beside it, which is the same 3.8× the storefront gets
            from its display type.

            The score is the right figure to promote and the revenue sum is not:
            getSellerDashboard adds order-line totals ACROSS every currency the
            seller trades in, so that sum can carry no currency code — and an
            unlabelled cross-currency figure is the last thing that should be set
            at 46px. The score is unitless, computed from this seller's own paid
            lines, listings and current documents, and null when there is too
            little activity to state one honestly.

            Ruled ground and the fresnel shoulder, because this is the page's one
            composed object. Both are portal-dialled: the seller's rim shoulder is
            .38 against the storefront's .48, and the ruling is the same gesture
            at the same --lh-body rhythm as the field behind the page. */}
        <Surface rung={2} rim className="overflow-hidden">
          <div className="grid gap-px bg-hairline lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* The ruling goes on THIS cell, not on the panel: the cells are
                opaque --surface-2 painted over a 1px hairline gap, so a ruling on
                the panel would be entirely hidden behind them. [&>*]:relative
                lifts the content above the ::before layer, which is positioned at
                z-index 0 and would otherwise paint on top of the words — the same
                rule .u-empty applies to its own children. */}
            <div data-rule-ground="" className="bg-surface-2 p-5 [&>*]:relative">
              <Eyebrow>{t("score.title")}</Eyebrow>
              {performance === null ? (
                <>
                  {/* The provenance voice at h2, not a grey dash. An honest
                      absence is a statement about the data, which is exactly
                      what the serif is reserved for. */}
                  <p className="u-provenance mt-2 max-w-desc text-h2 text-ink-1">
                    {t("dashboard.scoreEmpty.headline")}
                  </p>
                  <p className="u-meta mt-2 max-w-desc text-ink-2">
                    {t("dashboard.scoreEmpty.body", {
                      orderLines: String(MIN_ORDER_ITEMS_FOR_SCORE),
                      rfqs: String(MIN_RFQS_FOR_SCORE),
                      days: String(PERFORMANCE_WINDOW_DAYS),
                    })}
                  </p>
                </>
              ) : (
                <>
                  {/* Hero rank. The digits are a <Num>: tabular, and structurally
                      never the animated element — on a trade platform a figure
                      that ticks is a figure you cannot trust. */}
                  <div className="mt-1">
                    <Num value={performance.score} unit="/100" rank="hero" />
                  </div>
                  <Meter
                    className="mt-3"
                    value={performance.score}
                    tone="accent"
                    size="lg"
                    label={t("score.meterLabel", { score: String(performance.score) })}
                  />
                  <Dateline className="mt-2">
                    {t("score.provenanceDateline", { days: String(performance.windowDays) })}
                  </Dateline>
                </>
              )}
              <Button variant="link" size="sm" asChild className="mt-2 -ms-1 px-1">
                <Link href="/performance">{t("dashboard.howCalculated")}</Link>
              </Button>
            </div>

            {/* What the seller can clear themselves. Rows with the always-present
                3px inline-start rule — the same gesture the RFQ inbox, the
                listing-issue list and the commit mark use, in a different
                posture. A row, not a tile: a tile makes three items look like
                three metrics, and these are three jobs. */}
            <div className="bg-surface-2">
              <div className="flex items-center gap-2 border-b border-hairline px-5 py-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                <Eyebrow as="h2">{t("dashboard.attention.title")}</Eyebrow>
                {attention.length > 0 && (
                  <span className="fig u-meta ms-auto text-ink-2">{attention.length}</span>
                )}
              </div>

              {attention.length > 0 ? (
                <ul>
                  {attention.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={cn(
                          "u-focus u-state-wash flex items-start gap-3 border-s-[3px] px-5 py-3",
                          "border-b border-b-hairline last:border-b-0",
                          item.chip === "danger" ? "border-s-danger" : "border-s-warning",
                        )}
                      >
                        <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="u-ui block font-medium text-ink-1">{item.label}</span>
                          <span className="u-meta block text-ink-2">{item.note}</span>
                        </span>
                        <Num value={item.value} className="shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                // An empty surface has to read as deliberate, and it has to say
                // exactly WHAT was checked — "all clear" with no basis is a claim.
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-5">
                  <StatusPill tone="success" dot>
                    {t("dashboard.attention.allClearPill")}
                  </StatusPill>
                  <Dateline className="min-w-0">{t("dashboard.attention.allClearNote")}</Dateline>
                </div>
              )}
            </div>
          </div>
        </Surface>

        {/* Trading. One panel divided by hairlines, not four floating tiles, and
            the month's revenue carries section rank because it is the figure the
            other three qualify. */}
        <section aria-label={t("dashboard.trading.title")}>
          <SectionHeader
            title={t("dashboard.trading.title")}
            dateline={t("dashboard.trading.dateline")}
          />
          <CellGrid cols={{ base: 2, lg: 4 }}>
            <Stat label={t("dashboard.trading.revenue.label")} value={amount(Number(dash.monthRevenue))} rank="section" icon={Wallet} note={t("dashboard.trading.revenue.note")} />
            {/* Relabelled from "Today's Orders" (now dashboard.trading.orderLinesToday):
                the figure counts order LINES, paid or not, so calling it orders
                overstated it by however many lines a single basket held. */}
            <Stat label={t("dashboard.trading.orderLinesToday.label")} value={dash.todayOrderCount} icon={ShoppingCart} note={t("dashboard.trading.orderLinesToday.note")} />
            <Stat label={t("dashboard.trading.pendingPayout.label")} value={amount(Number(dash.pendingPayoutAmount))} icon={CreditCard} note={t("dashboard.trading.pendingPayout.note")} href="/payouts" linkComponent={Link} className={CELL_FOCUS} />
            <Stat label={t("dashboard.trading.activeListings.label")} value={dash.activeListings} icon={Package} note={t("dashboard.trading.activeListings.note")} href="/products" linkComponent={Link} className={CELL_FOCUS} />
          </CellGrid>
        </section>

        {/* Work that is queued rather than wrong. */}
        <section aria-label={t("dashboard.queue.title")}>
          {/* The unread-message and RFQ figures ARE counted by their
              destination's own predicate, but the fulfilment figure counts order
              LINES while /orders lists orders — so the panel states what each
              cell counts underneath it rather than making one guarantee for all
              four that only two of them keep. */}
          <SectionHeader title={t("dashboard.queue.title")} description={t("dashboard.queue.description")} />
          <CellGrid cols={{ base: 2, lg: 4 }}>
            {workload.map((item) => (
              <Stat
                key={item.key}
                label={item.label}
                value={item.value}
                icon={item.icon}
                note={item.note}
                href={item.href}
                linkComponent={Link}
                className={CELL_FOCUS}
              />
            ))}
          </CellGrid>
        </section>

        {/* What the score above is MADE of. The figure itself moved into the
            masthead — it used to be printed twice on one page, at section rank
            here and again in the sidebar pill, which is how a number stops
            reading as the answer and starts reading as decoration. This panel is
            now the breakdown only, and it renders nothing at all when there is no
            score to break down. */}
        {performance !== null && (
          <Surface rung={2} className="p-5">
            <SectionHeader
              title={t("dashboard.breakdown.title")}
              dateline={t("dashboard.breakdown.dateline", { days: String(performance.windowDays) })}
              action={
                <Button variant="link" size="sm" asChild>
                  <Link href="/performance">{t("dashboard.breakdown.viewDetails")}</Link>
                </Button>
              }
            />
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
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
                    label={t("score.componentMeterLabel", {
                      label: component.label,
                      detail:
                        component.share === null
                          ? t("score.noDataInWindow")
                          : t("score.goodOfTotal", { good: String(component.good), total: String(component.total) }),
                    })}
                  />
                  <p className="u-meta mt-1 text-ink-3">
                    {component.share === null
                      ? t("score.noDataInWindowSentence")
                      : t("score.goodOfTotal", { good: String(component.good), total: String(component.total) })}
                  </p>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* Recent orders. This used to disappear entirely when there were none,
            which left a new seller staring at a page with a hole in it. */}
        {/* This heading once carried a hardcoded "— الطلبات الأخيرة" suffix while
            the other seventeen headings on this portal were English only: an
            Arabic phrase glued onto two of nineteen headings is decoration, not
            bilingualism, and it is the exact tell law 3 names. The suffix went
            first; the real fix — every string on this page resolved from the
            message tree, so the Arabic build is a design rather than a setting —
            is what dashboard.recentOrders.* and the rest of sellerShell are. */}
        <LedgerTable
          title={t("dashboard.recentOrders.title")}
          dateline={t("dashboard.recentOrders.dateline")}
          toolbar={
            <Button variant="link" size="sm" asChild>
              <Link href="/orders">{t("dashboard.recentOrders.viewAll")}</Link>
            </Button>
          }
          rows={dash.recentOrders}
          getRowKey={(order) => order.id}
          columns={[
            {
              key: "orderNumber",
              label: t("dashboard.recentOrders.columns.order"),
              render: (order) => (
                <Link
                  href={`/orders/${order.id}`}
                  className="u-mono u-focus rounded-nested text-primary-ink hover:underline"
                >
                  {order.orderNumber}
                </Link>
              ),
            },
            {
              key: "createdAt",
              label: t("dashboard.recentOrders.columns.placed"),
              hideOnMobile: true,
              render: (order) => {
                const placed = new Date(order.createdAt);
                return t("dashboard.recentOrders.placedOn", {
                  month: t(`months.${MONTH_KEYS[placed.getMonth()]!}`),
                  day: String(placed.getDate()),
                  year: String(placed.getFullYear()),
                });
              },
            },
            { key: "type", label: t("dashboard.recentOrders.columns.channel"), hideOnMobile: true },
            {
              key: "total",
              label: t("dashboard.recentOrders.columns.yourShare"),
              numeric: true,
              render: (order) => formatCurrency(Number(order.total), order.currency),
            },
            {
              key: "status",
              label: t("dashboard.recentOrders.columns.status"),
              align: "end",
              // One order-status vocabulary for the whole fulfilment surface.
              // This page used to collapse eleven states into four tones and
              // print the raw SCREAMING_SNAKE enum as the label, while the orders
              // table three clicks away carried a different map again.
              render: (order) => {
                const meta = orderStatusMeta(order.status);
                return <StatusPill tone={meta.tone}>{meta.label}</StatusPill>;
              },
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("dashboard.recentOrders.empty.eyebrow")}
              headline={t("dashboard.recentOrders.empty.headline")}
              body={t("dashboard.recentOrders.empty.body")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/products">{t("dashboard.recentOrders.empty.action")}</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
