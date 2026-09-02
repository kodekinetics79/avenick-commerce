import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, OrderStatus, OrderType } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle, Clock, RotateCcw, ExternalLink } from "lucide-react";
import { OrderControls } from "./order-controls";

export const metadata = { title: "Orders" };

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  PENDING_PAYMENT:   { label: "Pending Payment",   color: "bg-muted text-muted-foreground" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", color: "bg-muted text-muted-foreground" },
  CONFIRMED:         { label: "Confirmed",         color: "bg-primary/10 text-primary" },
  PROCESSING:        { label: "Processing",        color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  SHIPPED:           { label: "Shipped",           color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
  OUT_FOR_DELIVERY:  { label: "Out for Delivery",  color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  DELIVERED:         { label: "Delivered",         color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  CANCELLED:         { label: "Cancelled",         color: "bg-red-500/10 text-red-700 dark:text-red-400" },
  REFUNDED:          { label: "Refunded",          color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  RETURN_REQUESTED:  { label: "Return Requested",  color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  RETURNED:          { label: "Returned",          color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
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
  const gmvLabel = gmvByCurrency.size === 0 ? "—" : [...gmvByCurrency.entries()].map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ");
  const b2bCount = orders.filter((o) => o.type === "B2B").length;
  const activeTab = statusFilter ?? "";

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-muted-foreground text-sm">All orders across B2C and B2B channels</p>
          </div>
        </div>

        {/* Stats — scoped to the current filter; the GMV and B2B figures cover the rows shown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Matching orders",                 value: matching,        color: "text-foreground", bg: "bg-card border-border" },
            { label: `GMV of the ${orders.length} shown`, value: gmvLabel,       color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20" },
            { label: `B2B among the ${orders.length} shown`, value: b2bCount,   color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            { label: "Return requested",                value: returnRequested, color: returnRequested > 0 ? "text-orange-700 dark:text-orange-400" : "text-muted-foreground", bg: returnRequested > 0 ? "bg-orange-500/10 border-orange-500/20" : "bg-card border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-2xl font-bold ${color} break-words`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs + type filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
            {FILTER_TABS.map(({ value, label, icon: Icon }) => (
              <Link key={value} href={value ? `/orders?status=${value}${typeFilter ? `&type=${typeFilter}` : ""}` : `/orders${typeFilter ? `?type=${typeFilter}` : ""}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-primary text-primary-foreground" : "bg-secondary border border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[["", "All Types"],["B2C","B2C"],["B2B","B2B"]].map(([v, l]) => (
              <Link key={v} href={v ? `/orders?type=${v}${statusFilter ? `&status=${statusFilter}` : ""}` : `/orders${statusFilter ? `?status=${statusFilter}` : ""}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${(typeFilter ?? "") === v ? "bg-purple-600 text-white" : "bg-secondary border border-border text-muted-foreground hover:bg-muted"}`}>
                {l}
              </Link>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  {["Order #","Customer","Date","Items","Total","Type","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const sc = STATUS_CONFIG[order.status];
                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-muted-foreground">{order.orderNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{order.user.firstName} {order.user.lastName}</p>
                        {order.company && <p className="text-xs text-muted-foreground">{order.company.nameEn}</p>}
                        <p className="text-xs text-muted-foreground">{order.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(order.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{order._count.items}</td>
                      <td className="px-4 py-3 font-bold text-green-700 dark:text-green-400">{formatCurrency(Number(order.total), order.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.type === "B2B" ? "bg-purple-500/10 text-purple-700 dark:text-purple-400" : "bg-primary/10 text-primary"}`}>{order.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          <Link href={`/orders/${order.id}`} className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5">
                            <ExternalLink className="h-3 w-3" /> View
                          </Link>
                          <OrderControls orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} variant="row" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length === 0 && (
              <div className="text-center py-16">
                <ShoppingCart className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                <p className="font-semibold text-muted-foreground">No orders found</p>
                <p className="text-sm text-muted-foreground mt-1">{statusFilter ? `No ${STATUS_CONFIG[statusFilter].label.toLowerCase()} orders` : "No orders placed yet"}</p>
              </div>
            )}
          </div>
          {orders.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-muted flex items-center justify-between">
              <p className="text-xs text-muted-foreground">GMV of rows shown: {gmvLabel}</p>
              <p className="text-xs text-muted-foreground">Showing latest {orders.length} of {matching}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
