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
import { format } from "date-fns";
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

export default async function DashboardPage() {
  const { seller, membership } = await requireSellerPermission("dashboard.view");
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
      label: "Product issues",
      value: dash.issueCount,
      href: "/issues",
      icon: AlertTriangle,
      chip: "danger" as const,
      note: "Unresolved listing issues that may affect your sales.",
    },
    {
      key: "stock",
      label: "Below reorder point",
      value: dash.lowStockItems,
      href: "/inventory",
      icon: Zap,
      chip: "warning" as const,
      note: "Stock rows at or under the reorder point you set.",
    },
    {
      key: "expiring",
      label: "Documents expiring",
      value: expiringDocs,
      href: "/documents",
      icon: FileCheck,
      chip: "warning" as const,
      // The count above is every document row carrying an expiry date inside the
      // window, whatever its review status — so the note says "on file" and does
      // not claim they are all approved.
      note: "Documents on file whose expiry date falls in the next 30 days.",
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
    // same defect that made "Today's Orders" wrong.
    { key: "orders", label: "Order lines to fulfil", value: dash.pendingOrders, href: "/orders", icon: Clock, note: "Your order lines still in PROCESSING." },
    { key: "rfqs", label: "Open RFQs", value: openRfqCount, href: "/messages", icon: Activity, note: "Awaiting a quote — the first seller to quote is assigned." },
    { key: "messages", label: "Unread messages", value: dash.unreadMessages, href: "/messages", icon: MessageSquare, note: "Buyer threads you have not opened." },
    { key: "compliance", label: "Documents in review", value: dash.pendingCompliance, href: "/compliance", icon: FileCheck, note: "Filed and waiting on platform review." },
  ];

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={dash.issueCount} unreadMessages={dash.unreadMessages} performance={performance} permissions={membership.permissions}>
      <div className="space-y-block">
        <PageHeader
          className="mb-0"
          eyebrow="Seller overview"
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
              <Eyebrow>Performance score</Eyebrow>
              {performance === null ? (
                <>
                  {/* The provenance voice at h2, not a grey dash. An honest
                      absence is a statement about the data, which is exactly
                      what the serif is reserved for. */}
                  <p className="u-provenance mt-2 max-w-desc text-h2 text-ink-1">
                    Not enough activity to state a score.
                  </p>
                  <p className="u-meta mt-2 max-w-desc text-ink-2">
                    A score needs at least {MIN_ORDER_ITEMS_FOR_SCORE} paid order lines or {MIN_RFQS_FOR_SCORE} quoted
                    RFQs in the last {PERFORMANCE_WINDOW_DAYS} days. Until then any number here would be scoring you on
                    almost nothing.
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
                    label={`Performance score: ${performance.score} out of 100`}
                  />
                  <Dateline className="mt-2">
                    Orders from the last {performance.windowDays} days; listings and documents as they stand now
                  </Dateline>
                </>
              )}
              <Button variant="link" size="sm" asChild className="mt-2 -ms-1 px-1">
                <Link href="/performance">How this is calculated</Link>
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
                <Eyebrow as="h2">Action required</Eyebrow>
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
                    Nothing needs attention
                  </StatusPill>
                  <Dateline className="min-w-0">
                    No unresolved listing issue, no stock at its reorder point, and no document expiring in the next
                    30 days.
                  </Dateline>
                </div>
              )}
            </div>
          </div>
        </Surface>

        {/* Trading. One panel divided by hairlines, not four floating tiles, and
            the month's revenue carries section rank because it is the figure the
            other three qualify. */}
        <section aria-label="Trading">
          <SectionHeader
            title="Trading"
            dateline="Revenue and payout totals are summed as recorded · currencies are not converted"
          />
          <CellGrid cols={{ base: 2, lg: 4 }}>
            <Stat label="Revenue this month" value={amount(Number(dash.monthRevenue))} rank="section" icon={Wallet} note="Paid order lines placed since the 1st." />
            {/* Relabelled from "Today's Orders": the figure counts order LINES,
                paid or not, so calling it orders overstated it by however many
                lines a single basket held. */}
            <Stat label="Order lines today" value={dash.todayOrderCount} icon={ShoppingCart} note="Your lines on orders placed since midnight, paid or not." />
            <Stat label="Pending payout" value={amount(Number(dash.pendingPayoutAmount))} icon={CreditCard} note="Payouts recorded and not yet settled." href="/payouts" linkComponent={Link} className={CELL_FOCUS} />
            <Stat label="Active listings" value={dash.activeListings} icon={Package} note="Products live in the catalogue." href="/products" linkComponent={Link} className={CELL_FOCUS} />
          </CellGrid>
        </section>

        {/* Work that is queued rather than wrong. */}
        <section aria-label="In your queue">
          {/* The unread-message and RFQ figures ARE counted by their
              destination's own predicate, but the fulfilment figure counts order
              LINES while /orders lists orders — so the panel states what each
              cell counts underneath it rather than making one guarantee for all
              four that only two of them keep. */}
          <SectionHeader title="In your queue" description="Each figure says underneath it exactly what it counts, and links to the page that holds those rows." />
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
              title="What the score is made of"
              dateline={`Weights are re-scaled across the components that have data, so a component with none is left out rather than counted as zero · orders from the last ${performance.windowDays} days`}
              action={
                <Button variant="link" size="sm" asChild>
                  <Link href="/performance">View details</Link>
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
                    label={`${component.label}: ${component.share === null ? "no data in this window" : `${component.good} of ${component.total}`}`}
                  />
                  <p className="u-meta mt-1 text-ink-3">
                    {component.share === null ? "No data in this window" : `${component.good} of ${component.total}`}
                  </p>
                </div>
              ))}
            </div>
          </Surface>
        )}

        {/* Recent orders. This used to disappear entirely when there were none,
            which left a new seller staring at a page with a hole in it. */}
        {/* The heading dropped its "— الطلبات الأخيرة" suffix, and so did the
            action band above. This portal has a full next-intl message tree and
            calls it from nowhere: an Arabic phrase glued onto two of nineteen
            English headings is decoration, not bilingualism, and it is the exact
            tell law 3 names — it says the Arabic build is a setting rather than a
            design. The real fix is the message tree, which is a cross-track item
            (apps/seller/messages/*.json is not owned here); the theatre goes now
            so nothing reads as though the job were already done. */}
        <LedgerTable
          title="Recent orders"
          dateline="The ten most recent orders containing your lines · each total is your share of that order, in the order's own currency"
          toolbar={
            <Button variant="link" size="sm" asChild>
              <Link href="/orders">View all orders</Link>
            </Button>
          }
          rows={dash.recentOrders}
          getRowKey={(order) => order.id}
          columns={[
            {
              key: "orderNumber",
              label: "Order",
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
              label: "Placed",
              hideOnMobile: true,
              render: (order) => format(new Date(order.createdAt), "MMM d, yyyy"),
            },
            { key: "type", label: "Channel", hideOnMobile: true },
            {
              key: "total",
              label: "Your share",
              numeric: true,
              render: (order) => formatCurrency(Number(order.total), order.currency),
            },
            {
              key: "status",
              label: "Status",
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
              eyebrow="Nothing recorded"
              headline="No buyer has ordered from you yet."
              body="An order appears here the moment one of your lines is bought, whichever channel it comes through."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/products">Review your listings</Link>
                </Button>
              }
            />
          }
        />
      </div>
    </SellerLayout>
  );
}
