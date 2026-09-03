import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, OrderStatus, OrderType } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShoppingCart, Package, Truck, CheckCircle, Clock, RotateCcw, ExternalLink } from "lucide-react";
import {
  PageHeader, CellGrid, LedgerTable, EmptyState, StatusPill, Num, Dateline, Button,
  type PillTone,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { FilterTabs } from "@/components/console/chrome";
import { OrderControls } from "./order-controls";

export async function generateMetadata() {
  const t = await getTranslations("adminCommerce.orders");
  return { title: t("meta.title") };
}

/**
 * Status tone, not status colour. This map used to carry eight literal hues —
 * purple, cyan, amber, green, red and three shades of orange — which is eight
 * colours carrying no more information than four states do. An operator scanning
 * this column needs exactly one question answered: is this row fine, waiting on
 * someone, broken, or done. So: neutral in flight, warning waiting, danger
 * broken, success finished, accent for money that has landed.
 *
 * The label that goes with each tone is a translated string, keyed by the enum
 * value under `adminCommerce.orders.status`; only the tone lives here.
 */
const STATUS_TONE: Record<OrderStatus, PillTone> = {
  PENDING_PAYMENT:   "warning",
  PAYMENT_CONFIRMED: "accent",
  CONFIRMED:         "accent",
  PROCESSING:        "neutral",
  SHIPPED:           "neutral",
  OUT_FOR_DELIVERY:  "neutral",
  DELIVERED:         "success",
  CANCELLED:         "danger",
  REFUNDED:          "warning",
  RETURN_REQUESTED:  "warning",
  RETURNED:          "neutral",
};

/** Tab order and icon; the label comes from `orders.status` (or `orders.filters.all`). */
const FILTER_TABS: Array<{ value: OrderStatus | ""; icon: typeof ShoppingCart }> = [
  { value: "",                 icon: ShoppingCart },
  { value: "PENDING_PAYMENT",  icon: Clock },
  { value: "CONFIRMED",        icon: CheckCircle },
  { value: "PROCESSING",       icon: Package },
  { value: "SHIPPED",          icon: Truck },
  { value: "DELIVERED",        icon: CheckCircle },
  { value: "CANCELLED",        icon: Clock },
  { value: "RETURN_REQUESTED", icon: RotateCcw },
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
  const t = await getTranslations("adminCommerce.orders");

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
  // The count is passed as a string as well as a number: the number selects the
  // plural form, the string keeps the digits Western inside Arabic text.
  const scope = t("scope", { count: orders.length, value: String(orders.length) });

  return (
    <AdminLayout>
      <div className="space-y-block">
        <PageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
          dateline={t("dateline", { count: String(PAGE_SIZE) })}
        />

        {/* Stats — scoped to the current filter; the GMV and B2B figures cover the rows shown.
            One hairline-divided panel rather than four floating boxes: these four
            figures describe one thing, so they are one object. */}
        <CellGrid cols={{ base: 2, lg: 4 }} density="compact">
          <CountStat label={t("stats.matching")} value={matching} rank="section" />
          <MoneyStat
            label={t("stats.gmv")}
            lines={gmvLines}
            dateline={t("stats.gmvDateline", { scope })}
          />
          <CountStat label={t("stats.b2b")} value={b2bCount} note={t("stats.b2bNote", { scope })} />
          <CountStat
            label={t("stats.returnRequested")}
            value={returnRequested}
            tone={returnRequested > 0 ? "warning" : "default"}
            note={returnRequested > 0 ? t("stats.returnAwaiting") : t("stats.returnNone")}
          />
        </CellGrid>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
          <FilterTabs
            label={t("filters.statusLabel")}
            className="min-w-0 flex-1 overflow-x-auto scrollbar-thin"
            tabs={FILTER_TABS.map(({ value, icon }) => ({
              href: value
                ? `/orders?status=${value}${typeFilter ? `&type=${typeFilter}` : ""}`
                : `/orders${typeFilter ? `?type=${typeFilter}` : ""}`,
              label: value ? t(`status.${value}`) : t("filters.all"),
              icon,
              active: activeTab === value,
            }))}
          />
          <FilterTabs
            label={t("filters.channelLabel")}
            className="shrink-0"
            // B2C and B2B are channel codes, not prose: they read the same in
            // both locales and are deliberately left untranslated.
            tabs={([["", t("filters.allTypes")], ["B2C", "B2C"], ["B2B", "B2B"]] as const).map(([v, l]) => ({
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
          dateline={t("table.dateline")}
          columns={[
            {
              key: "orderNumber",
              label: t("columns.orderNumber"),
              render: (order) => <span className="u-mono text-meta text-ink-2">{order.orderNumber}</span>,
            },
            {
              key: "customer",
              label: t("columns.customer"),
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
              label: t("columns.date"),
              hideOnMobile: true,
              render: (order) => (
                <span className="whitespace-nowrap text-ink-2">{format(order.createdAt, "MMM d, yyyy")}</span>
              ),
            },
            { key: "items", label: t("columns.items"), numeric: true, render: (order) => order._count.items },
            {
              key: "total",
              label: t("columns.total"),
              numeric: true,
              render: (order) => (
                <Num value={formatCurrency(Number(order.total), order.currency)} className="whitespace-nowrap" />
              ),
            },
            {
              key: "type",
              label: t("columns.channel"),
              render: (order) => (
                <StatusPill tone={order.type === "B2B" ? "accent" : "neutral"}>{order.type}</StatusPill>
              ),
            },
            {
              key: "status",
              label: t("columns.status"),
              render: (order) => (
                <StatusPill tone={STATUS_TONE[order.status]}>{t(`status.${order.status}`)}</StatusPill>
              ),
            },
            {
              key: "action",
              label: t("columns.action"),
              align: "end",
              render: (order) => (
                <div className="flex items-center justify-end gap-2">
                  <Button variant="link" size="xs" asChild>
                    <Link href={`/orders/${order.id}`}>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" /> {t("view")}
                    </Link>
                  </Button>
                  <OrderControls orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} variant="row" />
                </div>
              ),
            },
          ]}
          empty={
            <EmptyState
              eyebrow={t("empty.eyebrow")}
              headline={
                statusFilter
                  ? t("empty.headlineFiltered", { status: t(`status.${statusFilter}`).toLowerCase() })
                  : t("empty.headline")
              }
              body={statusFilter ? t("empty.bodyFiltered") : t("empty.body")}
              action={
                statusFilter ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href="/orders">{t("empty.action")}</Link>
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
                  {t("footer.gmv", {
                    scope,
                    amounts: gmvLines.length === 0 ? "—" : gmvLines.map((line) => line.formatted).join(" · "),
                  })}
                </Dateline>
                <span>
                  {t.rich("footer.showing", {
                    shown: String(orders.length),
                    total: String(matching),
                    n: (chunks) => <span className="fig text-ink-2">{chunks}</span>,
                  })}
                </span>
              </div>
            ) : undefined
          }
        />
      </div>
    </AdminLayout>
  );
}
