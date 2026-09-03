import { requireAdminSession } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/admin-layout";
import { db, ORDER_INTERNAL_NOTE_ENTITY, type OrderStatus } from "@avenick/database";
import { formatCurrency, isRecordId } from "@avenick/utils";
import { format } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Package, CheckCircle, Truck, Navigation, Home, AlertTriangle, User, Building2, StickyNote } from "lucide-react";
import {
  PageHeader, Surface, FieldWell, StatusPill, Num, Eyebrow, Dateline, Divider,
  type PillTone,
} from "@avenick/ui";
import { CountStat, MoneyStat } from "@/app/finance/money-figures";
import { OrderControls } from "../order-controls";

export const metadata = { title: "Order Detail" };

/** Same four-state tone vocabulary as the orders register. See the note there. */
const STATUS_CONFIG: Record<OrderStatus, { label: string; tone: PillTone }> = {
  PENDING_PAYMENT:   { label: "Pending Payment",   tone: "warning" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", tone: "accent" },
  CONFIRMED:         { label: "Confirmed",         tone: "accent" },
  PROCESSING:        { label: "Processing",        tone: "neutral" },
  SHIPPED:           { label: "Shipped",           tone: "neutral" },
  OUT_FOR_DELIVERY:  { label: "Out for Delivery",  tone: "neutral" },
  DELIVERED:         { label: "Delivered",         tone: "success" },
  CANCELLED:         { label: "Cancelled",         tone: "danger" },
  REFUNDED:          { label: "Refunded",          tone: "warning" },
  RETURN_REQUESTED:  { label: "Return Requested",  tone: "warning" },
  RETURNED:          { label: "Returned",          tone: "neutral" },
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
      <div className="space-y-block">
        <PageHeader
          linkComponent={Link}
          breadcrumbs={[{ label: "Orders", href: "/orders" }, { label: order.orderNumber }]}
          eyebrow="Order"
          title={order.orderNumber}
          dateline={`Placed ${format(order.createdAt, "MMM d, yyyy 'at' h:mm a")}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={sc.tone}>{sc.label}</StatusPill>
              <StatusPill tone={order.type === "B2B" ? "accent" : "neutral"}>{order.type}</StatusPill>
            </div>
          }
        />

        {/* The money band. Recessed, because it is context — and the controls
            raised on top of it are the actions. That is the whole of law A in
            one object. */}
        <FieldWell className="p-4">
          {/* A plain grid, not a CellGrid: the well IS the object here, and a
              bordered panel inside a bordered panel is the boxes-inside-boxes
              read the hairline rules exist to prevent. */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MoneyStat
              label="Order total"
              lines={[{ currency: order.currency, formatted: formatCurrency(Number(order.total), order.currency) }]}
              rank="section"
              dateline={`Billed in ${order.currency}, VAT included · no conversion applied`}
            />
            <CountStat label="Subtotal" value={formatCurrency(subtotal, order.currency)} />
            <CountStat label="VAT" value={formatCurrency(vatAmount, order.currency)} />
            <CountStat
              label="Payment"
              value={order.paymentStatus.toLowerCase().replace(/_/g, " ")}
              note={order.paymentMethod ?? "no method recorded"}
            />
          </div>

          {/* Status actions. There is no invoice download here: nothing in the
              system writes TaxInvoice rows yet, so a button would only ever fail. */}
          <Divider className="my-4" />
          <OrderControls orderId={order.id} status={order.status} paymentStatus={order.paymentStatus} governed={Boolean(order.purchaseOrderId)} variant="detail" />
        </FieldWell>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-4 lg:col-span-2">

            {/* Order timeline */}
            <Surface className="p-5">
              <h2 className="u-h3 text-ink-1">Order timeline</h2>
              {terminal && (
                <Dateline className="mt-1">
                  This order is {sc.label.toLowerCase()}; the fulfilment steps below stop where it left the chain.
                </Dateline>
              )}
              <div className="mt-5">
                {TIMELINE_STEPS.map((step, idx) => {
                  const entry     = order.statusHistory.find(h => h.status === step.status);
                  const isReached = !!entry || (currentRank !== undefined && idx <= currentRank);
                  const isCurrent = order.status === step.status;
                  const isLast    = idx === TIMELINE_STEPS.length - 1;
                  const Icon      = step.icon;
                  return (
                    <div key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        {/* Three states, three tones: where the order is now,
                            where it has been, and where it has not reached. */}
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-pill ${
                            isCurrent
                              ? "bg-accent text-accent-foreground ring-4 ring-accent/20"
                              : isReached
                                ? "bg-success text-success-foreground"
                                : "border border-border bg-surface-1 text-ink-3"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        {!isLast && (
                          <div className={`my-1 w-0.5 flex-1 ${isReached && !isCurrent ? "bg-success/40" : "bg-hairline"}`} />
                        )}
                      </div>
                      <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
                        <p className={`u-ui font-medium ${!isReached && !isCurrent ? "text-ink-3" : "text-ink-1"}`}>
                          {step.label}
                          {isCurrent && (
                            <StatusPill tone="accent" className="ms-2 align-middle">Current</StatusPill>
                          )}
                        </p>
                        <p className="u-meta mt-0.5 text-ink-3">
                          {entry ? `${format(entry.createdAt, "MMM d, h:mm a")}${entry.message ? ` · ${entry.message}` : ""}` : isReached ? "No timestamp recorded" : "Not yet"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {order.statusHistory.some((h) => CHAIN_RANK.get(h.status) === undefined) && (
                <div className="mt-5 border-t border-hairline pt-4">
                  <Eyebrow className="mb-2">Other status events</Eyebrow>
                  <ul className="space-y-1">
                    {order.statusHistory.filter((h) => CHAIN_RANK.get(h.status) === undefined).map((h) => (
                      <li key={h.id} className="u-meta text-ink-2">
                        {format(h.createdAt, "MMM d, h:mm a")} · {STATUS_CONFIG[h.status].label}{h.message ? ` · ${h.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Surface>

            {/* Items */}
            <Surface className="overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 border-b-2 border-border-strong px-5 py-3">
                <h2 className="u-h3 text-ink-1">Order items</h2>
                <span className="fig u-meta text-ink-3">{order.items.length}</span>
              </div>
              <div>
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-3 last:border-b-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-nested bg-neutral-soft text-ink-3">
                        <Package className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="u-ui font-medium text-ink-1">{item.nameEn}</p>
                        <p className="u-meta text-ink-3">
                          SKU <span className="u-mono">{item.sku}</span> · Supplier: {item.product?.seller?.businessNameEn ?? "—"}
                        </p>
                        <p className="u-meta text-ink-3">
                          Qty {item.quantity} × {formatCurrency(Number(item.unitPrice), order.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Num value={formatCurrency(Number(item.total), order.currency)} />
                      <StatusPill tone={STATUS_CONFIG[item.status].tone}>{STATUS_CONFIG[item.status].label}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
              {/* The reconciliation: subtotal, VAT and total in one column so a
                  discrepancy between them is a straight vertical read. */}
              <FieldWell className="rounded-none border-x-0 border-b-0 px-5 py-4">
                <dl className="ms-auto flex max-w-xs flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-6">
                    <dt className="u-ui text-ink-2">Subtotal</dt>
                    <dd className="fig u-ui text-ink-1">{formatCurrency(subtotal, order.currency)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6">
                    <dt className="u-ui text-ink-2">VAT</dt>
                    <dd className="fig u-ui text-ink-1">{formatCurrency(vatAmount, order.currency)}</dd>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-6 border-t border-border-strong pt-2">
                    <dt className="u-ui font-medium text-ink-1">Total</dt>
                    <dd><Num value={formatCurrency(Number(order.total), order.currency)} /></dd>
                  </div>
                </dl>
              </FieldWell>
            </Surface>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Customer */}
            <Surface className="p-4">
              <Eyebrow className="mb-3 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" aria-hidden="true" /> Customer
              </Eyebrow>
              <p className="u-ui font-medium text-ink-1">{order.user.firstName} {order.user.lastName}</p>
              <p className="u-meta text-ink-3">{order.user.email}</p>
              {order.company && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-hairline pt-2">
                  <Building2 className="h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                  <span className="u-meta text-ink-2">{order.company.nameEn}</span>
                </div>
              )}
            </Surface>

            {/* Shipping address */}
            <Surface className="p-4">
              <Eyebrow className="mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Delivery address
              </Eyebrow>
              {order.shippingAddress && typeof order.shippingAddress === "object" ? (
                <address className="u-ui not-italic text-ink-2">
                  {Object.entries(order.shippingAddress as Record<string, unknown>)
                    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
                    .map(([k, v]) => (
                      <span key={k} className="block">{String(v)}</span>
                    ))}
                </address>
              ) : (
                <p className="u-ui text-ink-3">Not specified</p>
              )}
            </Surface>

            {/* Order meta */}
            <Surface className="p-4">
              <Eyebrow className="mb-3">Order info</Eyebrow>
              <dl className="space-y-2">
                {[
                  ["Order #", order.orderNumber],
                  ["Type", order.type],
                  ["Currency", order.currency],
                  ["Payment method", order.paymentMethod ?? "—"],
                  ["Payment status", order.paymentStatus.replace(/_/g, " ")],
                  ["Created", format(order.createdAt, "MMM d, yyyy")],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="u-meta text-ink-3">{k}</dt>
                    <dd className="u-meta text-end font-medium text-ink-1">{v}</dd>
                  </div>
                ))}
              </dl>
            </Surface>

            {/* Customer's checkout note — written by the buyer, shown to the buyer */}
            {order.notes && (
              <Surface tone="warning" className="p-4">
                <Eyebrow className="mb-2 flex items-center gap-1.5 text-warning-ink">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Customer note
                </Eyebrow>
                <p className="u-ui whitespace-pre-wrap text-ink-1">{order.notes}</p>
              </Surface>
            )}

            {/* Internal notes — staff only */}
            <Surface className="p-4">
              <Eyebrow className="mb-3 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Internal notes
              </Eyebrow>
              {internalNotes.length === 0 ? (
                <p className="u-meta text-ink-3">No internal note has been written on this order.</p>
              ) : (
                <ul className="space-y-3">
                  {internalNotes.map((entry) => {
                    const note = (entry.after as { note?: unknown } | null)?.note;
                    const author = entry.actor ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim() || entry.actor.email : "Unknown staff member";
                    return (
                      <li key={entry.id} className="border-b border-hairline pb-3 last:border-b-0 last:pb-0">
                        <p className="u-ui whitespace-pre-wrap text-ink-1">{typeof note === "string" ? note : ""}</p>
                        <Dateline className="mt-0.5">{author} · {format(entry.createdAt, "MMM d, yyyy h:mm a")}</Dateline>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Surface>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
