"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CreditCard, Building2, Smartphone, CheckCircle, TicketPercent, Check, ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button, Dateline, EmptyState, Eyebrow, Field, FieldWell, Input, Num, Skeleton, StatusPill,
  Surface,
} from "@avenick/ui";
import { cn, formatCurrency } from "@avenick/utils";
import { useCartStore } from "@/stores/cart";
import { MainLayout } from "@/components/layout/main-layout";
import { summarizeCartCommercial } from "@/lib/cart-commercial";
import { emptyMarketAddress, SUPPORTED_COUNTRIES } from "@/lib/market-context";
import { copyFrom, LineFrame, MoneyRow, Receipt } from "../cart/_money-path";

type Step = "address" | "payment" | "review" | "success";
type OrderSummary = { total?: number; discountAmount?: number; vatAmount?: number; currency?: string };

const PILOT_MODE = process.env.NEXT_PUBLIC_PILOT_MODE === "true";

/**
 * The three steps a buyer walks, in order. Written out rather than derived from
 * the Step union so the labels are copy rather than a capitalised identifier,
 * and so "success" — which is an outcome, not a step — can never appear in the
 * progress rail.
 *
 * The labels are message keys now. A checkout rail that names its steps in
 * English on an Arabic page is the single most visible place the old
 * "translated-looking" defect showed, because the rail is the page's promise
 * that this is a short finite sequence.
 */
