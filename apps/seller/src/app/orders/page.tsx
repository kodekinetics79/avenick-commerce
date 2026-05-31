import { requireSellerSession } from "@/lib/auth";
import { getOrdersForSeller } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle } from "lucide-react";

export const metadata = { title: "Orders" };

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: "bg-gray-100 text-gray-600",
  CONFIRMED:       "bg-blue-100 text-blue-700",
  PROCESSING:      "bg-purple-100 text-purple-700",
  READY_FOR_PICKUP:"bg-amber-100 text-amber-700",
  SHIPPED:         "bg-cyan-100 text-cyan-700",
  DELIVERED:       "bg-green-100 text-green-700",
  CANCELLED:       "bg-red-100 text-red-700",
  REFUNDED:        "bg-orange-100 text-orange-700",
};

const FILTER_TABS = [
  { value: "", label: "All Orders", icon: ShoppingCart },
  { value: "CONFIRMED", label: "Confirmed", icon: Package },
  { value: "PROCESSING", label: "Processing", icon: Package },
  { value: "SHIPPED", label: "Shipped", icon: Truck },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { seller } = await requireSellerSession();
  const { orders, total } = await getOrdersForSeller(seller.id, { status: searchParams.status as never, limit: 50 });

  const activeTab = searchParams.status ?? "";

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Orders</h1>
            <p className="text-sm text-muted-foreground">{total} total order{total !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/shipments" className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline font-medium">
            <Truck className="h-4 w-4" /> Manage Shipments →
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map(({ value, label, icon: Icon }) => (
            <Link key={value} href={value ? `/orders?status=${value}` : "/orders"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-slate-900 text-white" : "bg-white border border-border text-muted-foreground hover:border-slate-400 hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-border">
                <tr>
                  {["Order #","Buyer","Date","Items","Total","Type","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-slate-600">{order.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{format(order.createdAt, "MMM d")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{order.user.firstName} {order.user.lastName}</p>
                      {order.company && <p className="text-xs text-muted-foreground">{order.company.nameEn}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{format(order.createdAt, "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-sm font-medium text-center">{order.items.length}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(Number(order.total), order.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.type === "B2B" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {order.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/orders/${order.id}`} className="text-xs text-blue-600 hover:underline font-medium">View</Link>
                        {order.status === "CONFIRMED" && (
                          <button type="button" className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-lg hover:bg-green-600 transition-colors font-medium">Mark Ready</button>
                        )}
                        {order.status === "PROCESSING" && (
                          <button type="button" className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-lg hover:bg-cyan-600 transition-colors font-medium">Ship</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 && (
              <div className="text-center py-16">
                <ShoppingCart className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                <p className="font-semibold text-muted-foreground">No orders found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeTab ? `No ${activeTab.replace(/_/g, " ").toLowerCase()} orders` : "Orders will appear here once buyers place them"}
                </p>
              </div>
            )}
          </div>
          {orders.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Showing {orders.length} of {total} orders</p>
              <Link href="/shipments" className="text-xs text-blue-600 hover:underline font-medium">Manage Shipments →</Link>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
