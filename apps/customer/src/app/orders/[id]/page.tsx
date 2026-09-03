import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Package, Truck, Home, AlertCircle, ArrowLeft,
  MapPin, RotateCcw, Clock,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Button, CellGrid, Dateline, EmptyState, Eyebrow, LedgerTable, StatusPill, Surface,
  type PillTone,
} from "@avenick/ui";
import { auth } from "@/lib/auth-instance";
import { db } from "@avenick/database";
import { cn, formatCurrency, isRecordId } from "@avenick/utils";
import { copyFrom, MoneyRow, Receipt } from "../../cart/_money-path";

const MACRO_STEPS = [
  // "Confirmed" is an order state, not a payment state: bank-transfer and
  // on-terms orders are confirmed before any money moves. Payment is reported
  // separately from paymentStatus.
  //
  // The labels and descriptions are message keys. An order record read in
  // Arabic that says "Shipped · Order is on its way to you" in English is the
  // one place on the money path where the buyer is not shopping — they are
  // checking on something they have already paid for — and it is the last place
  // the product should switch languages on them.
  { key: "CONFIRMED", labelKey: "orders.step.confirmed", label: "Order confirmed", icon: CheckCircle, rank: 1, descKey: "orders.step.confirmedDesc", desc: "Order confirmed with the supplier." },
  { key: "PROCESSING", labelKey: "orders.step.processing", label: "Processing", icon: Package, rank: 2, descKey: "orders.step.processingDesc", desc: "Supplier is preparing your items." },
  { key: "SHIPPED", labelKey: "orders.step.shipped", label: "Shipped", icon: Truck, rank: 3, descKey: "orders.step.shippedDesc", desc: "Order is on its way to you." },
  { key: "DELIVERED", labelKey: "orders.step.delivered", label: "Delivered", icon: Home, rank: 4, descKey: "orders.step.deliveredDesc", desc: "Order delivered successfully." },
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

/**
 * Timestamps, in the reader's language and in WESTERN DIGITS in both.
 *
 * The old formatter was hard-coded to "en-US", so an Arabic order record dated
 * its own history in English. `ar-AE` is the Gulf Arabic locale and its default
 * numbering system is already latn, but `-u-nu-latn` is pinned explicitly for
 * the same reason the design system pins it on money: a page that prints
 * Arabic-Indic digits in a timeline and Western digits in a total is printing
 * two numeral systems in one document, and IBM Plex Mono — which sets the order
 * reference two lines away — has no Arabic-Indic coverage at all.
 */
const dateLocale = (locale: string) => (locale === "ar" ? "ar-AE-u-nu-latn" : "en-US");
const fmt = (d: Date, locale: string) =>
  d.toLocaleString(dateLocale(locale), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

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
 *
 * It returns a key and its English source rather than a finished sentence, for
 * the same reason the cart's line notice does: these are the words that tell a
 * buyer whether their money has moved, and they were the ones that could not be
 * read in Arabic.
 */
type Phrase = { key: string; fallback: string; values?: Record<string, string | number> };

function paymentLabel(order: {
  type: string;
  status: string;
  paymentStatus: string;
  purchaseOrderId: string | null;
  company: { paymentTerms: number } | null;
}): Phrase {
  switch (order.paymentStatus) {
    case "PAID": return { key: "orders.payment.paid", fallback: "Paid" };
    case "PARTIALLY_PAID": return { key: "orders.payment.partial", fallback: "Partially paid" };
    case "REFUNDED": return { key: "orders.payment.refunded", fallback: "Refunded" };
    case "FAILED": return { key: "orders.payment.failed", fallback: "Payment failed" };
    case "UNPAID": {
      // A cancelled order is not waiting for money; nothing was charged.
      if (order.status === "CANCELLED") return { key: "orders.payment.notCharged", fallback: "Not charged" };
      const onApprovedTerms = order.type === "B2B" && order.purchaseOrderId !== null && (order.company?.paymentTerms ?? 0) > 0;
      const days = order.company?.paymentTerms ?? 0;
      return onApprovedTerms
        ? { key: "orders.payment.onTerms", fallback: `On terms · net ${days} days`, values: { days } }
        : { key: "orders.payment.awaiting", fallback: "Awaiting payment" };
    }
    // The enum value itself, de-underscored. There is no key for a status this
    // page has never seen; printing the stored value is the honest fallback.
    default: return { key: `orders.payment.${order.paymentStatus}`, fallback: order.paymentStatus.replace(/_/g, " ") };
  }
}

/** Delivery cell: derived from the order's status rank, with the closed states named rather than shown as "Preparing". */
function deliveryLabel(status: string, rank: number, isDelivered: boolean): Phrase {
  if (isDelivered) return { key: "orders.delivery.delivered", fallback: "Delivered" };
  if (status === "RETURNED" || status === "RETURN_REQUESTED") return { key: "orders.delivery.returned", fallback: "Returned" };
  if (status === "REFUNDED") return { key: "orders.delivery.refunded", fallback: "Refunded" };
  if (rank < 0) return { key: "orders.delivery.cancelled", fallback: "Cancelled" };
  if (rank >= 3) return { key: "orders.delivery.inTransit", fallback: "In transit" };
  if (rank >= 1) return { key: "orders.delivery.preparing", fallback: "Preparing" };
  return { key: "orders.delivery.notStarted", fallback: "Not started" };
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

  // getTranslations / getLocale, not the client hooks: this page is and stays a
  // Server Component. Nothing here ever gets a "use client" directive to reach
  // a string or an animation.
  const t = await getTranslations();
  const c = copyFrom(t);
  const rawLocale = await getLocale();
  const locale = rawLocale === "ar" ? "ar" : "en";

  const currentRank = RANK[order.status] ?? 0;
  const addr = (order.shippingAddress as { line1?: string; city?: string; country?: string } | null) ?? {};
  const subtotal = Number(order.subtotal);
  const vat = Number(order.vatAmount);
  // Both were fetched and neither was shown. An order carrying a discount
  // printed a subtotal and a VAT figure that did not add up to its own total —
  // a reconciliation a procurement manager will do in their head and fail. They
  // are rendered only when they are non-zero, so a plain order gains no rows.
  const discount = Number(order.discountAmount);
  const shipping = Number(order.shippingAmount);
  const statusTone = STATUS_TONE[order.status] ?? "neutral";
  const isDelivered = order.status === "DELIVERED";
  const currency = order.currency as never;
  const money = (value: number) => formatCurrency(value, currency, locale);
  const payment = paymentLabel(order);
  const delivery = deliveryLabel(order.status, currentRank, isDelivered);

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <Link
          href="/account/orders"
          className="u-focus u-meta mb-6 inline-flex items-center gap-1.5 rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:text-ink-1"
        >
          {/* A direction-implying icon has to flip, or the page reads backwards
              in Arabic. */}
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {c("orders.backToOrders", "Back to my orders")}
        </Link>

        <header className="mb-block border-b border-border-strong pb-5">
          <Eyebrow>{c("orders.eyebrow", "Order")}</Eyebrow>
          {/* Mono is for identifiers — an order reference is the canonical one,
              and it is the string a buyer quotes down a phone. Money is never
              mono. */}
          <h1 className="u-mono mt-1 break-all text-h2 text-ink-1">{order.orderNumber}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill tone={statusTone} dot>
              {c(`orders.status.${order.status}`, order.status.replace(/_/g, " "))}
            </StatusPill>
            <StatusPill tone={order.type === "B2B" ? "accent" : "neutral"}>{order.type}</StatusPill>
          </div>
          <Dateline className="mt-2">
            {(() => {
              // The fallback is a template literal, not an ICU string: when the
              // key is absent the accessor returns the fallback VERBATIM, so a
              // "{date}" placeholder in it would render as those five
              // characters in front of a buyer.
              const placed = order.createdAt.toLocaleDateString(dateLocale(locale), { month: "long", day: "numeric", year: "numeric" });
              return c("orders.placedOn", `Placed on ${placed}`, { date: placed });
            })()}
          </Dateline>
        </header>

        {/* The same shape as the cart and the checkout: the record on the inline
            start, the receipt held at the inline end. Three surfaces of one
            sequence, and a buyer who has walked the first two arrives here
            already knowing where the total lives. */}
        <div className="grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
          <div className="min-w-0 space-y-stack">
          {/* One hairline-divided panel rather than three tinted boxes: these are
              three readings of the same order, not three objects. */}
          <CellGrid cols={{ base: 1, sm: 3 }}>
            {[
              { label: c("orders.items", "Items"), value: String(order.items.length) },
              { label: c("orders.paymentLabel", "Payment"), value: c(payment.key, payment.fallback, payment.values) },
              { label: c("orders.deliveryLabel", "Delivery"), value: c(delivery.key, delivery.fallback) },
            ].map(({ label, value }) => (
              <div key={label}>
                <Eyebrow>{label}</Eyebrow>
                {/* No `capitalize`: it title-cased every word, so "On terms · net
                    30 days" came out as "On Terms · Net 30 Days". */}
                <p className="u-lead mt-1 text-ink-1">{value}</p>
              </div>
            ))}
          </CellGrid>

          {/* Macro status stepper */}
          <Surface rung={2} className="p-5">
            <h2 className="u-h3 text-ink-1">{c("orders.statusTitle", "Order status")}</h2>
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
                      {/* The connector between two REACHED steps is the brass
                          rule turned vertical — the same `.u-drawn` gesture as
                          the checkout progress rail, the receipt's top edge and
                          the active nav item. Brass is the system's
                          active-indicator hue and this is exactly that: the part
                          of the ladder the order has actually climbed. */}
                      {!isLast && (
                        <span className="my-0.5 flex w-0.5 flex-1 bg-hairline" aria-hidden="true">
                          <span className="u-drawn h-full" data-orientation="vertical" data-on={currentRank > step.rank ? "true" : "false"} />
                        </span>
                      )}
                    </div>
                    <div className={cn("flex-1", isLast ? "pb-0" : "pb-8")}>
                      <p className={cn("u-ui flex flex-wrap items-center gap-2 font-medium", reached ? "text-ink-1" : "text-ink-3")}>
                        {c(step.labelKey, step.label)}
                        {isCurrent && <StatusPill tone="primary">{c("orders.current", "Current")}</StatusPill>}
                      </p>
                      <p className="u-meta mt-0.5 text-ink-3">
                        {entry
                          ? fmt(entry.createdAt, locale)
                          : reached
                            ? c(step.descKey, step.desc)
                            : c("orders.upcoming", "Upcoming")}
                      </p>
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
                <h2 className="u-h3 text-ink-1">{c("orders.activity", "Order activity")}</h2>
              </div>
              <Dateline className="mt-1">
                {c("orders.activityProvenance", "Status changes as written to this order, newest first")}
              </Dateline>
              <ol className="mt-4 space-y-3">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <li key={h.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-pill", i === 0 ? "bg-primary" : "bg-border-strong")} aria-hidden="true" />
                      {i < order.statusHistory.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-hairline" aria-hidden="true" />}
                    </div>
                    <div className="pb-2">
                      {/* `h.message` is written by the service that changed the
                          status and is not translatable from here; the enum
                          value behind it is. */}
                      <p className={cn("u-ui", i === 0 ? "font-medium text-ink-1" : "text-ink-2")}>
                        {h.message ?? c(`orders.status.${h.status}`, h.status.replace(/_/g, " "))}
                      </p>
                      <p className="u-meta text-ink-3">{fmt(h.createdAt, locale)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Surface>
          )}

          {/*
            THE LINES, as a real ledger.

            Round one showed each line as a name, a grey "Qty 4 × AED 12.00" and
            a right-hand figure, with a generic package glyph beside it — the
            same glyph on every row, which is a wall of absence dressed as
            imagery. OrderItem carries no image, so the honest and more useful
            move is to spend that column on facts the row actually holds: the
            SKU, the quantity, the unit price, the VAT the order charged on that
            line, and the line total, in aligned tabular columns.

            <LedgerTable> is a real <table> with scope'd headers and a 2px
            underrule under a micro-caps head, so a screen-reader user can
            navigate it by column and a procurement manager can reconcile it
            against their own records. This is the density-of-true-fact move: no
            visual design at all, and it reads as expensive because every pixel
            is load-bearing.
          */}
          <LedgerTable
            title={c("orders.items", "Items")}
            dateline={c("orders.itemsProvenance", `Lines as recorded on the order, in ${order.currency}`, { currency: order.currency })}
            columns={[
              {
                key: "name",
                label: c("orders.col.item", "Item"),
                render: (item) => (
                  <div className="min-w-0 py-1">
                    <p className="u-ui truncate font-medium text-ink-1">
                      {locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}
                    </p>
                    <p className="u-mono u-meta text-ink-3">{item.sku}</p>
                  </div>
                ),
              },
              { key: "qty", label: c("orders.col.qty", "Qty"), numeric: true, width: "72px", render: (item) => String(item.quantity) },
              { key: "unit", label: c("orders.col.unitPrice", "Unit price"), numeric: true, hideOnMobile: true, render: (item) => money(Number(item.unitPrice)) },
              { key: "vat", label: c("orders.col.vat", "VAT"), numeric: true, hideOnMobile: true, render: (item) => money(Number(item.vatAmount)) },
              { key: "total", label: c("orders.col.lineTotal", "Line total"), numeric: true, render: (item) => <span className="font-medium">{money(Number(item.total))}</span> },
            ]}
            rows={order.items}
            getRowKey={(item) => item.id}
            // Required by the primitive, and it is not dead code: an order whose
            // lines failed to load must say so rather than render an empty box.
            empty={
              <EmptyState
                eyebrow={c("orders.noLines.eyebrow", "No lines")}
                headline={c("orders.noLines.headline", "This order has no recorded lines.")}
              />
            }
          />
          </div>

          {/* The receipt, the delivery address and the two actions — held at the
              inline end and sticky, exactly where the cart and the checkout put
              them. */}
          <aside className="space-y-stack lg:sticky lg:top-24 lg:self-start">
            <Receipt
              as="section"
              eyebrow={c("orders.summary", "Summary")}
              totalLabel={c("orders.orderTotal", "Order total")}
              totalValue={money(Number(order.total))}
              /* LAW E: what the figure is, in the order's own currency, with no
                 conversion — the same statement the finance surfaces make. */
              note={c("orders.totalProvenance", `Including VAT · as recorded on the order in ${order.currency}`, { currency: order.currency })}
            >
              <MoneyRow label={c("cart.subtotal", "Subtotal")} value={money(subtotal)} />
              {discount > 0 && (
                <MoneyRow label={c("checkout.discount", "Discount")} value={`-${money(discount)}`} tone="credit" />
              )}
              {shipping > 0 && (
                <MoneyRow label={c("orders.shipping", "Shipping")} value={money(shipping)} />
              )}
              <MoneyRow label={c("cart.vat", "VAT")} value={money(vat)} />
            </Receipt>

            <Surface rung={2} className="p-5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ink-3" aria-hidden="true" />
                <h2 className="u-h3 text-ink-1">{c("orders.deliveryAddress", "Delivery address")}</h2>
              </div>
              <p className="u-ui mt-3 text-ink-1">{addr.line1 ?? "—"}</p>
              <p className="u-ui text-ink-2">{[addr.city, addr.country].filter(Boolean).join(", ")}</p>
            </Surface>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {isDelivered && (
                <Button asChild variant="secondary">
                  <Link href="/returns">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> {c("orders.returnExchange", "Return / exchange")}
                  </Link>
                </Button>
              )}
              <Button asChild variant="secondary">
                <Link href="/support">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" /> {c("orders.reportIssue", "Report an issue")}
                </Link>
              </Button>
              {/* No "Invoice" button: nothing issues TaxInvoice rows yet, and the button it replaced did nothing when clicked. */}
            </div>
          </aside>
        </div>

        {/* The old trust line read "…are re-validated when an order is
            submitted" — present tense, on a page whose order was submitted
            some time ago. The fact it was standing in for is the one worth
            stating: every figure here was read back off the order, and none of
            it is recomputed in the browser. */}
        <Dateline className="mt-block text-center">
          {c(
            "orders.pageProvenance",
            "Every figure on this page is as recorded on the order · price, tax and availability were re-validated by the server when it was submitted, and nothing here is recalculated in the browser",
          )}
        </Dateline>
      </div>
    </MainLayout>
  );
}
