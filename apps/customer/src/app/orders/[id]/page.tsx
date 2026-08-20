import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Package, Truck, Home, AlertCircle, ArrowLeft,
  MapPin, RotateCcw, ShieldCheck, FileText, Clock,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { formatCurrency } from "@avenick/utils";

const MACRO_STEPS = [
  { key: "CONFIRMED", label: "Order confirmed", icon: CheckCircle, rank: 1, desc: "Payment received and order confirmed." },
  { key: "PROCESSING", label: "Processing", icon: Package, rank: 2, desc: "Supplier is preparing your items." },
  { key: "SHIPPED", label: "Shipped", icon: Truck, rank: 3, desc: "Order is on its way to you." },
  { key: "DELIVERED", label: "Delivered", icon: Home, rank: 4, desc: "Order delivered successfully." },
];

const RANK: Record<string, number> = {
  PENDING_PAYMENT: 0, PAYMENT_CONFIRMED: 1, CONFIRMED: 1, PROCESSING: 2,
  SHIPPED: 3, OUT_FOR_DELIVERY: 3, DELIVERED: 4, RETURN_REQUESTED: 4, RETURNED: 4,
  CANCELLED: -1, REFUNDED: -1,
};

const STATUS_BADGE: Record<string, string> = {
  CONFIRMED: "bg-primary/15 text-primary",
  PROCESSING: "bg-accent/15 text-accent",
  SHIPPED: "bg-primary/15 text-primary",
  DELIVERED: "bg-success/15 text-success",
  CANCELLED: "bg-danger/15 text-danger",
};

const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type OrderStatusHistoryEntry = {
  id: string;
  status: string;
  message?: string | null;
  createdAt: Date;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  type: string;
  createdAt: Date;
  total: string | number;
  subtotal: string | number;
  vatAmount: string | number;
  paymentStatus: string;
  currency: string;
  shippingAddress: { line1?: string; city?: string; country?: string } | null;
  items: Array<{ id: string; nameEn: string; quantity: number; unitPrice: string | number; total: string | number }>;
  statusHistory: OrderStatusHistoryEntry[];
  taxInvoice?: { invoiceNo: string } | null;
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) notFound();

  const order = await db.order.findFirst({
    where: { id: params.id, userId },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      taxInvoice: { select: { invoiceNo: true } },
    },
  });
  if (!order) notFound();

  const currentRank = RANK[order.status] ?? 0;
  const addr = (order.shippingAddress as { line1?: string; city?: string; country?: string } | null) ?? {};
  const subtotal = Number(order.subtotal);
  const vat = Number(order.vatAmount);
  const badge = STATUS_BADGE[order.status] ?? STATUS_BADGE.CONFIRMED;
  const isDelivered = order.status === "DELIVERED";
  const currency = order.currency as never;

  return (
    <MainLayout>
      <div className="bg-background min-h-screen">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/account/orders" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to my orders
          </Link>

          {/* Header */}
          <div className="rounded-2xl border border-border bg-card p-5 mb-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold font-mono">{order.orderNumber}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{order.status.replace(/_/g, " ")}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${order.type === "B2B" ? "bg-accent/15 text-accent" : "bg-primary/15 text-primary"}`}>{order.type}</span>
                </div>
                <p className="text-sm text-muted-foreground">Placed on {order.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-bold font-mono text-foreground">{formatCurrency(Number(order.total), currency)}</p>
                <p className="text-xs text-muted-foreground">incl. VAT</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[
                { label: "Items", value: String(order.items.length) },
                { label: "Payment", value: order.paymentStatus === "PAID" ? "Paid" : order.type === "B2B" ? "On terms" : order.paymentStatus.replace(/_/g, " ") },
                { label: "Delivery", value: isDelivered ? "Delivered" : currentRank >= 3 ? "In transit" : "Preparing" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-secondary/60 rounded-xl p-2.5">
                  <p className="font-bold capitalize">{value.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Macro status stepper */}
          <div className="rounded-2xl border border-border bg-card p-5 mb-5">
            <h2 className="font-semibold mb-5">Order status</h2>
            <div>
              {MACRO_STEPS.map((step, idx) => {
                const reached = currentRank >= step.rank;
                const isCurrent = currentRank === step.rank;
                const isLast = idx === MACRO_STEPS.length - 1;
                const Icon = step.icon;
                const entry = order.statusHistory.find((h: OrderStatusHistoryEntry) => h.status === step.key);
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${reached ? "bg-primary shadow-glow-sm" : "bg-secondary"}`}>
                        <Icon className={`h-4 w-4 ${reached ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      </div>
                      {!isLast && <div className={`w-0.5 h-10 my-0.5 ${currentRank > step.rank ? "bg-primary/40" : "bg-border"}`} />}
                    </div>
                    <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
                      <p className={`font-semibold text-sm ${reached ? "" : "text-muted-foreground"}`}>
                        {step.label}
                        {isCurrent && <span className="ms-2 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase">Current</span>}
                      </p>
                      <p className="text-xs mt-0.5 text-muted-foreground">{entry ? fmt(entry.createdAt) : reached ? step.desc : "Upcoming"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real activity timeline (status history) */}
          {order.statusHistory.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 mb-5">
              <div className="flex items-center gap-2 mb-4"><Clock className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Order activity</h2></div>
              <div className="space-y-3">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <div key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`h-2.5 w-2.5 rounded-full mt-1 shrink-0 ${i === 0 ? "bg-primary" : "bg-border"}`} />
                      {i < order.statusHistory.length - 1 && <div className="w-0.5 flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-2">
                      <p className={`text-sm font-medium ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>{h.message ?? h.status.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">{fmt(h.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">Items ({order.items.length})</h2></div>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="text-sm font-medium">{item.nameEn}</p>
                      <p className="text-xs text-muted-foreground">Qty {item.quantity} × {formatCurrency(Number(item.unitPrice), currency)}</p>
                    </div>
                  </div>
                  <p className="font-bold font-mono text-sm">{formatCurrency(Number(item.total), currency)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery + summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3"><MapPin className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold text-sm">Delivery address</h2></div>
              <p className="text-sm font-medium">{addr.line1 ?? "—"}</p>
              <p className="text-sm text-muted-foreground">{[addr.city, addr.country].filter(Boolean).join(", ")}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold text-sm mb-3">Summary</h2>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(subtotal, currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="font-mono">{formatCurrency(vat, currency)}</span></div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border"><span>Total</span><span className="font-mono">{formatCurrency(Number(order.total), currency)}</span></div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isDelivered && (
              <Link href="/returns" className="flex-1 flex items-center justify-center gap-2 bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-primary font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
                <RotateCcw className="h-4 w-4" /> Return / exchange
              </Link>
            )}
            <Link href="/support" className="flex-1 flex items-center justify-center gap-2 bg-card border border-border text-muted-foreground hover:border-danger/40 hover:text-danger font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
              <AlertCircle className="h-4 w-4" /> Report an issue
            </Link>
            {order.taxInvoice && (
              <button type="button" className="flex-1 flex items-center justify-center gap-2 bg-card border border-border text-muted-foreground hover:text-foreground font-medium px-4 py-2.5 rounded-xl text-sm transition-colors">
                <FileText className="h-4 w-4" /> Invoice {order.taxInvoice.invoiceNo}
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Price, tax and availability are revalidated when an order is submitted
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
