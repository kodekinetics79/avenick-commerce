import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";
import { SellerLayout } from "@/components/layout/seller-layout";
import { requireSellerAnyPermission } from "@/lib/auth";

export const metadata = { title: "Order detail" };

export default async function SellerOrderDetailPage({ params }: { params: { id: string } }) {
  const { seller, membership } = await requireSellerAnyPermission(["orders.view", "orders.fulfill"]);
  const order = await db.order.findFirst({
    where: { id: params.id, items: { some: { sellerId: seller.id } } },
    select: {
      orderNumber: true,
      createdAt: true,
      currency: true,
      type: true,
      status: true,
      user: { select: { firstName: true, lastName: true } },
      company: { select: { nameEn: true } },
      items: {
        where: { sellerId: seller.id },
        select: {
          id: true,
          nameEn: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          vatAmount: true,
          total: true,
          status: true,
        },
      },
    },
  });
  if (!order) notFound();

  const sellerSubtotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const sellerVat = order.items.reduce((sum, item) => sum + Number(item.vatAmount), 0);
  const sellerTotal = order.items.reduce((sum, item) => sum + Number(item.total), 0);
  const buyer = `${order.user.firstName} ${order.user.lastName}`.trim();

  return (
    <SellerLayout sellerName={seller.businessNameEn} tier={seller.tier} permissions={membership.permissions}>
      <div className="space-y-6">
        <div>
          <Link href="/orders" className="text-sm font-medium text-primary hover:underline">← Back to orders</Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
              <p className="text-sm text-muted-foreground">
                {buyer}{order.company?.nameEn ? ` · ${order.company.nameEn}` : ""} · {format(order.createdAt, "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{order.type}</span>
              <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                {order.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Your seller lines ({order.items.length})</h2>
            <p className="text-xs text-muted-foreground">Only {seller.businessNameEn} items and totals are shown.</p>
          </div>
          <div className="divide-y divide-border">
            {order.items.map((item) => (
              <div key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium">{item.nameEn}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · Qty {item.quantity}</p>
                  <p className="mt-1 text-xs font-medium text-primary">{item.status.replace(/_/g, " ")}</p>
                </div>
                <p className="font-mono font-semibold">{formatCurrency(Number(item.total), order.currency as "AED")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="ms-auto w-full max-w-md space-y-2 rounded-2xl border border-border bg-card p-5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Seller subtotal</span><span>{formatCurrency(sellerSubtotal, order.currency as "AED")}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span>{formatCurrency(sellerVat, order.currency as "AED")}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Seller total</span><span>{formatCurrency(sellerTotal, order.currency as "AED")}</span></div>
        </section>
      </div>
    </SellerLayout>
  );
}
