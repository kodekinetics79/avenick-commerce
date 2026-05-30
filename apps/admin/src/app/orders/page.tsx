import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db } from "@manzil/database";
import { formatCurrency } from "@manzil/utils";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle, Clock, AlertTriangle, ExternalLink } from "lucide-react";

export const metadata = { title: "Orders" };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_PAYMENT:  { label: "Pending Payment",  color: "bg-gray-100 text-gray-600" },
  CONFIRMED:        { label: "Confirmed",         color: "bg-blue-100 text-blue-700" },
  PROCESSING:       { label: "Processing",        color: "bg-purple-100 text-purple-700" },
  READY_FOR_PICKUP: { label: "Ready for Pickup",  color: "bg-amber-100 text-amber-700" },
  SHIPPED:          { label: "Shipped",           color: "bg-cyan-100 text-cyan-700" },
  DELIVERED:        { label: "Delivered",         color: "bg-green-100 text-green-700" },
  CANCELLED:        { label: "Cancelled",         color: "bg-red-100 text-red-700" },
  DISPUTED:         { label: "Disputed",          color: "bg-red-200 text-red-800" },
  RETURNED:         { label: "Returned",          color: "bg-orange-100 text-orange-700" },
};

const FILTER_TABS = [
  { value: "",               label: "All",        icon: ShoppingCart },
  { value: "CONFIRMED",      label: "Confirmed",  icon: CheckCircle },
  { value: "PROCESSING",     label: "Processing", icon: Package },
  { value: "SHIPPED",        label: "Shipped",    icon: Truck },
  { value: "DELIVERED",      label: "Delivered",  icon: CheckCircle },
  { value: "CANCELLED",      label: "Cancelled",  icon: Clock },
  { value: "DISPUTED",       label: "Disputed",   icon: AlertTriangle },
];

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  await requireAdminSession();

  const statusFilter = searchParams.status;
  const typeFilter   = searchParams.type;

  const orders = await db.order.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter as never } : {}),
      ...(typeFilter   ? { type:   typeFilter   as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user:    { select: { firstName: true, lastName: true, email: true } },
      company: { select: { nameEn: true } },
      items:   { take: 1 },
    },
  });

  const total        = orders.length;
  const gmv          = orders.reduce((s, o) => s + Number(o.total), 0);
  const b2bCount     = orders.filter(o => o.type === "B2B").length;
  const disputedCount= orders.filter(o => o.status === "DISPUTED").length;

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
          <Link href="/orders" className="text-sm text-blue-600 hover:underline font-medium">Export ↗</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Orders",    value: total,                                color: "text-slate-800", bg: "bg-white border-border" },
            { label: "Total GMV",       value: formatCurrency(gmv, "AED"),           color: "text-green-700", bg: "bg-green-50 border-green-200" },
            { label: "B2B Orders",      value: b2bCount,                             color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
            { label: "Disputes",        value: disputedCount,                        color: disputedCount > 0 ? "text-red-700" : "text-slate-500", bg: disputedCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-border" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Dispute alert */}
        {disputedCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">{disputedCount} disputed order{disputedCount !== 1 ? "s" : ""} need attention</p>
                <p className="text-xs text-red-600">Unresolved disputes affect seller performance scores.</p>
              </div>
            </div>
            <Link href="/support" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium transition-colors">Review →</Link>
          </div>
        )}

        {/* Filter tabs + type filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
            {FILTER_TABS.map(({ value, label, icon: Icon }) => (
              <Link key={value} href={value ? `/orders?status=${value}${typeFilter ? `&type=${typeFilter}` : ""}` : `/orders${typeFilter ? `?type=${typeFilter}` : ""}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400 hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </Link>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[["", "All Types"],["B2C","B2C"],["B2B","B2B"]].map(([v, l]) => (
              <Link key={v} href={v ? `/orders?type=${v}${statusFilter ? `&status=${statusFilter}` : ""}` : `/orders${statusFilter ? `?status=${statusFilter}` : ""}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${(typeFilter ?? "") === v ? "bg-purple-600 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400"}`}>
                {l}
              </Link>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Order #","Customer","Date","Items","Total","Type","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const sc = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={order.id} className={`hover:bg-slate-50 transition-colors ${order.status === "DISPUTED" ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-600">{order.orderNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{order.user.firstName} {order.user.lastName}</p>
                        {order.company && <p className="text-xs text-muted-foreground">{order.company.nameEn}</p>}
                        <p className="text-xs text-muted-foreground">{order.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{format(order.createdAt, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{order.items.length}+</td>
                      <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(Number(order.total), order.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{order.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          <Link href={`/orders/${order.id}`} className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-0.5">
                            <ExternalLink className="h-3 w-3" /> View
                          </Link>
                          {order.status === "CONFIRMED" && (
                            <button type="button" className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-lg hover:bg-purple-600 transition-colors">Process</button>
                          )}
                          {order.status === "PROCESSING" && (
                            <button type="button" className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-lg hover:bg-cyan-600 transition-colors">Ship</button>
                          )}
                          {order.status === "DISPUTED" && (
                            <Link href="/support" className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-lg hover:bg-red-600 transition-colors font-medium">Resolve</Link>
                          )}
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
                <p className="text-sm text-muted-foreground mt-1">{statusFilter ? `No ${statusFilter} orders` : "No orders placed yet"}</p>
              </div>
            )}
          </div>
          {orders.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{orders.length} orders · GMV: {formatCurrency(gmv, "AED")}</p>
              <p className="text-xs text-muted-foreground">Showing latest {orders.length}</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
