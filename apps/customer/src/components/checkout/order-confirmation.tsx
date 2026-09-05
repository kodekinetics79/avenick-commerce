"use client";

import { useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle } from "lucide-react";
import { Button, Dateline, Eyebrow, Skeleton, StatusPill, Surface } from "@avenick/ui";
import { cn, formatCurrency } from "@avenick/utils";
import { MoneyRow, Receipt, type Copy } from "@/app/cart/_money-path";
import {
  ORDER_FLOW,
  flowPosition,
  parsePersistedOrder,
  reconcilePersistedTotals,
  whatHappensNext,
  type NextStepKey,
  type OrderStatusValue,
  type PersistedOrder,
} from "@/lib/checkout-order-record";
import { vatJurisdictionFor } from "@/lib/checkout-preflight";

/** What POST /api/orders returns: the recorded total, discount, combined VAT and currency. */
export interface PostedOrderFigures {
  total: number | null;
  discountAmount: number | null;
  vatAmount: number | null;
  currency: string | null;
}

export interface OrderConfirmationProps {
  c: Copy;
  locale: "en" | "ar";
  orderId: string;
  orderNumber: string;
  posted: PostedOrderFigures;
  paymentMethod: string;
  /** The route replayed an order it had already recorded under this idempotency key. */
  idempotent: boolean;
  countryName: (code: string) => string;
  headingRef: RefObject<HTMLHeadingElement>;
}

/** Enum value → sentence-case fallback; the message tree carries the real label. */
const STAGE_FALLBACK: Record<OrderStatusValue, string> = {
  PENDING_PAYMENT: "Pending payment",
  PAYMENT_CONFIRMED: "Payment confirmed",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
};

const NEXT_FALLBACK: Record<NextStepKey, string> = {
  AWAIT_BANK_TRANSFER: "Awaiting your bank transfer. Finance verifies the funds, and only then does the order move to Payment confirmed — nothing is prepared or shipped before that.",
  AWAIT_PAYMENT: "Awaiting payment. The order moves to Payment confirmed once the payment is verified.",
  PAYMENT_CONFIRMED: "Payment is confirmed. The seller confirms the order next.",
  CONFIRMED: "Confirmed with the seller. The seller prepares the items next.",
  PROCESSING: "The seller is preparing the items for dispatch.",
  SHIPPED: "Dispatched. It moves to Out for delivery on the carrier's final leg.",
  OUT_FOR_DELIVERY: "With the carrier for delivery.",
  DELIVERED: "Delivered. A return can be raised against this order from Returns and followed to refund.",
  CANCELLED: "This order was cancelled. Nothing further happens to it.",
  REFUNDED: "This order was refunded.",
  RETURN_REQUESTED: "A return has been requested against this order and is being reviewed.",
  RETURNED: "This order was returned.",
};

type RecordState = "loading" | "ready" | "unavailable";

/**
 * THE RECORD, not a celebration.
 *
 * What a buyer needs at this exact moment is the reference they will quote,
 * the figures as the server recorded them, and a plain statement of what the
 * platform does next. The POST response carries only the total, the discount
 * and the combined VAT, so the full six-line breakdown — subtotal, discount,
 * VAT on goods, delivery, VAT on delivery, total — is read back from the
 * persisted order (GET /api/orders/[id]) and printed verbatim. Until it
 * arrives the posted figures stand; if it never does, they stay, and the order
 * record is one link away. No figure on this screen is computed here.
 */
