import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Package, Truck, Home, AlertCircle, ArrowLeft,
  MapPin, RotateCcw, Clock,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Button, CellGrid, Dateline, Eyebrow, FieldWell, Num, StatusPill, Surface,
  type PillTone,
} from "@avenick/ui";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { cn, formatCurrency, isRecordId } from "@avenick/utils";

const MACRO_STEPS = [
  // "Confirmed" is an order state, not a payment state: bank-transfer and
  // on-terms orders are confirmed before any money moves. Payment is reported
  // separately from paymentStatus.
  { key: "CONFIRMED", label: "Order confirmed", icon: CheckCircle, rank: 1, desc: "Order confirmed with the supplier." },
  { key: "PROCESSING", label: "Processing", icon: Package, rank: 2, desc: "Supplier is preparing your items." },
  { key: "SHIPPED", label: "Shipped", icon: Truck, rank: 3, desc: "Order is on its way to you." },
  { key: "DELIVERED", label: "Delivered", icon: Home, rank: 4, desc: "Order delivered successfully." },
];

const RANK: Record<string, number> = {
  PENDING_PAYMENT: 0, PAYMENT_CONFIRMED: 1, CONFIRMED: 1, PROCESSING: 2,
  SHIPPED: 3, OUT_FOR_DELIVERY: 3, DELIVERED: 4, RETURN_REQUESTED: 4, RETURNED: 4,
  CANCELLED: -1, REFUNDED: -1,
};

/**
 * Status to pill tone. The colours are the design system's semantic set rather
 * than hand-mixed alphas of the brand hue, which is what gives them a dark-mode
 * value and keeps a "delivered" order and a "verified" seller distinguishable.
 */
const STATUS_TONE: Record<string, PillTone> = {
  CONFIRMED: "primary",
  PROCESSING: "accent",
  SHIPPED: "primary",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "danger",
  RETURN_REQUESTED: "warning",
  RETURNED: "warning",
  PENDING_PAYMENT: "warning",
};

const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type OrderStatusHistoryEntry = {
  id: string;
  status: string;
  message?: string | null;
  createdAt: Date;
};

/**
 * Human label for the order's real payment state.
 *
 * "On terms" used to be shown for every B2B order that was not PAID — including
 * one that was partially paid, or a B2B cart checkout awaiting a bank transfer
 * with no credit terms at all. Terms are only real when the order came through
 * an approved purchase order AND the buying company has a non-zero payment
 * term (Company.paymentTerms, in days); everything else is described by the
 * PaymentStatus enum as stored.
 */
function paymentLabel(order: {
  type: string;
  status: string;
  paymentStatus: string;
  purchaseOrderId: string | null;
  company: { paymentTerms: number } | null;
}): string {
  switch (order.paymentStatus) {
    case "PAID": return "Paid";
    case "PARTIALLY_PAID": return "Partially paid";
    case "REFUNDED": return "Refunded";
    case "FAILED": return "Payment failed";
    case "UNPAID": {
      // A cancelled order is not waiting for money; nothing was charged.
      if (order.status === "CANCELLED") return "Not charged";
      const onApprovedTerms = order.type === "B2B" && order.purchaseOrderId !== null && (order.company?.paymentTerms ?? 0) > 0;
      return onApprovedTerms ? `On terms · net ${order.company!.paymentTerms} days` : "Awaiting payment";
    }
    default: return order.paymentStatus.replace(/_/g, " ");
  }
}

