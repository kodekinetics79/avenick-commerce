import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ORDER_INTERNAL_NOTE_ENTITY, type OrderStatus } from "@avenick/database";
import { formatCurrency, isRecordId } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, CheckCircle, Truck, Navigation, Home, AlertTriangle, User, Building2, StickyNote } from "lucide-react";
import { OrderControls } from "../order-controls";

export const metadata = { title: "Order Detail" };

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

const TIMELINE_STEPS: Array<{ status: OrderStatus; label: string; icon: typeof Package }> = [
  { status: "CONFIRMED",        label: "Order Confirmed",  icon: CheckCircle },
  { status: "PROCESSING",       label: "Processing",       icon: Package },
  { status: "SHIPPED",          label: "Shipped",          icon: Truck },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Navigation },
  { status: "DELIVERED",        label: "Delivered",        icon: Home },
];
const CHAIN_RANK = new Map(TIMELINE_STEPS.map((step, index) => [step.status, index]));

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  await requireAdminSession();
  if (!isRecordId(params.id)) notFound();

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      user:    { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      company: { select: { nameEn: true, nameAr: true } },
      items:   { include: { product: { include: { images: { where: { isPrimary: true }, take: 1 }, seller: { select: { businessNameEn: true } } } } } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();

  // Internal notes live in the audit log under their own entity type; see
  // addOrderInternalNote for why neither Order.notes nor the status history
  // can hold a staff-only remark.
  const internalNotes = await db.auditLog.findMany({
    where: { entityType: ORDER_INTERNAL_NOTE_ENTITY, entityId: order.id },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { firstName: true, lastName: true, email: true } } },
  });

  const sc = STATUS_CONFIG[order.status];
  const currentRank = CHAIN_RANK.get(order.status);
  const subtotal = Number(order.subtotal);
  const vatAmount = Number(order.vatAmount);
  const terminal = order.status === "CANCELLED" || order.status === "REFUNDED" || order.status === "RETURNED";

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Orders
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{order.orderNumber}</span>
        </div>

        {/* Header */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{order.orderNumber}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${order.type === "B2B" ? "bg-purple-500/10 text-purple-700 dark:text-purple-400" : "bg-primary/10 text-primary"}`}>{order.type}</span>
              </div>
              <p className="text-sm text-muted-foreground">Placed {format(order.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(Number(order.total), order.currency)}</p>
              <p className="text-xs text-muted-foreground">{order.currency} · incl. VAT · payment {order.paymentStatus.toLowerCase().replace(/_/g, " ")}</p>
            </div>
          </div>

          {/* Status actions. There is no invoice download here: nothing in the
              system writes TaxInvoice rows yet, so a button would only ever fail. */}
          <div className="mt-4 pt-4 border-t border-border">
            <OrderControls orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} governed={Boolean(order.purchaseOrderId)} variant="detail" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">

            {/* Order timeline */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="font-semibold mb-5">Order Timeline</h2>
              {terminal && (
                <p className="text-xs text-muted-foreground mb-4">This order is {sc.label.toLowerCase()}; the fulfilment steps below stop where it left the chain.</p>
              )}
              <div>
                {TIMELINE_STEPS.map((step, idx) => {
                  const entry     = order.statusHistory.find(h => h.status === step.status);
                  const isReached = !!entry || (currentRank !== undefined && idx <= currentRank);
                  const isCurrent = order.status === step.status;
                  const isLast    = idx === TIMELINE_STEPS.length - 1;
                  const Icon      = step.icon;
                  return (
                    <div key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isCurrent ? "bg-primary ring-4 ring-primary/20" : isReached ? "bg-green-500" : "bg-muted"}`}>
                          <Icon className={`h-4 w-4 ${isReached || isCurrent ? "text-white" : "text-muted-foreground"}`} />
                        </div>
                        {!isLast && <div className={`w-0.5 h-10 my-0.5 ${isReached && !isCurrent ? "bg-green-300 dark:bg-green-600" : "bg-muted"}`} />}
                      </div>
                      <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                        <p className={`font-semibold text-sm ${!isReached && !isCurrent ? "text-muted-foreground" : ""}`}>
                          {step.label}
                          {isCurrent && <span className="ms-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">CURRENT</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry ? `${format(entry.createdAt, "MMM d, h:mm a")}${entry.message ? ` · ${entry.message}` : ""}` : isReached ? "No timestamp recorded" : "Not yet"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {order.statusHistory.some((h) => CHAIN_RANK.get(h.status) === undefined) && (
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Other status events</p>
                  <ul className="space-y-1">
                    {order.statusHistory.filter((h) => CHAIN_RANK.get(h.status) === undefined).map((h) => (
                      <li key={h.id} className="text-xs text-muted-foreground">
                        {format(h.createdAt, "MMM d, h:mm a")} · {STATUS_CONFIG[h.status].label}{h.message ? ` · ${h.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">Order Items ({order.items.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                      <div>
                        <p className="text-sm font-medium">{item.nameEn}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku} · Supplier: {item.product?.seller?.businessNameEn ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(Number(item.unitPrice), order.currency)}</p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-sm text-green-700 dark:text-green-400">{formatCurrency(Number(item.total), order.currency)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CONFIG[item.status].color}`}>{STATUS_CONFIG[item.status].label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-border bg-muted space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal, order.currency)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>VAT</span><span>{formatCurrency(vatAmount, order.currency)}</span></div>
                <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border"><span>Total</span><span className="text-green-700 dark:text-green-400">{formatCurrency(Number(order.total), order.currency)}</span></div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Customer */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Customer</h3>
              </div>
              <p className="font-medium text-sm">{order.user.firstName} {order.user.lastName}</p>
              <p className="text-xs text-muted-foreground">{order.user.email}</p>
              {order.company && (
                <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{order.company.nameEn}</span>
                </div>
              )}
            </div>

            {/* Shipping address */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Delivery Address</h3>
              </div>
              {order.shippingAddress && typeof order.shippingAddress === "object" ? (
                Object.entries(order.shippingAddress as Record<string, unknown>)
                  .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
                  .map(([k, v]) => (
                    <p key={k} className="text-sm text-muted-foreground">{String(v)}</p>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">Not specified</p>
              )}
            </div>

            {/* Order meta */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3">Order Info</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Order #", order.orderNumber],
                  ["Type", order.type],
                  ["Currency", order.currency],
                  ["Payment method", order.paymentMethod ?? "—"],
                  ["Payment status", order.paymentStatus.replace(/_/g, " ")],
                  ["Created", format(order.createdAt, "MMM d, yyyy")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-xs">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer's checkout note — written by the buyer, shown to the buyer */}
            {order.notes && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-400">Customer note</h3>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            {/* Internal notes — staff only */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Internal notes</h3>
              </div>
              {internalNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No internal notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {internalNotes.map((entry) => {
                    const note = (entry.after as { note?: unknown } | null)?.note;
                    const author = entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim() || entry.actor.email : "Unknown staff member";
                    return (
                      <li key={entry.id} className="text-sm">
                        <p className="whitespace-pre-wrap">{typeof note === "string" ? note : ""}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{author} · {format(entry.createdAt, "MMM d, yyyy h:mm a")}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