export function OrderConfirmation({
  c, locale, orderId, orderNumber, posted, paymentMethod, idempotent, countryName, headingRef,
}: OrderConfirmationProps) {
  const [record, setRecord] = useState<PersistedOrder | null>(null);
  const [recordState, setRecordState] = useState<RecordState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const json = (await res.json()) as { success?: boolean; data?: unknown };
        const parsed = res.ok && json?.success ? parsePersistedOrder(json.data) : null;
        if (controller.signal.aborted) return;
        setRecord(parsed);
        setRecordState(parsed ? "ready" : "unavailable");
      } catch {
        if (!controller.signal.aborted) setRecordState("unavailable");
      }
    })();
    return () => controller.abort();
  }, [orderId]);

  // The cart is cleared after submission, so the order's own currency — first
  // from the POST response, then from the record — is what every amount here
  // is labelled with. Never the cart's.
  const currency = record?.currency ?? posted.currency ?? null;
  const money = (value: number) => (currency ? formatCurrency(value, currency as never, locale) : value.toFixed(2));

  // The status the route leaves a new order in is a fact, not a guess: every
  // order is written PENDING_PAYMENT, and a pilot MOCK payment then marks it
  // CONFIRMED. The record, when it arrives, is authoritative.
  const status: OrderStatusValue = record?.status ?? (paymentMethod === "MOCK" ? "CONFIRMED" : "PENDING_PAYMENT");
  const position = flowPosition(status);
  const nextKey = whatHappensNext(status, record?.paymentMethod ?? paymentMethod);
  const stageLabel = (stage: OrderStatusValue) => c(`orders.stage.${stage}`, STAGE_FALLBACK[stage]);

  const destination = record?.shippingAddress?.country ?? null;
  const jurisdiction = destination ? vatJurisdictionFor(destination) : null;
  const totals = record ? reconcilePersistedTotals(record) : null;
  const splitKnown = totals != null && totals.goodsVatAmount != null && totals.shippingVatAmount != null && totals.reconciles;

  return (
    <div className="mx-auto max-w-2xl px-4 py-section">
      <Surface rung={2} className="u-pop overflow-hidden">
        <div data-rule-ground="" data-grain="" className="p-6 sm:p-8">
          <div className="relative z-10">
            <div className="u-drawn w-14" data-on="true" aria-hidden="true" />

            <div className="mt-4 flex items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-success-soft text-success-ink ring-1 ring-success-rule">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
              </span>
              <Eyebrow>{c("checkout.success.eyebrow", "Order recorded")}</Eyebrow>
            </div>

            <h1
              ref={headingRef}
              tabIndex={-1}
              className="u-provenance u-focus mt-3 max-w-desc rounded-nested text-h2 text-ink-1 outline-none"
            >
              {c("checkout.success.headline", "Your order has been submitted.")}
            </h1>

            {idempotent && (
              <p role="status" className="u-meta mt-2 text-ink-2">
                {c("checkout.success.idempotent", "This order had already been recorded; nothing was submitted twice.")}
              </p>
            )}

            {/* An order reference is an identifier, so it is set in mono — the
                one thing mono is for here. Money never is. */}
            <div className="mt-6">
              <p className="u-micro text-ink-3">{c("checkout.success.reference", "Order reference")}</p>
              <p className="u-mono mt-1 break-all text-h2 text-ink-1" dir="ltr">{orderNumber}</p>
            </div>

            <div className="mt-6">
              {record && totals ? (
                <Receipt
                  as="section"
                  eyebrow={c("checkout.success.recordedEyebrow", "As recorded on the order")}
                  lede={
                    record.shippingAddress?.line1 ? (
                      <p className="u-meta mt-1 text-ink-3">
                        {c("checkout.success.deliveringTo", "Delivering to")}{" "}
                        <span className="text-ink-2">
                          {[record.shippingAddress.line1, record.shippingAddress.city, destination ? countryName(destination) : null].filter(Boolean).join(", ")}
                        </span>
                      </p>
                    ) : undefined
                  }
                  totalLabel={c("checkout.success.totalRecorded", "Total recorded")}
                  totalValue={money(totals.total)}
                  note={
                    jurisdiction
                      ? c(
                          "checkout.success.recordedProvenance",
                          `As recorded on the order in ${record.currency} · VAT at ${jurisdiction.ratePercent}%, ${countryName(jurisdiction.country)} being the place of supply · nothing here is recalculated in the browser`,
                          { currency: record.currency, rate: String(jurisdiction.ratePercent), country: countryName(jurisdiction.country) },
                        )
                      : c(
                          "checkout.success.recordedProvenanceNoRate",
                          `As recorded on the order in ${record.currency} · nothing here is recalculated in the browser`,
                          { currency: record.currency },
                        )
                  }
                >
                  <MoneyRow label={c("checkout.summary.subtotal", "Subtotal (excl. VAT)")} value={money(totals.subtotal)} />
                  {totals.discountAmount > 0 && (
                    <MoneyRow label={c("checkout.discount", "Discount")} value={`-${money(totals.discountAmount)}`} tone="credit" />
                  )}
                  {splitKnown ? (
                    <>
                      <MoneyRow
                        label={c("checkout.success.goodsVat", "VAT on goods")}
                        note={c("checkout.success.goodsVatNote", "The VAT recorded on each line, added up")}
                        value={money(totals.goodsVatAmount!)}
                      />
                      <MoneyRow
                        label={c("checkout.summary.delivery", "Delivery")}
                        note={
                          totals.shippingAmount > 0
                            ? c("checkout.success.deliveryNote", "As quoted by the server for this destination and weight")
                            : c("checkout.success.deliveryNone", "No delivery charge was recorded")
                        }
                        value={money(totals.shippingAmount)}
                      />
                      <MoneyRow
                        label={c("checkout.summary.deliveryVat", "VAT on delivery")}
                        note={c("checkout.success.deliveryVatNote", "The remainder of the order’s VAT after the line rows")}
                        value={money(totals.shippingVatAmount!)}
                      />
                    </>
                  ) : (
                    <>
                      <MoneyRow label={c("checkout.summary.delivery", "Delivery")} value={money(totals.shippingAmount)} />
                      <MoneyRow
                        label={c("checkout.success.vatCombined", "VAT (goods and delivery)")}
                        note={c("checkout.success.vatCombinedNote", "Declared as one figure on this order")}
                        value={money(totals.vatAmount)}
                      />
                    </>
                  )}
                </Receipt>
              ) : (
                <Receipt
                  as="section"
                  eyebrow={c("checkout.success.recordedEyebrow", "As recorded on the order")}
                  totalLabel={c("checkout.success.totalRecorded", "Total recorded")}
                  totalValue={posted.total == null ? "—" : money(posted.total)}
                  note={
                    recordState === "loading"
                      ? c("checkout.success.recordLoading", "Recorded by the server · the full breakdown is loading")
                      : c("checkout.success.recordUnavailable", "Recorded by the server · the full breakdown is on the order record")
                  }
                >
                  {posted.discountAmount != null && posted.discountAmount > 0 && (
                    <MoneyRow label={c("checkout.discount", "Discount")} value={`-${money(posted.discountAmount)}`} tone="credit" />
                  )}
                  {posted.vatAmount != null && (
                    <MoneyRow label={c("checkout.success.vatCombined", "VAT (goods and delivery)")} value={money(posted.vatAmount)} />
                  )}
                  {recordState === "loading" && (
                    <div className="py-2" aria-hidden="true">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-2 h-4 w-32" />
                    </div>
                  )}
                </Receipt>
              )}
            </div>

            {/* WHAT HAPPENS NEXT — the OrderStatus enum's forward path, with the
                order's position on it, and the platform's next step in one
                sentence. No dates: the platform computes none, so it promises
                none. */}
            <section className="mt-7" aria-labelledby="checkout-next-heading">
              <h2 id="checkout-next-heading" className="u-h3 text-ink-1">
                {c("checkout.success.nextTitle", "What happens next")}
              </h2>
              {recordState === "loading" ? (
                <div className="mt-3 space-y-2" aria-hidden="true">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-72" />
                </div>
              ) : position >= 0 ? (
                <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
                  {ORDER_FLOW.map((stage, index) => {
                    const done = index < position;
                    const current = index === position;
                    return (
                      <li key={stage} aria-current={current ? "step" : undefined} className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid h-5 w-5 shrink-0 place-items-center rounded-pill text-[11px] font-medium",
                            done
                              ? "bg-success-soft text-success-ink ring-1 ring-success-rule"
                              : current
                                ? "bg-primary text-primary-foreground shadow-seam"
                                : "bg-surface-1 text-ink-3 shadow-elev-1",
                          )}
                        >
                          {done ? <Check className="h-3 w-3" /> : index + 1}
                        </span>
                        <span className={cn("u-meta", current ? "font-medium text-ink-1" : done ? "text-ink-2" : "text-ink-3")}>
                          {stageLabel(stage)}
                        </span>
                        <span className="sr-only">
                          {done
                            ? c("checkout.step.completed", "completed")
                            : current
                              ? c("checkout.step.current", "current step")
                              : c("checkout.step.notStarted", "not started")}
                        </span>
                        {index < ORDER_FLOW.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-ink-3 rtl:rotate-180" aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-3">
                  <StatusPill tone="neutral">{stageLabel(status)}</StatusPill>
                </div>
              )}
              {recordState !== "loading" && (
                <p className="u-body mt-3 max-w-desc text-ink-2">{c(`orders.next.${nextKey}`, NEXT_FALLBACK[nextKey])}</p>
              )}
              <p className="u-meta mt-2 max-w-desc text-ink-3">
                {paymentMethod === "BANK_TRANSFER"
                  ? c(
                      "checkout.success.bankPending",
                      "Payment is pending finance confirmation. The order is not marked paid until funds are verified.",
                    )
                  : paymentMethod === "MOCK"
                    ? c("checkout.success.pilotRecorded", "Pilot test payment recorded — no card was charged.")
                    : ""}
              </p>
              {recordState === "unavailable" && (
                <Dateline className="mt-2">
                  {c("checkout.success.statusAtSubmission", "Status as at submission · the order record carries the current one")}
                </Dateline>
              )}
            </section>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="primary" size="lg">
                <Link href={`/orders/${encodeURIComponent(orderId)}`}>
                  {c("checkout.success.viewOrder", "View this order")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/account/orders">{c("checkout.success.viewOrders", "My orders")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/products">{c("checkout.browse", "Browse products")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
