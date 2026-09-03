"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreditCard, Building2, Smartphone, CheckCircle, TicketPercent, Check } from "lucide-react";
import {
  Button, Dateline, EmptyState, Eyebrow, Field, FieldWell, Input, Num, StatusPill, Surface,
} from "@avenick/ui";
import { cn, formatCurrency } from "@avenick/utils";
import { useCartStore } from "@/stores/cart";
import { MainLayout } from "@/components/layout/main-layout";
import { summarizeCartCommercial } from "@/lib/cart-commercial";
import { emptyMarketAddress, SUPPORTED_COUNTRIES } from "@/lib/market-context";

type Step = "address" | "payment" | "review" | "success";
type OrderSummary = { total?: number; discountAmount?: number; vatAmount?: number; currency?: string };

const PILOT_MODE = process.env.NEXT_PUBLIC_PILOT_MODE === "true";

/**
 * The three steps a buyer walks, in order. Written out rather than derived from
 * the Step union so the labels are copy rather than a capitalised identifier,
 * and so "success" — which is an outcome, not a step — can never appear in the
 * progress rail.
 */
const STEPS: { id: Exclude<Step, "success">; label: string }[] = [
  { id: "address", label: "Address" },
  { id: "payment", label: "Payment" },
  { id: "review", label: "Review" },
];

/**
 * A recessed native control, matching <Input>'s rung-1 treatment.
 *
 * packages/ui exports a <Select>, and it is the right control almost
 * everywhere — but it is a Radix listbox, and this one field is a country
 * picker inside a delivery-address form. A native <select> hands a phone its
 * own full-screen wheel, keeps the form's `required` semantics, and works with
 * no JavaScript, which matters more here than a styled popover. The classes
 * below are deliberately the same recessed rung-1 treatment the primitive's
 * trigger uses, so the two read as one control family.
 */
const SELECT_CONTROL =
  "u-focus w-full rounded-lg border border-input bg-surface-1 px-3 text-ui text-ink-1 " +
  "transition-[border-color,box-shadow] duration-press ease-standard disabled:opacity-50";

