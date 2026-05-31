import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Package, CheckCircle, Truck, Home, Clock, AlertTriangle, User, Building2, FileText, MessageSquare } from "lucide-react";

export const metadata = { title: "Order Detail" };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:  { label: "Pending Payment",  color: "bg-gray-100 text-gray-600" },
  CONFIRMED:        { label: "Confirmed",         color: "bg-blue-100 text-blue-700" },
  PROCESSING:       { label: "Processing",        color: "bg-purple-100 text-purple-700" },
  READY_FOR_PICKUP: { label: "Ready for Pickup",  color: "bg-amber-100 text-amber-700" },
  SHIPPED:          { label: "Shipped",           color: "bg-cyan-100 text-cyan-700" },
  DELIVERED:        { label: "Delivered",         color: "bg-green-100 text-green-700" },
  CANCELLED:        { label: "Cancelled",         color: "bg-red-100 text-red-700" },
  DISPUTED:         { label: "Disputed",          color: "bg-red-200 text-red-800" },
};

const TIMELINE_STEPS = [
  { status: "CONFIRMED",  label: "Order Confirmed",  icon: CheckCircle },
  { status: "PROCESSING", label: "Processing",        icon: Package },
  { status: "SHIPPED",    label: "Shipped",           icon: Truck },
  { status: "DELIVERED",  label: "Delivered",         icon: Home },
];

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  await requireAdminSession();

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

  const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.CONFIRMED;
  const historyStatuses = order.statusHistory.map(h => h.status);
  const subtotal = Number(order.subtotal);
  const vatAmount = Number(order.vatAmount);

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
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{order.orderNumber}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${order.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{order.type}</span>
              </div>
              <p className="text-sm text-muted-foreground">Placed {format(order.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
            </div>
            <div className="text-end">
              <p className="text-2xl font-bold text-green-700">{formatCurrency(Number(order.total), order.currency)}</p>
              <p className="text-xs text-muted-foreground">{order.currency} · incl. VAT</p>
            </div>
          </div>

          {/* Status actions */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            {order.status === "CONFIRMED" && (
              <button type="button" className="flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 font-medium transition-colors">
                <Package className="h-3.5 w-3.5" /> Mark as Processing
              </button>
            )}
            {order.status === "PROCESSING" && (
              <button type="button" className="flex items-center gap-1.5 text-xs bg-cyan-600 text-white px-3 py-1.5 rounded-lg hover:bg-cyan-700 font-medium transition-colors">
                <Truck className="h-3.5 w-3.5" /> Mark as Shipped
              </button>
            )}
            {order.status === "SHIPPED" && (
              <button type="button" className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium transition-colors">
                <CheckCircle className="h-3.5 w-3.5" /> Mark as Delivered
              </button>
            )}
            {!["CANCELLED","DELIVERED","DISPUTED"].includes(order.status) && (
              <button type="button" className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 font-medium transition-colors">
                Cancel Order
              </button>
            )}
            <button type="button" className="flex items-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors">
              <FileText className="h-3.5 w-3.5" /> Download Invoice
            </button>
            <button type="button" className="flex items-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-slate-50 font-medium transition-colors">
              <MessageSquare className="h-3.5 w-3.5" /> Add Note
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-5">

            {/* Order timeline */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <h2 className="font-semibold mb-5">Order Timeline</h2>
              <div>
                {TIMELINE_STEPS.map((step, idx) => {
                  const isReached = historyStatuses.includes(step.status as never) || order.status === step.status;
                  const isCurrent = order.status === step.status;
                  const isLast    = idx === TIMELINE_STEPS.length - 1;
                  const Icon      = step.icon;
                  const entry     = order.statusHistory.find(h => h.status === step.status);
                  return (
                    <div key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isReached ? "bg-green-500" : isCurrent ? "bg-blue-500 ring-4 ring-blue-100" : "bg-slate-100"}`}>
                          <Icon className={`h-4 w-4 ${isReached || isCurrent ? "text-white" : "text-slate-400"}`} />
                        </div>
                        {!isLast && <div className={`w-0.5 h-10 my-0.5 ${isReached ? "bg-green-300" : "bg-slate-100"}`} />}
                      </div>
                      <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                        <p className={`font-semibold text-sm ${!isReached && !isCurrent ? "text-muted-foreground" : ""}`}>
                          {step.label}
                          {isCurrent && <span className="ms-2 text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">CURRENT</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry ? `${format(entry.createdAt, "MMM d, h:mm a")} · ${entry.message ?? "Status updated"}` : !isReached ? "Pending" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-semibold">Order Items ({order.items.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">📦</div>
                      <div>
                        <p className="text-sm font-medium">{item.nameEn}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.sku} · Supplier: {item.product?.seller?.businessNameEn ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(Number(item.unitPrice), order.currency)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-sm text-green-700">{formatCurrency(Number(item.total), order.currency)}</p>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-border bg-slate-50 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal, order.currency)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>VAT</span><span>{formatCurrency(vatAmount, order.currency)}</span></div>
                <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border"><span>Total</span><span className="text-green-700">{formatCurrency(Number(order.total), order.currency)}</span></div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Customer */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-slate-500" />
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
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-slate-500" />
                <h3 className="font-semibold text-sm">Delivery Address</h3>
              </div>
              {order.shippingAddress && typeof order.shippingAddress === "object" ? (
                Object.entries(order.shippingAddress as Record<string, string>).map(([k, v]) => (
                  <p key={k} className="text-sm text-muted-foreground">{v}</p>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Not specified</p>
              )}
            </div>

            {/* Order meta */}
            <div className="bg-white rounded-2xl border border-border p-4">
              <h3 className="font-semibold text-sm mb-3">Order Info</h3>
              <div className="space-y-2 text-sm">
                {[
                  ["Order #", order.orderNumber],
                  ["Type", order.type],
                  ["Currency", order.currency],
                  ["Payment", order.paymentMethod ?? "—"],
                  ["Created", format(order.createdAt, "MMM d, yyyy")],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium text-xs">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold text-sm text-amber-800">Notes</h3>
                </div>
                <p className="text-sm text-amber-700">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
