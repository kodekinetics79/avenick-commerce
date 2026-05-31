import { auth } from "@/lib/auth-instance";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@avenick/database";
import { MainLayout } from "@/components/layout/main-layout";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import { ShoppingBag, Package, Truck, CheckCircle, Clock, ChevronRight, RotateCcw } from "lucide-react";

export const metadata = { title: "My Orders" };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING_PAYMENT:  { label: "Pending Payment", color: "bg-gray-100 text-muted-foreground",     icon: Clock },
  CONFIRMED:        { label: "Confirmed",        color: "bg-blue-100 text-primary",     icon: CheckCircle },
  PROCESSING:       { label: "Processing",       color: "bg-purple-100 text-purple-700", icon: Package },
  READY_FOR_PICKUP: { label: "Ready for Pickup", color: "bg-amber-100 text-amber-700",   icon: Package },
  SHIPPED:          { label: "Shipped",          color: "bg-cyan-100 text-cyan-700",     icon: Truck },
  DELIVERED:        { label: "Delivered",        color: "bg-primary/20 text-primary",   icon: CheckCircle },
  CANCELLED:        { label: "Cancelled",        color: "bg-red-100 text-red-700",       icon: Clock },
  RETURNED:         { label: "Returned",         color: "bg-primary/20 text-primary", icon: RotateCcw },
};

const FILTER_TABS = [
  { value: "",           label: "All Orders" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED",    label: "Shipped" },
  { value: "DELIVERED",  label: "Delivered" },
  { value: "CANCELLED",  label: "Cancelled" },
];

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const statusFilter = searchParams.status;

  const orders = await db.order.findMany({
    where: {
      userId: session.user.id,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        take: 2,
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } },
      },
    },
  });

  const activeTab = statusFilter ?? "";
  const deliveredCount  = orders.filter(o => o.status === "DELIVERED").length;
  const shippedCount    = orders.filter(o => o.status === "SHIPPED").length;
  const processingCount = orders.filter(o => ["CONFIRMED","PROCESSING"].includes(o.status)).length;

  return (
    <MainLayout>
      <div className="bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">My Orders</h1>
              <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? "s" : ""} found</p>
            </div>
            <Link href="/returns" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border bg-white px-3 py-1.5 rounded-xl hover:border-slate-400 transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Returns
            </Link>
          </div>

          {/* Stats */}
          {orders.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-2xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{processingCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-cyan-600">{shippedCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Shipped</p>
              </div>
              <div className="bg-white rounded-2xl border border-border p-4 text-center">
                <p className="text-2xl font-bold text-primary">{deliveredCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Delivered</p>
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5">
            {FILTER_TABS.map(({ value, label }) => (
              <Link key={value} href={value ? `/account/orders?status=${value}` : "/account/orders"}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400 hover:text-foreground"}`}>
                {label}
              </Link>
            ))}
          </div>

          {/* Order list */}
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-semibold text-lg mb-1">No orders yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                {activeTab ? `No ${activeTab.replace(/_/g, " ").toLowerCase()} orders` : "Your orders will appear here after you place them."}
              </p>
              <Link href="/products" className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary transition-colors">
                Start Shopping →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.CONFIRMED;
                const StatusIcon = sc.icon;
                return (
                  <Link key={order.id} href={`/orders/${order.id}`}
                    className="block bg-white rounded-2xl border border-border hover:border-primary/40 hover:shadow-sm transition-all group">
                    <div className="p-4">
                      {/* Top row */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs font-semibold text-muted-foreground">{order.orderNumber}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {sc.label}
                            </span>
                            {order.type === "B2B" && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">B2B</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{format(order.createdAt, "MMM d, yyyy 'at' h:mm a")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{formatCurrency(Number(order.total), order.currency)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>

                      {/* Items preview */}
                      <div className="flex items-center gap-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-muted-foreground text-xs">·</span>}
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {item.nameEn}
                              {item.quantity > 1 && <span className="ms-1 text-xs font-medium text-muted-foreground">×{item.quantity}</span>}
                            </p>
                          </div>
                        ))}
                        {order.items.length === 2 && (
                          <span className="text-xs text-muted-foreground">+ more</span>
                        )}
                      </div>

                      {/* Shipped tracking CTA */}
                      {order.status === "SHIPPED" && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-cyan-600 font-medium">
                          <Truck className="h-3.5 w-3.5" />
                          <span>Track your shipment →</span>
                        </div>
                      )}
                      {order.status === "DELIVERED" && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-primary/100" />
                          <span>Delivered · <Link href="/returns" className="text-primary hover:underline">Return or exchange</Link></span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
