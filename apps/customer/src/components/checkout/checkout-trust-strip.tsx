import { BadgeCheck, CreditCard, ShieldCheck, Undo2 } from "lucide-react";
import { Eyebrow, Surface } from "@avenick/ui";
import type { Copy } from "@/app/cart/_money-path";
import { BUYER_PAYMENT_METHODS } from "@/lib/checkout-order-record";
import { PAYMENT_METHOD_LABELS } from "./payment-methods";

/**
 * The home page's four buyer-protection assurances, compacted for the last
 * screen before money moves. Same facts, checkable in the same places:
 *
 *   verified sellers   SellerProfile reaches ACTIVE only through the approval
 *                      gate in services/admin.ts
 *   payment methods    the Prisma PaymentMethod enum, less the pilot MOCK;
 *                      which are enabled today is stated at the payment step
 *   priced before pay  VAT is stated per line here; delivery and its VAT are
 *                      quoted inside createOrder and recorded on the order,
 *                      which is PENDING_PAYMENT until funds are verified —
 *                      so every figure exists before any payment is taken.
 *                      (The home page says "before you place the order"; on
 *                      this screen the delivery figure visibly is not, so the
 *                      claim is stated at the boundary that is actually true.)
 *   returns            the ReturnRequest lifecycle, REQUESTED through REFUNDED
 *
 * Nothing here is a new claim.
 */
export function CheckoutTrustStrip({ c, locale }: { c: Copy; locale: "en" | "ar" }) {
  const methods = BUYER_PAYMENT_METHODS
    .map((method) => c(PAYMENT_METHOD_LABELS[method].key, PAYMENT_METHOD_LABELS[method].fallback))
    .join(locale === "ar" ? "، " : ", ");

  const rows = [
    {
      icon: ShieldCheck,
      title: c("checkout.trust.verifiedSellers", "Verified sellers"),
      desc: c("checkout.trust.verifiedSellersDesc", "Business documentation is reviewed before a seller can list."),
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
