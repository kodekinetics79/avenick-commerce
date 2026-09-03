import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, OrderStatus, OrderType } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle, Clock, RotateCcw, ExternalLink } from "lucide-react";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, Dateline, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { FilterTabs } from "@/components/console/chrome";
import { OrderControls } from "./order-controls";

export const metadata = { title: "Orders" };

/**
 * Status tone, not status colour. This map used to carry eight literal hues —
 * purple, cyan, amber, green, red and three shades of orange — which is eight
 * colours carrying no more information than four states do. An operator scanning
 * this column needs exactly one question answered: is this row fine, waiting on
 * someone, broken, or done. So: neutral in flight, warning waiting, danger
 * broken, success finished, accent for money that has landed.
 */
const STATUS_CONFIG: Record<OrderStatus, { label: string; tone: PillTone }> = {
  PENDING_PAYMENT:   { label: "Pending Payment",   tone: "warning" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", tone: "accent" },
  CONFIRMED:         { label: "Confirmed",         tone: "accent" },
  PROCESSING:        { label: "Processing",        tone: "neutral" },
  SHIPPED:           { label: "Shipped",           tone: "neutral" },
  OUT_FOR_DELIVERY:  { label: "Out for Delivery",  tone: "neutral" },
  DELIVERED:         { label: "Delivered",         tone: "success" },
  CANCELLED:         { label: "Cancelled",         tone: "danger" },
  REFUNDED:          { label: "Refunded",          tone: "warning" },
  RETURN_REQUESTED:  { label: "Return Requested",  tone: "warning" },
  RETURNED:          { label: "Returned",          tone: "neutral" },
};

const FILTER_TABS: Array<{ value: OrderStatus | ""; label: string; icon: typeof ShoppingCart }> = [
  { value: "",                 label: "All",              icon: ShoppingCart },
  { value: "PENDING_PAYMENT",  label: "Pending Payment",  icon: Clock },
  { value: "CONFIRMED",        label: "Confirmed",        icon: CheckCircle },
  { value: "PROCESSING",       label: "Processing",       icon: Package },
  { value: "SHIPPED",          label: "Shipped",          icon: Truck },
  { value: "DELIVERED",        label: "Delivered",        icon: CheckCircle },
  { value: "CANCELLED",        label: "Cancelled",        icon: Clock },
  { value: "RETURN_REQUESTED", label: "Return Requested", icon: RotateCcw },
];

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(OrderStatus, value);
}
function isOrderType(value: unknown): value is OrderType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(OrderType, value);
}

