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
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { requireSellerPermission } from "@/lib/auth";
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
  type PillTone,
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

  // A CellGrid is one panel divided by hairlines: the panel itself paints the
  // divider colour and each cell paints over it, so a partially-filled row shows
  // its empty track as a bare rectangle of divider colour rather than as a cell.
  // The column count therefore has to DIVIDE the cell count at every breakpoint,
  // not just at the widest one — three items in a two-column row is the case
  // that leaves a hole.
  const attentionCols = (attention.length >= 3 ? 3 : attention.length === 2 ? 2 : 1) as 1 | 2 | 3;

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

  // Enum → label mapping only. The tone says what the status IS; it never
  // implies a judgement the order data does not carry.
  const orderStatusTone = (status: string): PillTone =>
    status === "DELIVERED" ? "success" : status === "CANCELLED" ? "danger" : status === "PROCESSING" ? "primary" : "neutral";

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

        {/* What the seller can clear themselves, or an explicit statement that
            there is nothing — an empty surface has to read as deliberate. */}
        {attention.length > 0 ? (
          <section aria-label="Action required">
            <SectionHeader
              icon={AlertTriangle}
              title="Action Required — إجراء مطلوب"
              description="Each of these is yours to clear."
            />
            <CellGrid cols={{ base: 1, sm: attentionCols, lg: attentionCols }}>
              {attention.map((item) => (
                <Stat
                  key={item.key}
                  label={item.label}
                  value={item.value}
                  rank="section"
                  chip={item.chip}
                  icon={item.icon}
                  note={item.note}
                  href={item.href}
                  linkComponent={Link}
                  className={CELL_FOCUS}
                />
              ))}
            </CellGrid>
          </section>
        ) : (
          <Surface rung={1} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
            <StatusPill tone="success" dot>
              Nothing needs attention
            </StatusPill>
            <Dateline className="min-w-0">
              No unresolved listing issue, no stock at its reorder point, and no document expiring in the next 30 days.
            </Dateline>
          </Surface>
        )}

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

        {/* Performance score — the same computed score as the sidebar and
            /performance, and null when there is too little activity to state one. */}
        <Surface rung={2} className="p-5">
          <SectionHeader
            title="Performance score"
            dateline={
              performance
                ? `Orders from the last ${performance.windowDays} days; listings and documents as they stand now`
                : undefined
            }
            action={
              <Button variant="link" size="sm" asChild>
                <Link href="/performance">View details</Link>
              </Button>
            }
          />
          {performance === null ? (
            <EmptyState
              eyebrow="Not enough data"
              headline="No performance score yet."
              body={`A score needs at least ${MIN_ORDER_ITEMS_FOR_SCORE} paid order lines or ${MIN_RFQS_FOR_SCORE} quoted RFQs in the last ${PERFORMANCE_WINDOW_DAYS} days. Until then any number here would be scoring you on almost nothing.`}
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Num value={performance.score} unit="/100" rank="section" />
                {/* Recessed track, raised fill: the reading is carried by depth
                    rather than by a red/amber/green a supplier sees sixty times a
                    day, and the number itself is right beside it. */}
                <Meter
                  className="min-w-[12rem] flex-1"
                  value={performance.score}
                  tone="accent"
                  size="lg"
                  label={`Performance score: ${performance.score} out of 100`}
                />
              </div>
              <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
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

        {/* Recent orders. This used to disappear entirely when there were none,
            which left a new seller staring at a page with a hole in it. */}
        <LedgerTable
          title="Recent Orders — الطلبات الأخيرة"
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
              render: (order) => <StatusPill tone={orderStatusTone(order.status)}>{order.status}</StatusPill>,
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
