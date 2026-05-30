import { requireSellerSession } from "@/lib/auth";
import { getSellerDashboard, MOCK_SELLER_DOCUMENTS, MOCK_SELLER_RFQ_INBOX, MOCK_SELLER_PERFORMANCE } from "@manzil/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { formatCurrency } from "@manzil/utils";
import { format } from "date-fns";
import Link from "next/link";
import {
  ShoppingCart, DollarSign, Package, AlertTriangle, FileCheck, MessageSquare,
  TrendingUp, Activity, Zap, Clock, CheckCircle, XCircle, Star
} from "lucide-react";

export default async function DashboardPage() {
  const { seller } = await requireSellerSession();
  const dash = await getSellerDashboard(seller.id);

  const stats = [
    { label: "Today's Orders", labelAr: "طلبات اليوم", value: dash.todayOrderCount, icon: ShoppingCart, color: "bg-blue-500", urgent: false },
    { label: "Month Revenue", labelAr: "إيرادات الشهر", value: formatCurrency(Number(dash.monthRevenue), "AED"), icon: DollarSign, color: "bg-green-500", urgent: false },
    { label: "Active Listings", labelAr: "قوائم نشطة", value: dash.activeListings, icon: Package, color: "bg-purple-500", urgent: false },
    { label: "Pending Payout", labelAr: "مستحق", value: formatCurrency(Number(dash.pendingPayoutAmount), "AED"), icon: DollarSign, color: "bg-orange-500", urgent: false },
    { label: "Pending Orders", labelAr: "طلبات معلقة", value: dash.pendingOrders, icon: Clock, color: "bg-yellow-500", urgent: dash.pendingOrders > 0 },
    { label: "Product Issues", labelAr: "مشاكل المنتجات", value: dash.issueCount, icon: AlertTriangle, color: "bg-red-500", urgent: dash.issueCount > 0, href: "/issues" },
    { label: "Compliance Issues", labelAr: "وثائق معلقة", value: dash.pendingCompliance, icon: FileCheck, color: "bg-amber-500", urgent: dash.pendingCompliance > 0, href: "/compliance" },
    { label: "Low Stock Items", labelAr: "مخزون منخفض", value: dash.lowStockItems, icon: Zap, color: "bg-red-400", urgent: dash.lowStockItems > 0, href: "/inventory" },
    { label: "Unread Messages", labelAr: "رسائل غير مقروءة", value: dash.unreadMessages, icon: MessageSquare, color: "bg-cyan-500", urgent: dash.unreadMessages > 0, href: "/messages" },
    { label: "Open RFQs", labelAr: "طلبات عروض مفتوحة", value: dash.rfqCount, icon: Activity, color: "bg-indigo-500", urgent: false },
  ];

  // Account health bar
  const health = seller.accountHealth;
  const healthColor = health >= 80 ? "bg-green-500" : health >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} issueCount={dash.issueCount} unreadMessages={dash.unreadMessages}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{seller.businessNameAr ?? seller.businessNameEn}</h1>
            <p className="text-sm text-muted-foreground">{seller.businessNameEn}</p>
          </div>
          <div className="text-end">
            <p className="text-xs text-muted-foreground mb-1">Account Health</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 w-24 h-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`flex-1 rounded-full ${i < Math.floor(health / 10) ? healthColor : "bg-gray-200"}`} />
                ))}
              </div>
              <span className={`text-sm font-bold ${health >= 80 ? "text-green-600" : health >= 60 ? "text-yellow-600" : "text-red-600"}`}>{health}/100</span>
            </div>
          </div>
        </div>

        {/* Action alerts */}
        {(dash.issueCount > 0 || dash.pendingCompliance > 0 || dash.lowStockItems > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Action Required — إجراء مطلوب
            </h3>
            <div className="space-y-1">
              {dash.issueCount > 0 && <Link href="/issues" className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900"><XCircle className="h-3.5 w-3.5 shrink-0" />{dash.issueCount} product{dash.issueCount !== 1 ? "s" : ""} have issues that may affect your sales</Link>}
              {dash.pendingCompliance > 0 && <Link href="/compliance" className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900"><XCircle className="h-3.5 w-3.5 shrink-0" />{dash.pendingCompliance} compliance document{dash.pendingCompliance !== 1 ? "s" : ""} pending review</Link>}
              {dash.lowStockItems > 0 && <Link href="/inventory" className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900"><XCircle className="h-3.5 w-3.5 shrink-0" />{dash.lowStockItems} product{dash.lowStockItems !== 1 ? "s" : ""} below reorder point</Link>}
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className={`bg-white rounded-2xl border ${stat.urgent ? "border-red-200 bg-red-50" : "border-border"} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`h-8 w-8 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
                {stat.urgent && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              {stat.href && <Link href={stat.href} className="text-xs text-orange-600 hover:underline mt-1 block">View →</Link>}
            </div>
          ))}
        </div>

        {/* Additional widgets row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Expiring documents widget */}
          {(() => {
            const expiring = MOCK_SELLER_DOCUMENTS.filter((d) => {
              if (!d.expiryDate) return false;
              const days = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
              return days <= 30 && days > 0;
            });
            return (
              <div className={`bg-white rounded-2xl border p-4 ${expiring.length > 0 ? "border-amber-300 bg-amber-50" : "border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold">Expiring Documents</p>
                </div>
                {expiring.length > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-amber-600">{expiring.length}</p>
                    <p className="text-xs text-amber-700 mt-1">{expiring.map((d) => d.name).join(", ")}</p>
                    <Link href="/documents" className="text-xs text-orange-600 hover:underline mt-2 block">Manage →</Link>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-600">0</p>
                    <p className="text-xs text-muted-foreground mt-1">All documents valid</p>
                  </>
                )}
              </div>
            );
          })()}

          {/* Pending RFQs widget */}
          {(() => {
            const pending = MOCK_SELLER_RFQ_INBOX.filter((r) => r.status === "PENDING");
            return (
              <div className={`bg-white rounded-2xl border p-4 ${pending.length > 0 ? "border-blue-300 bg-blue-50" : "border-border"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <p className="text-sm font-semibold">Pending RFQs</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{pending.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting your quote response</p>
                {pending.length > 0 && (
                  <Link href="/messages" className="text-xs text-orange-600 hover:underline mt-2 block">Respond →</Link>
                )}
              </div>
            );
          })()}

          {/* Performance score widget */}
          <div className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-semibold">Performance Score</p>
            </div>
            <p className={`text-2xl font-bold ${MOCK_SELLER_PERFORMANCE.overallScore >= 80 ? "text-green-600" : MOCK_SELLER_PERFORMANCE.overallScore >= 60 ? "text-yellow-600" : "text-red-600"}`}>
              {MOCK_SELLER_PERFORMANCE.overallScore}/100
            </p>
            <p className="text-xs text-muted-foreground mt-1">On-time: {MOCK_SELLER_PERFORMANCE.onTimeDelivery}% · Returns: {MOCK_SELLER_PERFORMANCE.returnRate}%</p>
            <Link href="/performance" className="text-xs text-orange-600 hover:underline mt-2 block">View details →</Link>
          </div>
        </div>

        {/* Recent orders */}
        {dash.recentOrders.length > 0 && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold">Recent Orders — الطلبات الأخيرة</h2>
              <Link href="/orders" className="text-sm text-orange-600 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-border">
              {dash.recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{format(order.createdAt, "MMM d, yyyy")} · {order.type}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-semibold text-sm">{formatCurrency(Number(order.total), order.currency)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${order.status === "DELIVERED" ? "bg-green-100 text-green-700" : order.status === "PROCESSING" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{order.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
