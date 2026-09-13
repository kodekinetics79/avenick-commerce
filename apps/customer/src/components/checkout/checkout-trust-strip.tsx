import { BadgeCheck, CreditCard, Store, Undo2 } from "lucide-react";
import { Eyebrow, Surface } from "@avenick/ui";
import type { Copy } from "@/app/cart/_money-path";
import { BUYER_PAYMENT_METHODS } from "@/lib/checkout-order-record";
import { PAYMENT_METHOD_LABELS } from "./payment-methods";

/**
 * Four buyer-protection assurances for the last screen before money moves.
 * Each is checkable in the place named beside it, and each is stated for THIS
 * screen rather than copied from the home page's wording:
 *
 *   supplier gate      a SellerProfile is created PENDING_REVIEW and only the
 *                      platform moves it to ACTIVE — approveSeller in
 *                      services/admin.ts, or an operator catalogue script such
 *                      as pilot-catalog.ts. This row used to say "Business
 *                      documentation is reviewed before a seller can list", and
 *                      that is not true on either path: approveSeller checks no
 *                      document, and the pilot script bypasses it. On
 *                      production every live listing came from a seller with no
 *                      reviewed document. The row now says only what holds on
 *                      every path, under a storefront glyph rather than a check
 *                      mark, because a check mark is itself a verification claim.
 *   payment methods    the Prisma PaymentMethod enum, less the pilot MOCK;
 *                      which are enabled today is stated at the payment step —
 *                      a deliberate, disclosed choice (see payment-methods.ts),
 *                      so the list is not filtered here.
 *   priced before pay  VAT is stated per line here; delivery and its VAT are
 *                      quoted inside createOrder and recorded on the order,
 *                      which is PENDING_PAYMENT until funds are verified —
 *                      so every figure exists before any payment is taken. That
 *                      is true of the checkout path this strip sits on; it is a
 *                      narrower claim than any made before an order exists, and
 *                      it is stated at this boundary for that reason.
 *   returns            the ReturnRequest lifecycle, REQUESTED through REFUNDED
 */
export function CheckoutTrustStrip({ c, locale }: { c: Copy; locale: "en" | "ar" }) {
  const methods = BUYER_PAYMENT_METHODS
    .map((method) => c(PAYMENT_METHOD_LABELS[method].key, PAYMENT_METHOD_LABELS[method].fallback))
    .join(locale === "ar" ? "، " : ", ");

  const rows = [
    {
      icon: Store,
      title: c("checkout.trust.verifiedSellers", "Suppliers don't self-publish"),
      desc: c("checkout.trust.verifiedSellersDesc", "A supplier's storefront goes live only when the platform activates it."),
    },
    {
      icon: CreditCard,
      title: c("checkout.trust.paymentOptions", "Payment methods on this platform"),
      desc: c(
        "checkout.trust.paymentOptionsDesc",
        `${methods}. Which of these are enabled today is stated at the payment step.`,
        { methods },
      ),
    },
    {
      icon: BadgeCheck,
      title: c("checkout.trust.pricedFirst", "Priced before you pay"),
      desc: c(
        "checkout.trust.pricedFirstDesc",
        "VAT is stated on every line here; delivery and its VAT are quoted by the server and recorded on the order before any payment is taken.",
      ),
    },
    {
      icon: Undo2,
      title: c("checkout.trust.returns", "Returns you can track"),
      desc: c("checkout.trust.returnsDesc", "Raise a return against a delivered order and follow it to refund."),
    },
  ];

  return (
    <Surface rung={1} as="section" aria-labelledby="checkout-trust-heading" className="p-4">
      <Eyebrow as="h2" id="checkout-trust-heading">
        {c("checkout.trust.eyebrow", "Buyer protection")}
      </Eyebrow>
      <ul className="mt-3 space-y-3">
        {rows.map(({ icon: Icon, title, desc }) => (
          <li key={title} className="flex items-start gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-nested bg-primary-soft text-primary-ink">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="u-ui block font-medium text-ink-1">{title}</span>
              <span className="u-meta block text-ink-2">{desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
