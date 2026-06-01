import { requireSellerSession } from "@/lib/auth";
import { getOrdersForSeller } from "@avenick/database";
import { SellerLayout } from "@/components/layout/seller-layout";
import { OrdersTable, type OrderRow } from "@/components/orders-table";
import { format } from "date-fns";
import Link from "next/link";
import { ShoppingCart, Package, Truck, CheckCircle } from "lucide-react";

export const metadata = { title: "Orders" };

const FILTER_TABS = [
  { value: "", label: "All orders", icon: ShoppingCart },
  { value: "CONFIRMED", label: "Confirmed", icon: Package },
  { value: "PROCESSING", label: "Processing", icon: Package },
  { value: "SHIPPED", label: "Shipped", icon: Truck },
  { value: "DELIVERED", label: "Delivered", icon: CheckCircle },
];

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { seller } = await requireSellerSession();
  const { orders, total } = await getOrdersForSeller(seller.id, { status: searchParams.status as never, limit: 50 });
  const activeTab = searchParams.status ?? "";

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    buyer: `${o.user.firstName} ${o.user.lastName}`.trim(),
    company: o.company?.nameEn ?? "",
    date: format(o.createdAt, "MMM d, yyyy"),
    itemCount: o.items.length,
    total: Number(o.total),
    currency: o.currency,
    type: o.type,
    status: o.status,
  }));

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier}>
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground">{total} total order{total !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/shipments" className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
            <Truck className="h-4 w-4" /> Manage shipments →
          </Link>
        </div>

        {/* Smart filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {FILTER_TABS.map(({ value, label, icon: Icon }) => (
            <Link
              key={value}
              href={value ? `/orders?status=${value}` : "/orders"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${activeTab === value ? "bg-primary text-primary-foreground shadow-glow-sm" : "bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </div>

        <OrdersTable rows={rows} total={total} />
      </div>
    </SellerLayout>
  );
}