/** Delivery cell: derived from the order's status rank, with the closed states named rather than shown as "Preparing". */
function deliveryLabel(status: string, rank: number, isDelivered: boolean): string {
  if (isDelivered) return "Delivered";
  if (status === "RETURNED" || status === "RETURN_REQUESTED") return "Returned";
  if (status === "REFUNDED") return "Refunded";
  if (rank < 0) return "Cancelled";
  if (rank >= 3) return "In transit";
  if (rank >= 1) return "Preparing";
  return "Not started";
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) notFound();
  if (!isRecordId(params.id)) notFound();

  const order = await db.order.findFirst({
    where: { id: params.id, userId },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      company: { select: { paymentTerms: true } },
    },
  });
  if (!order) notFound();

  const currentRank = RANK[order.status] ?? 0;
  const addr = (order.shippingAddress as { line1?: string; city?: string; country?: string } | null) ?? {};
  const subtotal = Number(order.subtotal);
  const vat = Number(order.vatAmount);
  const statusTone = STATUS_TONE[order.status] ?? "neutral";
  const isDelivered = order.status === "DELIVERED";
  const currency = order.currency as never;

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl px-4 py-block">
        <Link
          href="/account/orders"
          className="u-focus mb-6 inline-flex items-center gap-1.5 rounded-nested text-meta text-ink-3 transition-colors duration-press ease-standard hover:text-ink-1"
        >
          {/* A direction-implying icon has to flip, or the page reads backwards
              in Arabic. */}
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> Back to my orders
        </Link>

        <header className="mb-block border-b border-border-strong pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Eyebrow>Order</Eyebrow>
              {/* Mono is for identifiers — an order reference is the canonical
                  one. Money below it is not mono. */}
              <h1 className="u-mono mt-1 text-h2 text-ink-1">{order.orderNumber}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill tone={statusTone} dot>{order.status.replace(/_/g, " ")}</StatusPill>
                <StatusPill tone={order.type === "B2B" ? "accent" : "neutral"}>{order.type}</StatusPill>
              </div>
              <p className="mt-2 text-meta text-ink-3">
                Placed on {order.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="text-end">
              <Eyebrow>Order total</Eyebrow>
              <Num rank="section" value={formatCurrency(Number(order.total), currency)} className="mt-1" />
              {/* LAW E: what the figure is, in the order's own currency, with no
                  conversion — the same statement the finance surfaces make. */}
              <Dateline className="mt-1">Including VAT · as recorded on the order in {order.currency}</Dateline>
            </div>
          </div>
        </header>

        <div className="space-y-stack">
          {/* One hairline-divided panel rather than three tinted boxes: these are
              three readings of the same order, not three objects. */}
          <CellGrid cols={{ base: 1, sm: 3 }}>
            {[
              { label: "Items", value: String(order.items.length) },
              { label: "Payment", value: paymentLabel(order) },
              { label: "Delivery", value: deliveryLabel(order.status, currentRank, isDelivered) },
            ].map(({ label, value }) => (
              <div key={label}>
                <Eyebrow>{label}</Eyebrow>
                {/* No `capitalize`: it title-cased every word, so "On terms · net
                    30 days" came out as "On Terms · Net 30 Days". */}
                <p className="mt-1 text-lead text-ink-1">{value}</p>
              </div>
            ))}
          </CellGrid>

          {/* Macro status stepper */}
          <Surface rung={2} className="p-5">
            <h2 className="text-h3 text-ink-1">Order status</h2>
            <ol className="mt-5">
              {MACRO_STEPS.map((step, idx) => {
                const reached = currentRank >= step.rank;
                const isCurrent = currentRank === step.rank;
                const isLast = idx === MACRO_STEPS.length - 1;
                const Icon = step.icon;
                const entry = order.statusHistory.find((h: OrderStatusHistoryEntry) => h.status === step.key);
                return (
                  <li key={step.key} className="flex gap-4" aria-current={isCurrent ? "step" : undefined}>
                    <div className="flex flex-col items-center">
                      {/* Reached steps are filled and carry the light seam; the
                          ones ahead are recessed. The ladder does the work the
                          old indigo glow was doing — but NOT with rung 3: an
                          order can have four reached steps, and four raised
                          objects that cannot be pressed would outnumber the two
                          buttons on this page that can. Raised means actionable
                          or it means nothing. */}
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-pill",
                          reached ? "bg-primary text-primary-foreground shadow-seam" : "bg-surface-1 text-ink-3 shadow-elev-1",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      {!isLast && <span className={cn("my-0.5 w-0.5 flex-1", currentRank > step.rank ? "bg-primary/40" : "bg-hairline")} aria-hidden="true" />}
                    </div>
                    <div className={cn("flex-1", isLast ? "pb-0" : "pb-8")}>
                      <p className={cn("flex flex-wrap items-center gap-2 text-ui font-medium", reached ? "text-ink-1" : "text-ink-3")}>
                        {step.label}
                        {isCurrent && <StatusPill tone="primary">Current</StatusPill>}
                      </p>
                      <p className="mt-0.5 text-meta text-ink-3">{entry ? fmt(entry.createdAt) : reached ? step.desc : "Upcoming"}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Surface>

          {/* Real activity timeline (status history) */}
          {order.statusHistory.length > 0 && (
            <Surface rung={2} className="p-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-ink-3" aria-hidden="true" />
                <h2 className="text-h3 text-ink-1">Order activity</h2>
              </div>
              <Dateline className="mt-1">Status changes as written to this order, newest first</Dateline>
              <ol className="mt-4 space-y-3">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <li key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-pill", i === 0 ? "bg-primary" : "bg-border-strong")} aria-hidden="true" />
                      {i < order.statusHistory.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-hairline" aria-hidden="true" />}
                    </div>
                    <div className="pb-2">
                      <p className={cn("text-ui", i === 0 ? "font-medium text-ink-1" : "text-ink-2")}>{h.message ?? h.status.replace(/_/g, " ")}</p>
                      <p className="text-meta text-ink-3">{fmt(h.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Surface>
          )}

          {/* Items */}
          <Surface rung={2} className="overflow-hidden">
            <div className="border-b-2 border-border-strong px-5 py-4">
              <h2 className="text-h3 text-ink-1">Items</h2>
              <p className="mt-0.5 text-meta text-ink-3">{order.items.length} line{order.items.length !== 1 ? "s" : ""} on this order</p>
            </div>
            <ul className="divide-y divide-hairline">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-nested bg-surface-1 text-ink-3">
                      <Package className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-ui font-medium text-ink-1">{item.nameEn}</p>
                      <p className="text-meta text-ink-3">
                        Qty <span className="tnum">{item.quantity}</span> × <span className="tnum">{formatCurrency(Number(item.unitPrice), currency)}</span>
                      </p>
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-ui text-ink-1">{formatCurrency(Number(item.total), currency)}</span>
                </li>
              ))}
            </ul>
          </Surface>

          {/* Delivery + summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Surface rung={2} className="p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ink-3" aria-hidden="true" />
                <h2 className="text-h3 text-ink-1">Delivery address</h2>
              </div>
              <p className="mt-3 text-ui text-ink-1">{addr.line1 ?? "—"}</p>
              <p className="text-ui text-ink-2">{[addr.city, addr.country].filter(Boolean).join(", ")}</p>
            </Surface>

            <Surface rung={2} className="p-5">
              <h2 className="text-h3 text-ink-1">Summary</h2>
              <FieldWell className="mt-3 space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ui text-ink-2">Subtotal</span>
                  <span className="tnum text-ui text-ink-1">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ui text-ink-2">VAT</span>
                  <span className="tnum text-ui text-ink-1">{formatCurrency(vat, currency)}</span>
                </div>
              </FieldWell>
              <div className="mt-4 flex items-baseline justify-between gap-4 border-t-2 border-border-strong pt-4">
                <span className="text-ui font-medium text-ink-1">Total</span>
                <Num value={formatCurrency(Number(order.total), currency)} />
              </div>
            </Surface>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {isDelivered && (
              <Button asChild variant="secondary" className="flex-1">
                <Link href="/returns">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Return / exchange
                </Link>
              </Button>
            )}
            <Button asChild variant="secondary" className="flex-1">
              <Link href="/support">
                <AlertCircle className="h-4 w-4" aria-hidden="true" /> Report an issue
              </Link>
            </Button>
            {/* No "Invoice" button: nothing issues TaxInvoice rows yet, and the button it replaced did nothing when clicked. */}
          </div>

          {/* The old trust line read "…are re-validated when an order is
              submitted" — present tense, on a page whose order was submitted
              some time ago. The fact it was standing in for is the one worth
              stating: every figure here was read back off the order, and none of
              it is recomputed in the browser. */}
          <Dateline className="text-center">
            Every figure on this page is as recorded on the order · price, tax and availability were re-validated by the server when it was submitted, and nothing here is recalculated in the browser
          </Dateline>
        </div>
      </div>
    </MainLayout>
  );
}