const PAGE_SIZE = 100;

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  await requireAdminSession();

  // Unknown filter values are stale links, not queries to run.
  const statusFilter = isOrderStatus(searchParams.status) ? searchParams.status : undefined;
  const typeFilter   = isOrderType(searchParams.type) ? searchParams.type : undefined;
  const where = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(typeFilter   ? { type: typeFilter } : {}),
  };

  const [orders, matching, returnRequested] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        user:    { select: { firstName: true, lastName: true, email: true } },
        company: { select: { nameEn: true } },
        _count:  { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.count({ where: { ...where, status: "RETURN_REQUESTED" } }),
  ]);

  // GMV is only meaningful per currency; summing AED and SAR would be a number
  // that describes nothing.
  const gmvByCurrency = new Map<(typeof orders)[number]["currency"], number>();
  for (const order of orders) gmvByCurrency.set(order.currency, (gmvByCurrency.get(order.currency) ?? 0) + Number(order.total));
  // One line per currency, never a joined string: two currencies stacked is the
  // honest shape of this number.
  const gmvLines = [...gmvByCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, formatted: formatCurrency(amount, currency) }));
  const b2bCount = orders.filter((o) => o.type === "B2B").length;
  const activeTab = statusFilter ?? "";
  const scope = `the ${orders.length} row${orders.length === 1 ? "" : "s"} shown`;

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow="Orders"
          title="All orders"
          description="Every order across the B2C and B2B channels."
          dateline={`Newest first · latest ${PAGE_SIZE} of the current filter`}
        />

        {/* Stats — scoped to the current filter; the GMV and B2B figures cover the rows shown.
            One hairline-divided panel rather than four floating boxes: these four
            figures describe one thing, so they are one object. */}
        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label="Matching orders" value={matching} rank="section" />
          <MoneyStat
            label="GMV of rows shown"
            lines={gmvLines}
            dateline={`Order totals for ${scope}, each in its own currency · no conversion applied`}
          />
          <CountStat label="B2B among rows shown" value={b2bCount} note={`of ${scope}`} />
          <CountStat
            label="Return requested"
            value={returnRequested}
            tone={returnRequested > 0 ? "warning" : "default"}
            note={returnRequested > 0 ? "awaiting a decision" : "none open"}
          />
        </CellGrid>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          <FilterTabs
            label="Filter orders by status"
            className="min-w-0 flex-1 overflow-x-auto scrollbar-thin"
            tabs={FILTER_TABS.map(({ value, label, icon }) => ({
              href: value
                ? `/orders?status=${value}${typeFilter ? `&type=${typeFilter}` : ""}`
                : `/orders${typeFilter ? `?type=${typeFilter}` : ""}`,
              label,
              icon,
              active: activeTab === value,
            }))}
          />
          <FilterTabs
            label="Filter orders by channel"
            className="shrink-0"
            tabs={([["", "All Types"], ["B2C", "B2C"], ["B2B", "B2B"]] as const).map(([v, l]) => ({
              href: v
                ? `/orders?type=${v}${statusFilter ? `&status=${statusFilter}` : ""}`
                : `/orders${statusFilter ? `?status=${statusFilter}` : ""}`,
              label: l,
              active: (typeFilter ?? "") === v,
            }))}
          />
        </div>

        <LedgerTable
          rows={orders}
          getRowKey={(order) => order.id}
          stickyHead
          dateline="Order totals as recorded, each in the currency it was billed in · no conversion applied"
          columns={[
            {
              key: "orderNumber",
              label: "Order #",
              render: (order) => <span className="u-mono text-meta text-ink-2">{order.orderNumber}</span>,
            },
            {
              key: "customer",
              label: "Customer",
              render: (order) => (
                <div className="min-w-0 py-1">
                  <p className="truncate font-medium text-ink-1">
                    {order.user.firstName} {order.user.lastName}
                  </p>
                  {order.company && <p className="u-meta truncate text-ink-2">{order.company.nameEn}</p>}
                  <p className="u-meta truncate text-ink-3">{order.user.email}</p>
                </div>
              ),
            },
            {
              key: "createdAt",
              label: "Date",
              hideOnMobile: true,
              render: (order) => (
                <span className="whitespace-nowrap text-ink-2">{format(order.createdAt, "MMM d, yyyy")}</span>
              ),
            },
            { key: "items", label: "Items", numeric: true, render: (order) => order._count.items },
            {
              key: "total",
              label: "Total",
              numeric: true,
              render: (order) => (
                <Num value={formatCurrency(Number(order.total), order.currency)} className="whitespace-nowrap" />
              ),
            },
            {
              key: "type",
              label: "Channel",
              render: (order) => (
                <StatusPill tone={order.type === "B2B" ? "accent" : "neutral"}>{order.type}</StatusPill>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (order) => {
                const sc = STATUS_CONFIG[order.status];
                return <StatusPill tone={sc.tone}>{sc.label}</StatusPill>;
              },
            },
            {
              key: "action",
              label: "Action",
              align: "end",
              render: (order) => (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="link" size="xs" asChild>
                    <Link href={`/orders/${order.id}`}>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" /> View
                    </Link>
                  </Button>
                  <OrderControls orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} variant="row" />
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow="Nothing recorded"
              headline={
                statusFilter
                  ? `No orders are currently ${STATUS_CONFIG[statusFilter].label.toLowerCase()}.`
                  : "No orders have been placed yet."
              }
              body={
                statusFilter
                  ? "Clear the status filter to see every order in the ledger."
                  : "An order appears here the moment a buyer completes checkout."
              }
              action={
                statusFilter ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/orders">Show all orders</Link>
                  </Button>
                ) : undefined
              }
              icon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
            />
          }
          footer={
            orders.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Dateline>
                  {`GMV of ${scope}: ${gmvLines.length === 0 ? "—" : gmvLines.map((line) => line.formatted).join(" · ")}`}
                </Dateline>
                <span>
                  Showing latest <span className="fig text-ink-2">{orders.length}</span> of{" "}
                  <span className="fig text-ink-2">{matching}</span>
                </span>
              </div>
            ) : undefined
          }
        />
      </div>
    </AdminLayout>
  );
}