const PAYMENT_METHODS = [
  { id: "MOCK", label: "Test payment (pilot)", labelAr: "دفع تجريبي (تجريبي)", icon: CheckCircle, desc: "Pilot simulation — no card is charged", enabled: PILOT_MODE },
  { id: "BANK_TRANSFER", label: "Bank Transfer", labelAr: "تحويل بنكي", icon: Building2, desc: "Creates an unpaid order for finance confirmation", enabled: true },
  { id: "CREDIT_CARD", label: "Credit / Debit Card", labelAr: "بطاقة ائتمانية / مدينة", icon: CreditCard, desc: "Requires certified payment initiation", enabled: false },
  { id: "MADA", label: "mada", labelAr: "مدى", icon: CreditCard, desc: "Requires certified payment initiation", enabled: false },
  { id: "APPLE_PAY", label: "Apple Pay", labelAr: "آبل باي", icon: Smartphone, desc: "Requires certified payment initiation", enabled: false },
];

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const [step, setStep] = useState<Step>("address");
  const [paymentMethod, setPaymentMethod] = useState(PILOT_MODE ? "MOCK" : "BANK_TRANSFER");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  // A failed submission used to arrive as a window.alert(): it interrupts the
  // page, it is unreadable to a screen reader in the flow of the form, and it
  // leaves nothing on screen once dismissed. The message now lands next to the
  // button that produced it, in a live region.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [finalSummary, setFinalSummary] = useState<OrderSummary>({});
  const [address, setAddress] = useState(() => emptyMarketAddress("Home"));
  const idempotencyKeyRef = useRef<string | null>(null);

  // Moving between steps swaps the whole panel, which unmounts the button the
  // buyer just pressed. Focus then falls to <body>: a keyboard user is dropped
  // at the top of the document and a screen reader announces nothing at all, so
  // the "calm finite sequence" the rail promises is exactly the thing that is
  // not conveyed. Focus moves to the new step's heading instead, which names
  // where the buyer now is and brings the panel into view on a small screen.
  // Skipped on first paint so the page never steals focus on arrival.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasChangedStep = useRef(false);
  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  const summary = summarizeCartCommercial(items);
  // No fallback currency: an invalid cart never reaches the order call, and
  // the success screen uses the currency the server recorded on the order.
  const checkoutCurrency = summary.valid ? summary.currency : null;
  const mixedCurrencies = !summary.valid;
  const subtotal = summary.valid ? summary.subtotal : 0;
  const vatAmount = summary.valid ? summary.vatAmount : 0;
  const orderTotal = summary.valid ? summary.total : 0;

  async function placeOrder() {
    setLoading(true);
    setSubmitError(null);
    try {
      if (mixedCurrencies || !checkoutCurrency) throw new Error("Cart items must use one currency per checkout");
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = globalThis.crypto?.randomUUID?.() ?? `checkout-${Date.now()}-${Math.random()}`;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          // Cart price and seller are display hints only. The server re-resolves
          // both from the authoritative catalog at checkout.
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.qty })),
          shippingAddress: address,
          paymentMethod,
          currency: checkoutCurrency,
          type: "B2C",
          couponCode: couponCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setOrderNumber(data.data.orderNumber);
        setFinalSummary({
          total: data.data.total == null ? undefined : Number(data.data.total),
          discountAmount: data.data.discountAmount == null ? undefined : Number(data.data.discountAmount),
          vatAmount: data.data.vatAmount == null ? undefined : Number(data.data.vatAmount),
          currency: typeof data.data.currency === "string" ? data.data.currency : checkoutCurrency,
        });
        clearCart();
        setStep("success");
      } else {
        setSubmitError(data.error ?? "Order failed");
      }
    } catch {
      setSubmitError("Order failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0 && step !== "success") {
    return (
      <MainLayout>
        <div className="mx-auto max-w-2xl px-4 py-section">
          <Surface rung={2}>
            <EmptyState
              eyebrow="Nothing to check out"
              headline="There is nothing in your cart to check out."
              body="Add items from the marketplace and they will be waiting here."
              action={<Button asChild variant="primary"><Link href="/products">Browse products</Link></Button>}
            />
          </Surface>
        </div>
      </MainLayout>
    );
  }

  if (!summary.valid && step !== "success") {
    return (
      <MainLayout>
        <div className="mx-auto max-w-2xl px-4 py-section">
          <Surface rung={2}>
            <EmptyState
              eyebrow="Checkout unavailable"
              headline="This cart cannot be priced."
              // The precise refusal, kept word for word: it is the difference
              // between "something went wrong" and a buyer knowing what to fix.
              body="Cart items must have one currency and complete VAT facts. No estimate or order has been submitted."
              action={<Button asChild variant="primary"><Link href="/cart">Review cart</Link></Button>}
            />
          </Surface>
        </div>
      </MainLayout>
    );
  }

  if (step === "success") {
    // The cart is cleared after submission, so the order's own currency (not
    // the cart summary) is what the final amounts are labelled with.
    const finalCurrency = finalSummary.currency ?? null;
    const finalMoney = (n: number) => (finalCurrency ? formatCurrency(n, finalCurrency as never) : n.toFixed(2));
    return (
      <MainLayout>
        <div className="mx-auto max-w-xl px-4 py-section">
          <Surface rung={2} className="p-8 text-center">
            {/* Success is stated in the success colour rather than in the brand
                colour, and the mark is a chip rather than a 64px icon: the thing
                that reassures a buyer here is the order number and the total,
                not a large tick. */}
            <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-pill bg-success-soft text-success-ink ring-1 ring-success-rule">
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            </span>

            <Eyebrow>Order recorded</Eyebrow>
            <h1 ref={stepHeadingRef} tabIndex={-1} className="u-focus mt-1 rounded-nested text-h2 text-ink-1 outline-none">
              Your order has been submitted.
            </h1>
            <p lang="ar" dir="rtl" className="mt-1 text-meta text-ink-3">تم إرسال الطلب بنجاح</p>

            {/* An order reference is an identifier, so it is set in mono — the one
                thing mono is for here. Money never is. */}
            <p className="mt-4 text-ui text-ink-2">
              Order <span className="u-mono text-ink-1">{orderNumber}</span>
            </p>

            {finalSummary.total != null && (
              <FieldWell className="mx-auto mt-6 max-w-sm space-y-2 p-4 text-start">
                {finalSummary.discountAmount != null && finalSummary.discountAmount > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-ui text-ink-2">Discount</span>
                    <span className="tnum text-ui text-ink-1">-{finalMoney(finalSummary.discountAmount)}</span>
                  </div>
                )}
                {finalSummary.vatAmount != null && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-ui text-ink-2">VAT</span>
                    <span className="tnum text-ui text-ink-1">{finalMoney(finalSummary.vatAmount)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t-2 border-border-strong pt-3">
                  <span className="text-ui font-medium text-ink-1">Final total</span>
                  <Num rank="section" value={finalMoney(finalSummary.total)} />
                </div>
              </FieldWell>
            )}

            {/* These are the server's own figures, in the currency the server
                recorded on the order — not the cart's estimate, which no longer
                exists by this point. Saying which is which is the whole point of
                the provenance line. */}
            <Dateline className="mt-3">
              Final amounts as recorded on the order by the server · each in the order&apos;s own currency, with no conversion applied
            </Dateline>

            <p className="mx-auto mt-5 max-w-desc text-ui text-ink-2">
              {paymentMethod === "BANK_TRANSFER"
                ? "Payment is pending finance confirmation. The order is not marked paid until funds are verified."
                : "Pilot test payment recorded — no card was charged."}
            </p>

            {/* next/link, not a bare <a>: this is an internal route, and a full
                document reload immediately after the cart was cleared throws
                away the client state the buyer just created. */}
            <Button asChild variant="primary" className="mt-6"><Link href="/account/orders">View my orders</Link></Button>
          </Surface>
        </div>
      </MainLayout>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl px-4 py-block">
        <header className="mb-stack border-b border-border-strong pb-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-h1 text-ink-1">Checkout</h1>
            {/* Tagged rather than left as loose glyphs inside an English heading,
                so it is announced in Arabic and shaped right-to-left. */}
            <p lang="ar" dir="rtl" className="text-lead text-ink-3">إتمام الشراء</p>
          </div>
        </header>

        {/*
          A real ordered list, with the current step carrying aria-current. The
          rail is the whole promise of this page — that checkout is a short,
          finite sequence — so it says where you are to a screen reader as
          plainly as it does to the eye.
        */}
        <ol className="mb-block flex flex-wrap items-center gap-x-2 gap-y-3">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} aria-current={active ? "step" : undefined} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-pill text-meta font-medium",
                    "transition-colors duration-panel ease-standard",
                    done
                      ? "bg-success-soft text-success-ink ring-1 ring-success-rule"
                      : active
                        // Filled, seamed, but NOT raised. Rung 3 means "you can
                        // press this"; the marker is a readout of where you are,
                        // and the one raised object on this page has to stay the
                        // button that moves the buyer forward.
                        ? "bg-primary text-primary-foreground shadow-seam"
                        : "bg-surface-1 text-ink-3 shadow-elev-1",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("text-ui", active ? "font-medium text-ink-1" : done ? "text-ink-2" : "text-ink-3")}>
                  {s.label}
                </span>
                <span className="sr-only">{done ? "completed" : active ? "current step" : "not started"}</span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={cn("mx-1 h-px w-8 transition-colors duration-panel ease-standard", done ? "bg-border-strong" : "bg-border")}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 gap-block lg:grid-cols-3">
          <div className="lg:col-span-2">
            {step === "address" && (
              <Surface rung={2} className="p-6">
                <h2 ref={stepHeadingRef} tabIndex={-1} className="u-focus rounded-nested text-h3 text-ink-1 outline-none">Delivery address</h2>
                <p className="mt-1 text-meta text-ink-3">Where the supplier ships this order.</p>

                {/* Every control now carries a real, associated label. The form
                    previously relied on placeholders alone, which vanish the
                    moment a buyer starts typing and are never announced as the
                    field's name. */}
                <div className="mt-5 space-y-1">
                  <Field label="Address label" htmlFor="ck-label" hint="For example Home or Office.">
                    <Input id="ck-label" value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} placeholder="Home" />
                  </Field>
                  <Field label="Street address" htmlFor="ck-line1" required>
                    <Input id="ck-line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="Building, street" />
                  </Field>
                  <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                    <Field label="City" htmlFor="ck-city" required>
                      <Input id="ck-city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    </Field>
                    <Field label="Country" htmlFor="ck-country" required>
                      <select
                        id="ck-country"
                        required
                        value={address.country}
                        onChange={(e) => setAddress({ ...address, country: e.target.value })}
                        data-rung={1}
                        className={SELECT_CONTROL}
                        style={{ height: "var(--control-h-md)" }}
                      >
                        <option value="" disabled>Select country</option>
                        {SUPPORTED_COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>

                <Button className="mt-4 w-full" onClick={() => setStep("payment")} disabled={!address.line1.trim() || !address.city.trim() || !address.country}>
                  Continue to payment
                </Button>
              </Surface>
            )}

            {step === "payment" && (
              <Surface rung={2} className="p-6">
                <h2 ref={stepHeadingRef} tabIndex={-1} className="u-focus rounded-nested text-h3 text-ink-1 outline-none">Payment method</h2>

                {PILOT_MODE && (
                  // Recessed and toned: this is context about the environment, not
                  // something to act on.
                  <Surface rung={1} tone="accent" className="mt-4 p-3">
                    <p className="text-meta text-ink-2">
                      Pilot mode is explicitly enabled. Test payment records are simulation-only and never represent a card charge.
                    </p>
                  </Surface>
                )}

                {/*
                  Native radios in a fieldset, replacing a row of <button>s that
                  carried no selected state for assistive technology and no arrow-key
                  navigation. The visual selection and the announced selection are
                  now the same fact.
                */}
                <fieldset className="mt-5">
                  <legend className="sr-only">Payment method</legend>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const selected = paymentMethod === pm.id;
                      return (
                        <label
                          key={pm.id}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3",
                            "transition-colors duration-press ease-standard",
                            // The card is the control's whole hit area, so the
                            // card is what has to show focus. The radio's own
                            // 16px UA ring inside a full-width row is not a
                            // findable indicator. `has-[:focus-visible]` keeps
                            // it to keyboard travel — clicking a card with a
                            // mouse must not light it up.
                            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                            "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-2",
                            pm.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                            selected
                              ? "border-primary bg-primary-soft"
                              : pm.enabled
                                ? "border-border hover:border-border-strong"
                                : "border-border",
                          )}
                        >
                          <input
                            type="radio"
                            name="payment-method"
                            value={pm.id}
                            checked={selected}
                            disabled={!pm.enabled}
                            onChange={() => setPaymentMethod(pm.id)}
                            className="mt-1 h-4 w-4 shrink-0 accent-primary"
                          />
                          <pm.icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-primary-ink" : "text-ink-3")} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-ui font-medium text-ink-1">
                              {pm.label} — <span lang="ar" dir="rtl">{pm.labelAr}</span>
                            </span>
                            <span className="block text-meta text-ink-3">{pm.desc}</span>
                          </span>
                          {!pm.enabled && <StatusPill tone="neutral" className="mt-0.5 shrink-0">Not enabled</StatusPill>}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-5 flex gap-3">
                  <Button variant="outline" onClick={() => setStep("address")}>Back</Button>
                  <Button className="flex-1" onClick={() => setStep("review")}>Review order</Button>
                </div>
              </Surface>
            )}

            {step === "review" && (
              <Surface rung={2} className="overflow-hidden">
                <div className="p-6 pb-4">
                  <h2 ref={stepHeadingRef} tabIndex={-1} className="u-focus rounded-nested text-h3 text-ink-1 outline-none">Review your order</h2>
                  <Dateline className="mt-1">
                    Lines as held in this browser · the server re-resolves each product, its price and its VAT before the order is written
                  </Dateline>
                </div>

                <ul className="divide-y divide-hairline border-y border-hairline">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 px-6 py-3">
                      <div className="min-w-0">
                        <p className="text-ui font-medium text-ink-1">{item.nameEn}</p>
                        <p lang="ar" dir="rtl" className="text-meta text-ink-2">{item.nameAr}</p>
                        <p className="text-meta text-ink-3">
                          <span className="tnum">{item.qty}</span> × <span className="tnum">{formatCurrency(item.unitPrice, item.currency as never)}</span>
                          {" · VAT "}{item.vatRate ?? "missing"}%
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-ui text-ink-1">{formatCurrency(item.unitPrice * item.qty, item.currency as never)}</span>
                    </li>
                  ))}
                </ul>

                <div className="p-6 pt-5">
                  <Field
                    label="Coupon / event code"
                    htmlFor="coupon-code"
                    hint="Validated against current eligibility, usage limits and stacking rules when you submit. The browser does not calculate or authorize the discount."
                  >
                    <Input
                      id="coupon-code"
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                      maxLength={40}
                      placeholder="Optional code"
                      startIcon={<TicketPercent className="h-4 w-4" aria-hidden="true" />}
                      className="u-mono"
                    />
                  </Field>

                  {mixedCurrencies && (
                    <p role="alert" className="mt-3 text-meta text-danger-ink">Remove items in other currencies before checkout.</p>
                  )}

                  {submitError && (
                    <Surface rung={1} tone="danger" role="alert" className="mt-4 p-3">
                      <p className="text-ui text-danger-ink">{submitError}</p>
                    </Surface>
                  )}

                  <div className="mt-5 flex gap-3">
                    <Button variant="outline" onClick={() => setStep("payment")}>Back</Button>
                    <Button className="flex-1" loading={loading} disabled={mixedCurrencies} onClick={placeOrder}>Submit order</Button>
                  </div>
                </div>
              </Surface>
            )}
          </div>

          {/* The running total follows the buyer down all three steps, so the
              number never has to be remembered between panels. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Surface rung={2} className="p-5">
              <Eyebrow as="h2">Order summary</Eyebrow>
              <p className="mt-1 text-meta text-ink-3">{items.length} line{items.length !== 1 ? "s" : ""}</p>

              <FieldWell className="mt-3 space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ui text-ink-2">Displayed subtotal</span>
                  <span className="tnum text-ui text-ink-1">{formatCurrency(subtotal, checkoutCurrency as never)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-ui text-ink-2">Estimated VAT</span>
                  <span className="tnum text-ui text-ink-1">{formatCurrency(vatAmount, checkoutCurrency as never)}</span>
                </div>
              </FieldWell>

              {/* "Estimate", not "Total": nothing on this page is the price until
                  the server has priced it, and the word is the honest one. */}
              <div className="mt-4 flex items-baseline justify-between gap-4 border-t-2 border-border-strong pt-4">
                <span className="text-ui font-medium text-ink-1">Estimate</span>
                <Num rank="section" value={formatCurrency(orderTotal, checkoutCurrency as never)} />
              </div>

              <Dateline className="mt-2">
                Estimated from the cart lines · final price, discounts, availability and tax are re-validated and priced by the server on submission, and an eligible coupon may reduce this total
              </Dateline>

              {couponCode && (
                <p className="mt-3 text-meta text-ink-3">
                  Code <span className="u-mono text-ink-2">{couponCode}</span> is validated when you submit.
                </p>
              )}
            </Surface>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