const STEPS: { id: Exclude<Step, "success">; key: string; fallback: string }[] = [
  { id: "address", key: "checkout.step.address", fallback: "Address" },
  { id: "payment", key: "checkout.step.payment", fallback: "Payment" },
  { id: "review", key: "checkout.step.review", fallback: "Review" },
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

/**
 * The payment methods, and what each one actually does to the order.
 *
 * The English/Arabic pair that used to be printed on one line — "Bank Transfer
 * — تحويل بنكي" — is gone. It was there because the page had no message tree,
 * and printing both scripts on every row of a form is the clearest possible
 * statement that neither language is the page's own. Each label is a key now,
 * and two of them (`checkout.creditCard`, `checkout.bankTransfer`) already
 * exist in the tree.
 *
 * The `desc` lines are unchanged in substance and stay exact: "Creates an
 * unpaid order for finance confirmation" is what bank transfer does, and
 * "Requires certified payment initiation" is why the other three are off. A
 * disabled method with no stated reason reads as a broken product; with the
 * reason, it reads as a regulated one.
 */
const PAYMENT_METHODS = [
  { id: "MOCK", icon: CheckCircle, labelKey: "checkout.pay.mock", label: "Test payment (pilot)", descKey: "checkout.pay.mockDesc", desc: "Pilot simulation — no card is charged", enabled: PILOT_MODE },
  { id: "BANK_TRANSFER", icon: Building2, labelKey: "checkout.bankTransfer", label: "Bank transfer", descKey: "checkout.pay.bankDesc", desc: "Creates an unpaid order for finance confirmation", enabled: true },
  { id: "CREDIT_CARD", icon: CreditCard, labelKey: "checkout.creditCard", label: "Credit or debit card", descKey: "checkout.pay.certification", desc: "Requires certified payment initiation", enabled: false },
  { id: "MADA", icon: CreditCard, labelKey: "checkout.pay.mada", label: "mada", descKey: "checkout.pay.certification", desc: "Requires certified payment initiation", enabled: false },
  { id: "APPLE_PAY", icon: Smartphone, labelKey: "checkout.pay.applePay", label: "Apple Pay", descKey: "checkout.pay.certification", desc: "Requires certified payment initiation", enabled: false },
];

export default function CheckoutPage() {
  const t = useTranslations();
  const c = copyFrom(t);
  const locale = useLocale() === "ar" ? "ar" : "en";
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
  // Empty rather than pre-filled with "Home": the label is a value the buyer
  // types, not a UI string, and seeding it with an English word put an English
  // word inside an Arabic form's input the moment the page loaded.
  const [address, setAddress] = useState(() => emptyMarketAddress(""));
  const idempotencyKeyRef = useRef<string | null>(null);
  // Same gate as the cart, and it matters more here: the cart is persisted in
  // localStorage, so the first render on both server and client sees an empty
  // one. Without it, a buyer arriving at checkout with a full cart is shown
  // "There is nothing in your cart to check out" — or worse, "This cart cannot
  // be priced" — for a frame before their lines arrive.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

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
        // The server's own refusal is shown verbatim when it sends one: it names
        // the line or the rule that stopped the order, which no generic sentence
        // written here could. The fallback is the only part this page owns.
        setSubmitError(data.error ?? c("checkout.orderFailed", "Order failed"));
      }
    } catch {
      setSubmitError(c("checkout.orderFailedRetry", "Order failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated && step !== "success") {
    return (
      <MainLayout>
        <div className="mx-auto max-w-6xl px-4 py-block" aria-hidden="true">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-9 w-52" />
          <div className="mt-block grid grid-cols-3 gap-2 sm:gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="h-0.5 w-full rounded-none" />
                <Skeleton className="mt-2.5 h-7 w-28" />
              </div>
            ))}
          </div>
          <div className="mt-block grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
            <Skeleton className="h-80 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (items.length === 0 && step !== "success") {
    return (
      <MainLayout>
        <div className="mx-auto max-w-4xl px-4 py-section">
          <EmptyState
            variant="certificate"
            eyebrow={c("checkout.empty.eyebrow", "Nothing to check out")}
            headline={c("checkout.empty.headline", "There is nothing in your cart to check out.")}
            body={c("checkout.empty.body", "Add items from the marketplace and they will be waiting here.")}
            action={
              <Button asChild variant="primary" size="lg">
                <Link href="/products">
                  {c("checkout.browse", "Browse products")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  if (!summary.valid && step !== "success") {
    return (
      <MainLayout>
        <div className="mx-auto max-w-4xl px-4 py-section">
          <EmptyState
            variant="certificate"
            eyebrow={c("checkout.unpriceable.eyebrow", "Checkout unavailable")}
            headline={c("checkout.unpriceable.headline", "This cart cannot be priced.")}
            // The precise refusal, kept word for word: it is the difference
            // between "something went wrong" and a buyer knowing what to fix.
            body={c(
              "checkout.unpriceable.body",
              "Cart items must have one currency and complete VAT facts. No estimate or order has been submitted.",
            )}
            action={
              <Button asChild variant="primary" size="lg">
                <Link href="/cart">{c("checkout.reviewCart", "Review cart")}</Link>
              </Button>
            }
          />
        </div>
      </MainLayout>
    );
  }

  if (step === "success") {
    // The cart is cleared after submission, so the order's own currency (not
    // the cart summary) is what the final amounts are labelled with.
    const finalCurrency = finalSummary.currency ?? null;
    const finalMoney = (n: number) => (finalCurrency ? formatCurrency(n, finalCurrency as never, locale) : n.toFixed(2));
    return (
      <MainLayout>
        <div className="mx-auto max-w-2xl px-4 py-section">
          {/*
            THE RECORD, not a celebration.

            Round one centred a green tick over a centred h2 over a centred
            summary — the shape every consumer app uses for "yay!". This is a
            trade platform: what a buyer needs at this exact moment is the
            reference they will quote, the amount that will be charged, and a
            plain statement of what happens to the money next. So the screen is
            a DOCUMENT — left-aligned, ruled, grained, with the brass rule drawn
            across its top edge, the same plate the empty states and the receipt
            are built from. It reads as something issued rather than something
            congratulating you.

            .u-pop is the system's 180ms @starting-style entry: it arrives from
            the inline start at 0.965 and settles. Nothing is gated on it — with
            no JavaScript and under reduced motion the plate is simply there.
          */}
          <Surface rung={2} className="u-pop overflow-hidden">
            <div data-rule-ground="" data-grain="" className="p-6 sm:p-8">
              <div className="relative z-10">
                <div className="u-drawn w-14" data-on="true" aria-hidden="true" />

                {/* Success is stated in the success colour rather than in the
                    brand colour, and the mark is a chip rather than a 64px
                    icon: the thing that reassures a buyer here is the reference
                    and the total, not a large tick. */}
                <div className="mt-4 flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-success-soft text-success-ink ring-1 ring-success-rule">
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <Eyebrow>{c("checkout.success.eyebrow", "Order recorded")}</Eyebrow>
                </div>

                {/* The provenance voice — Source Serif italic in English,
                    upright Noto Naskh in Arabic. This sentence is a statement of
                    fact about the data, which is exactly what that register is
                    reserved for. */}
                <h1
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="u-provenance u-focus mt-3 max-w-desc rounded-nested text-h2 text-ink-1 outline-none"
                >
                  {c("checkout.success.headline", "Your order has been submitted.")}
                </h1>

                {/* An order reference is an identifier, so it is set in mono —
                    the one thing mono is for here. Money never is. Its own rank
                    and its own family, because it is the string a buyer copies
                    into an email or reads down a phone. */}
                <div className="mt-6">
                  <p className="u-micro text-ink-3">{c("checkout.success.reference", "Order reference")}</p>
                  <p className="u-mono mt-1 break-all text-h2 text-ink-1">{orderNumber}</p>
                </div>

                {finalSummary.total != null && (
                  <>
                    <FieldWell className="mt-6 divide-y divide-hairline px-4 py-2">
                      {finalSummary.discountAmount != null && finalSummary.discountAmount > 0 && (
                        <MoneyRow
                          label={c("checkout.discount", "Discount")}
                          value={`-${finalMoney(finalSummary.discountAmount)}`}
                          tone="credit"
                        />
                      )}
                      {finalSummary.vatAmount != null && (
                        <MoneyRow label={c("cart.vat", "VAT")} value={finalMoney(finalSummary.vatAmount)} />
                      )}
                    </FieldWell>

                    <div className="mt-5 border-t-2 border-border-strong pt-4">
                      <p className="u-micro text-ink-3">{c("checkout.finalTotal", "Final total")}</p>
                      {/* Hero rank, stepping down to section below 640px for the
                          same clipping reason the receipt does. This is the
                          figure the buyer came here to confirm, and it is the
                          one enormous thing on the screen. The digits are
                          swapped, never animated. */}
                      <Num rank="hero" value={finalMoney(finalSummary.total)} className="mt-1 block text-fig-section sm:text-fig-hero" />
                    </div>
                  </>
                )}

                {/* These are the server's own figures, in the currency the server
                    recorded on the order — not the cart's estimate, which no longer
                    exists by this point. Saying which is which is the whole point of
                    the provenance line. */}
                <Dateline className="mt-3">
                  {c(
                    "checkout.success.provenance",
                    "Final amounts as recorded on the order by the server · each in the order's own currency, with no conversion applied",
                  )}
                </Dateline>

                <p className="u-body mt-5 max-w-desc text-ink-2">
                  {paymentMethod === "BANK_TRANSFER"
                    ? c(
                        "checkout.success.bankPending",
                        "Payment is pending finance confirmation. The order is not marked paid until funds are verified.",
                      )
                    : c("checkout.success.pilotRecorded", "Pilot test payment recorded — no card was charged.")}
                </p>

                {/* next/link, not a bare <a>: this is an internal route, and a full
                    document reload immediately after the cart was cleared throws
                    away the client state the buyer just created. */}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="primary" size="lg">
                    <Link href="/account/orders">
                      {c("checkout.success.viewOrders", "View my orders")}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link href="/products">{c("checkout.browse", "Browse products")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Surface>
        </div>
      </MainLayout>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-block">
        <header className="mb-stack border-b border-border-strong pb-4">
          <Eyebrow>{c("checkout.eyebrow", "Checkout")}</Eyebrow>
          {/* One heading, in the reader's language. The English title with the
              Arabic phrase set beside it in grey was the page telling every
              visitor that it was written in the other language. */}
          <h1 className="u-h1 mt-1 text-ink-1">{c("checkout.title", "Checkout")}</h1>
          <Dateline className="mt-1.5">
            {c(
              "checkout.dateline",
              "Three steps · nothing is charged and no order exists until you submit the last one",
            )}
          </Dateline>
        </header>

        {/*
          THE PROGRESS RAIL, and it is the page's whole promise: that checkout is
          a short, finite sequence you can see the end of.

          Round one drew it as three chips joined by a static grey dash — a
          readout with no relationship between its parts. Each step now carries
          the SAME BRASS RULE the active nav item, the receipt's top edge and the
          certificate use, on a hairline track that is always there. Moving
          forward DRAWS the next rule from the inline start over 160ms; only its
          transform changes, so nothing reflows, and `transform-origin` is the
          inline-start token, which makes it draw from the right in Arabic with no
          second rule.

          It is a real ordered list and the current step carries aria-current, so
          it says where you are to a screen reader as plainly as it does to the
          eye. The rules are decoration on top of that, never the mechanism.
        */}
        <ol className="mb-block grid grid-cols-3 gap-2 sm:gap-4">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={s.id} aria-current={active ? "step" : undefined} className="min-w-0">
                <div className="h-0.5 w-full bg-hairline" aria-hidden="true">
                  <div className="u-drawn" data-on={done || active ? "true" : "false"} />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
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
                  <span className={cn("u-ui truncate", active ? "font-medium text-ink-1" : done ? "text-ink-2" : "text-ink-3")}>
                    {c(s.key, s.fallback)}
                  </span>
                </div>
                <span className="sr-only">
                  {done
                    ? c("checkout.step.completed", "completed")
                    : active
                      ? c("checkout.step.current", "current step")
                      : c("checkout.step.notStarted", "not started")}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 gap-block lg:grid-cols-[minmax(0,1fr)_minmax(320px,404px)]">
          {/* key={step} remounts the panel, which is what lets .u-pop's
              @starting-style entry run on each step. It is 180ms of opacity and
              an 8px inline travel; it gates nothing, and under reduced motion the
              starting style is never declared, so the panel simply appears. */}
          <div key={step} className="u-pop min-w-0">
            {step === "address" && (
              <Surface rung={2} className="p-5 sm:p-6">
                <h2 ref={stepHeadingRef} tabIndex={-1} className="u-h3 u-focus rounded-nested text-ink-1 outline-none">
                  {c("checkout.deliveryAddress", "Delivery address")}
                </h2>
                <p className="u-meta mt-1 text-ink-3">{c("checkout.address.hint", "Where the supplier ships this order.")}</p>

                {/* Every control now carries a real, associated label. The form
                    previously relied on placeholders alone, which vanish the
                    moment a buyer starts typing and are never announced as the
                    field's name. */}
                <div className="mt-5 space-y-1">
                  {/* REQUIRED, and it has to be gated here rather than only on
                      the server. The order endpoint's schema is
                      `label: z.string().trim().min(1)`, so an empty label is a
                      400 — and this field starts empty on purpose (seeding it
                      with the English word "Home" put an English word inside an
                      Arabic form the moment the page loaded). Without the gate
                      the DEFAULT path through checkout walks all three steps and
                      is refused at submission, which is the worst possible place
                      on the money path to discover a missing field. */}
                  <Field
                    label={c("checkout.address.label", "Address label")}
                    htmlFor="ck-label"
                    required
                    hint={c("checkout.address.labelHint", "For example Home or Office.")}
                  >
                    <Input id="ck-label" required value={address.label} onChange={(e) => setAddress({ ...address, label: e.target.value })} />
                  </Field>
                  <Field label={c("checkout.address.line1", "Street address")} htmlFor="ck-line1" required>
                    <Input
                      id="ck-line1"
                      value={address.line1}
                      onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                      placeholder={c("checkout.address.line1Placeholder", "Building, street")}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                    <Field label={c("checkout.address.city", "City")} htmlFor="ck-city" required>
                      <Input id="ck-city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    </Field>
                    <Field label={c("checkout.address.country", "Country")} htmlFor="ck-country" required>
                      <select
                        id="ck-country"
                        required
                        value={address.country}
                        onChange={(e) => setAddress({ ...address, country: e.target.value })}
                        data-rung={1}
                        className={SELECT_CONTROL}
                        style={{ height: "var(--control-h-md)" }}
                      >
                        <option value="" disabled>{c("checkout.address.selectCountry", "Select country")}</option>
                        {/* SUPPORTED_COUNTRIES carries the ISO code and the
                            English name. The code is the value that is stored;
                            the name is a user-visible string, so it is looked up
                            by code and falls back to the English name. An
                            Arabic delivery form listing "United Arab Emirates"
                            is the single most visible remaining seam. */}
                        {SUPPORTED_COUNTRIES.map(([code, name]) => (
                          <option key={code} value={code}>{c(`checkout.countries.${code}`, name)}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                <Button
                  className="mt-5 w-full"
                  size="lg"
                  onClick={() => setStep("payment")}
                  disabled={
                    !address.label.trim() ||
                    !address.line1.trim() ||
                    !address.city.trim() ||
                    !address.country
                  }
                >
                  {c("checkout.continueToPayment", "Continue to payment")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Button>
              </Surface>
            )}

            {step === "payment" && (
              <Surface rung={2} className="p-5 sm:p-6">
                <h2 ref={stepHeadingRef} tabIndex={-1} className="u-h3 u-focus rounded-nested text-ink-1 outline-none">
                  {c("checkout.paymentMethod", "Payment method")}
                </h2>

                {PILOT_MODE && (
                  // Recessed and toned: this is context about the environment, not
                  // something to act on.
                  <Surface rung={1} tone="accent" className="mt-4 p-3">
                    <p className="u-meta text-ink-2">
                      {c(
                        "checkout.pilotNotice",
                        "Pilot mode is explicitly enabled. Test payment records are simulation-only and never represent a card charge.",
                      )}
                    </p>
                  </Surface>
                )}

                {/*
                  Native radios in a fieldset, replacing a row of <button>s that
                  carried no selected state for assistive technology and no arrow-key
                  navigation. The visual selection and the announced selection are
                  now the same fact.

                  The selected row also draws the brass rule down its inline
                  start — the same `.u-drawn` gesture as the progress rail above
                  it, the active nav item and the receipt's top edge, turned
                  vertical. It scales from 0, so selecting a method can never
                  reflow the four rows beneath it, and `transform-origin: top`
                  plus `start-0` puts it on the correct edge in Arabic with no
                  second rule.
                */}
                <fieldset className="mt-5">
                  <legend className="sr-only">{c("checkout.paymentMethod", "Payment method")}</legend>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const selected = paymentMethod === pm.id;
                      return (
                        <label
                          key={pm.id}
                          className={cn(
                            "relative flex items-start gap-3 overflow-hidden rounded-lg border p-3",
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
                          <span className="absolute inset-y-0 start-0 flex w-0.5" aria-hidden="true">
                            <span className="u-drawn h-full" data-orientation="vertical" data-on={selected ? "true" : "false"} />
                          </span>
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
                            <span className="u-ui block font-medium text-ink-1">{c(pm.labelKey, pm.label)}</span>
                            <span className="u-meta block text-ink-3">{c(pm.descKey, pm.desc)}</span>
                          </span>
                          {!pm.enabled && (
                            <StatusPill tone="neutral" className="mt-0.5 shrink-0">
                              {c("checkout.notEnabled", "Not enabled")}
                            </StatusPill>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-5 flex gap-3">
                  <Button variant="outline" size="lg" onClick={() => setStep("address")}>{c("checkout.back", "Back")}</Button>
                  <Button className="flex-1" size="lg" onClick={() => setStep("review")}>
                    {c("checkout.reviewOrder", "Review order")}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </Button>
                </div>
              </Surface>
            )}

            {step === "review" && (
              <Surface rung={2} className="overflow-hidden">
                <div className="p-5 pb-4 sm:p-6 sm:pb-4">
                  <h2 ref={stepHeadingRef} tabIndex={-1} className="u-h3 u-focus rounded-nested text-ink-1 outline-none">
                    {c("checkout.reviewTitle", "Review your order")}
                  </h2>
                  <Dateline className="mt-1">
                    {c(
                      "checkout.reviewProvenance",
                      "Lines as held in this browser · the server re-resolves each product, its price and its VAT before the order is written",
                    )}
                  </Dateline>
                </div>

                {/* The same frame as the cart line and the wishlist tile. A
                    review step that shows only names and numbers asks the buyer
                    to trust a list of strings; showing the product at the last
                    moment before they commit is the cheapest confidence there
                    is, and it costs no claim. */}
                <ul className="divide-y divide-hairline border-y border-hairline">
                  {items.map((item) => (
                    <li key={item.id} className="u-frame-host flex items-center gap-3 px-5 py-3 sm:px-6">
                      <LineFrame width="w-[52px]" sku={item.sku}>
                        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="52px" /> : undefined}
                      </LineFrame>
                      <div className="min-w-0 flex-1">
                        <p className="u-ui truncate font-medium text-ink-1">
                          {locale === "ar" ? item.nameAr || item.nameEn : item.nameEn || item.nameAr}
                        </p>
                        <p className="u-meta text-ink-3">
                          <span className="tnum">{item.qty}</span>
                          {" × "}
                          <span className="tnum">{formatCurrency(item.unitPrice, item.currency as never, locale)}</span>
                          {" · "}
                          {/* Same statement as the cart line, in the same words:
                              the figure at the end of this row is exclusive of
                              VAT, and the estimate below adds it. */}
                          {item.vatRate != null
                            ? c("cart.exclVatRate", `Excl. VAT ${item.vatRate}%`, { rate: item.vatRate })
                            : c("checkout.vatMissing", "VAT rate not recorded")}
                        </p>
                      </div>
                      <span className="fig shrink-0 text-ui text-ink-1">
                        {formatCurrency(item.unitPrice * item.qty, item.currency as never, locale)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="p-5 pt-5 sm:p-6">
                  <Field
                    label={c("checkout.coupon", "Coupon / event code")}
                    htmlFor="coupon-code"
                    hint={c(
                      "checkout.couponHint",
                      "Validated against current eligibility, usage limits and stacking rules when you submit. The browser does not calculate or authorize the discount.",
                    )}
                  >
                    <Input
                      id="coupon-code"
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                      maxLength={40}
                      placeholder={c("checkout.couponPlaceholder", "Optional code")}
                      startIcon={<TicketPercent className="h-4 w-4" aria-hidden="true" />}
                      className="u-mono"
                    />
                  </Field>

                  {mixedCurrencies && (
                    <p role="alert" className="u-meta mt-3 text-danger-ink">
                      {c("checkout.mixedCurrency", "Remove items in other currencies before checkout.")}
                    </p>
                  )}

                  {submitError && (
                    <Surface rung={1} tone="danger" role="alert" className="mt-4 p-3">
                      <p className="u-ui text-danger-ink">{submitError}</p>
                    </Surface>
                  )}

                  <div className="mt-5 flex gap-3">
                    <Button variant="outline" size="lg" onClick={() => setStep("payment")}>{c("checkout.back", "Back")}</Button>
                    {/* The one raised, filled, primary control on the page, and
                        the only one on the whole money path that writes an
                        order. `loading` is a genuine in-flight readout, not a
                        gate dressed as one: the request is already on the wire
                        when the spinner appears. */}
                    <Button className="flex-1" size="lg" loading={loading} disabled={mixedCurrencies} onClick={placeOrder}>
                      {c("checkout.placeOrder", "Submit order")}
                    </Button>
                  </div>
                </div>
              </Surface>
            )}
          </div>

          {/* The running estimate follows the buyer down all three steps, so the
              number never has to be remembered between panels — and it is the
              SAME OBJECT the cart and the order record use, so the figure a
              buyer has been watching since the catalogue never changes shape
              underneath them. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Receipt
              eyebrow={c("checkout.orderSummary", "Order summary")}
              /* "Estimate", not "Total": nothing on this page is the price until
                 the server has priced it, and the word is the honest one. It is
                 the one difference between this receipt and the cart's. */
              totalLabel={c("checkout.estimate", "Estimate")}
              totalValue={formatCurrency(orderTotal, checkoutCurrency as never, locale)}
              note={c(
                "checkout.estimateProvenance",
                "Estimated from the cart lines · final price, discounts, availability and tax are re-validated and priced by the server on submission, and an eligible coupon may reduce this total",
              )}
              footer={
                couponCode ? (
                  <p className="u-meta mt-3 text-ink-3">
                    {c("checkout.couponPending", "This code is validated when you submit.")}{" "}
                    <span className="u-mono text-ink-2">{couponCode}</span>
                  </p>
                ) : undefined
              }
            >
              <MoneyRow
                label={c("checkout.displayedSubtotal", "Displayed subtotal")}
                note={c("cart.lineCount", `${items.length} line${items.length !== 1 ? "s" : ""}`, { count: items.length })}
                value={formatCurrency(subtotal, checkoutCurrency as never, locale)}
              />
              <MoneyRow
                label={c("checkout.estimatedVat", "Estimated VAT")}
                value={formatCurrency(vatAmount, checkoutCurrency as never, locale)}
              />
            </Receipt>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
