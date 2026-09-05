import { formatCurrency } from "@avenick/utils";
import { MoneyRow, Receipt, type Copy } from "@/app/cart/_money-path";
import type { PreflightResult } from "@/lib/checkout-preflight";
import type { ServerQuote } from "@/lib/checkout-quote";

/**
 * THE PRE-SUBMIT SUMMARY: the same six lines the order will carry, with each
 * line stating where its figure comes from.
 *
 * composeOrderTotals builds an order as goods − discount + VAT on goods +
 * delivery + VAT on delivery. There are two ways to fill those six lines
 * before the order exists, and the difference between them is stated on the
 * receipt rather than hidden:
 *
 *   QUOTED — POST /api/v1/checkout/quote has answered for exactly these lines,
 *   this address and this code. Every figure is the server's, produced by the
 *   same functions that will write the order, and the receipt says so and
 *   says until when.
 *
 *   STATED — no fresh quote (the endpoint is not deployed, throttled, or the
 *   address is not complete yet). Only the goods and their VAT can be shown as
 *   figures, and both are labelled as the cart's displayed figures. The other
 *   three rows name the RULE the server will apply — the zone, the basis, the
 *   rate — and show a figure only where it is the server's own fact (a zone's
 *   flat fallback price; the zero an unconfigured tariff charges).
 *
 * Nothing here is arithmetic the server did not already do.
 */
export type QuoteStatus = "idle" | "loading" | "ready" | "failed";

export interface CheckoutSummaryProps {
  c: Copy;
  locale: "en" | "ar";
  currency: string;
  /** summarizeCartCommercial: the displayed unit prices × quantities, VAT-exclusive. */
  subtotal: number;
  /** summarizeCartCommercial: VAT at the rates carried on the displayed lines. */
  vatEstimate: number;
  /** summarizeCartCommercial: the two above, added. */
  estimate: number;
  lineCount: number;
  couponCode: string;
  preflight: PreflightResult;
  /** The delivery country's name in the reader's language, once chosen. */
  countryName: string | null;
  /** A fresh server quote for the current basket, or null. */
  quote?: ServerQuote | null;
  quoteStatus?: QuoteStatus;
}

export function CheckoutSummary({
  c, locale, currency, subtotal, vatEstimate, estimate, lineCount, couponCode, preflight, countryName,
  quote = null, quoteStatus = "idle",
}: CheckoutSummaryProps) {
  const money = (value: number) => formatCurrency(value, currency as never, locale);
  const onSubmission = c("checkout.summary.onSubmission", "On submission");
  const { delivery, jurisdiction, vatRateDiffers } = preflight;
  const rate = jurisdiction?.ratePercent ?? null;
  // ICU number arguments are formatted per locale — Arabic-Indic digits under
  // `ar` — and the design system pins Western digits in both. Strings pass
  // through verbatim.
  const rateText = rate == null ? "" : String(rate);
  const country = countryName ?? jurisdiction?.country ?? "";
  const listSeparator = locale === "ar" ? "، " : ", ";

  const zoneName = delivery.kind === "QUOTED"
    ? (locale === "ar" ? delivery.zone.nameAr || delivery.zone.nameEn : delivery.zone.nameEn)
    : "";

  /* ── QUOTED ─────────────────────────────────────────────────────────────
     A quote whose delivery is "unavailable" carries a total for an order the
     server will refuse; that case is shown in the stated form below, with the
     refusal, rather than as a total. */
  const quoted = quote && quote.shipping.status !== "unavailable" ? quote : null;
  if (quoted) {
    const t = quoted.totals;
    const quotedRate = String(quoted.vatRatePercent);
    const quotedZone = quoted.shipping.zoneName ?? zoneName;
    const validUntil = new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-GB", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(quoted.expiresAt));
    const promotionLabels = quoted.promotions.map((promotion) => promotion.label).filter(Boolean).join(listSeparator) || couponCode;

    const deliveryNote = quoted.shipping.status === "unpriced_no_zones"
      ? c("checkout.summary.deliveryNotConfigured", "No delivery tariff is configured — nothing is added for delivery")
      : delivery.kind === "QUOTED" && delivery.basis === "FALLBACK"
        ? c("checkout.summary.deliveryFallback", `${quotedZone} · flat rate, as an item has no recorded weight`, { zone: quotedZone })
        : quotedZone
          ? c("checkout.summary.deliveryPriced", `${quotedZone} · priced by the server for this destination and weight`, { zone: quotedZone })
          : c("checkout.summary.deliveryPricedNoZone", "Priced by the server for this destination and weight");

    return (
      <Receipt
        eyebrow={c("checkout.orderSummary", "Order summary")}
        lede={
          <p className="u-meta mt-1 text-ink-3">
            {c("checkout.summary.currencyAndVat", `All figures in ${quoted.currency} · VAT at ${quotedRate}%, ${country} being the place of supply`, { currency: quoted.currency, rate: quotedRate, country })}
          </p>
        }
        totalLabel={c("checkout.summary.quotedLabel", "Total, as quoted")}
        totalValue={money(t.total)}
        note={c(
          "checkout.summary.quotedProvenance",
          `Quoted by the server for these lines and this address · valid until ${validUntil} · the same arithmetic writes the order when you submit`,
          { time: validUntil },
        )}
      >
        <MoneyRow
          label={c("checkout.summary.subtotal", "Subtotal (excl. VAT)")}
          note={c("checkout.summary.subtotalQuoted", `${lineCount} line${lineCount === 1 ? "" : "s"} · priced by the server`, { count: lineCount, n: String(lineCount) })}
          value={money(t.subtotal)}
        />
        {(t.discountAmount > 0 || couponCode) && (
          <MoneyRow
            label={c("checkout.discount", "Discount")}
            note={
              t.discountAmount > 0
                ? c("checkout.summary.discountApplied", `${promotionLabels} · applied by the server`, { labels: promotionLabels })
                : c("checkout.summary.discountNone", "No discount applies to this basket")
            }
            value={t.discountAmount > 0 ? `-${money(t.discountAmount)}` : money(0)}
            tone="credit"
          />
        )}
        <MoneyRow
          label={c("checkout.success.goodsVat", "VAT on goods")}
          note={c("checkout.summary.goodsVatRate", `At ${quotedRate}% · ${country} is the place of supply`, { rate: quotedRate, country })}
          value={money(t.goodsVatAmount)}
        />
        <MoneyRow label={c("checkout.summary.delivery", "Delivery")} note={deliveryNote} value={money(t.shippingAmount)} />
        <MoneyRow
          label={c("checkout.summary.deliveryVat", "VAT on delivery")}
          note={
            quoted.shipping.status === "unpriced_no_zones"
              ? c("checkout.summary.deliveryVatNone", "No delivery charge, so no VAT on it")
              : c("checkout.summary.deliveryVatRate", `At ${quotedRate}% of the delivery charge`, { rate: quotedRate })
          }
          value={money(t.shippingVatAmount)}
        />
      </Receipt>
    );
  }

  /* ── STATED ───────────────────────────────────────────────────────────── */
  let deliveryValue = onSubmission;
  let deliveryNote: string;
  switch (delivery.kind) {
    case "QUOTED": {
      const threshold = delivery.freeOverSubtotal == null ? null : money(delivery.freeOverSubtotal);
      if (delivery.basis === "FALLBACK") {
        deliveryNote = threshold == null
          ? c("checkout.summary.deliveryFallback", `${zoneName} · flat rate, as an item has no recorded weight`, { zone: zoneName })
          : c("checkout.summary.deliveryFallbackOrFree", `${zoneName} · flat rate, as an item has no recorded weight · free at or above ${threshold} before VAT`, { zone: zoneName, threshold });
        // The flat rate is the zone's own published figure; with a free
        // threshold in play the server may charge nothing instead, so only
        // the unconditional case prints it.
        if (threshold == null) deliveryValue = money(delivery.fallbackPrice);
      } else {
        deliveryNote = threshold == null
          ? c("checkout.summary.deliveryByWeight", `${zoneName} · quoted by weight when you submit`, { zone: zoneName })
          : c("checkout.summary.deliveryByWeightOrFree", `${zoneName} · quoted by weight when you submit · free at or above ${threshold} before VAT`, { zone: zoneName, threshold });
      }
      break;
    }
    case "NOT_CONFIGURED":
      deliveryNote = c("checkout.summary.deliveryNotConfigured", "No delivery tariff is configured — nothing is added for delivery");
      deliveryValue = money(0);
      break;
    case "UNSERVED":
      deliveryNote = c("checkout.summary.deliveryUnserved", `Not delivered to ${country}`, { country });
      deliveryValue = "—";
      break;
    case "AMBIGUOUS":
      deliveryNote = c("checkout.summary.deliveryAmbiguous", "The delivery tariff for this country needs attention — see the address step");
      deliveryValue = "—";
      break;
    default:
      deliveryNote = c("checkout.summary.deliveryQuoted", "Quoted by the server when you submit");
  }
  // The server's quote can refuse a destination the tariff read in the
  // browser could not judge; then the stated form must not promise a quote.
  if (quote?.shipping.status === "unavailable" && delivery.kind !== "UNSERVED" && delivery.kind !== "AMBIGUOUS") {
    deliveryNote = c("checkout.summary.deliveryUnserved", `Not delivered to ${country}`, { country });
    deliveryValue = "—";
  }

  const deliveryRefused = deliveryValue === "—";
  const deliveryVatValue = delivery.kind === "NOT_CONFIGURED" ? money(0) : deliveryRefused ? "—" : onSubmission;
  const deliveryVatNote = delivery.kind === "NOT_CONFIGURED"
    ? c("checkout.summary.deliveryVatNone", "No delivery charge, so no VAT on it")
    : rate != null
      ? c("checkout.summary.deliveryVatRate", `At ${rate}% of the delivery charge`, { rate: rateText })
      : c("checkout.summary.deliveryVatUnknown", "At the destination’s statutory rate");

  const goodsVatNote = rate == null
    ? c("checkout.summary.goodsVatUnknown", "Estimated at the rates on the displayed lines")
    : vatRateDiffers
      ? c("checkout.summary.goodsVatDiffers", `Estimated at the displayed lines’ rates · the order is taxed at ${rate}% (${country})`, { rate: rateText, country })
      : c("checkout.summary.goodsVatRate", `At ${rate}% · ${country} is the place of supply`, { rate: rateText, country });

  return (
    <Receipt
      eyebrow={c("checkout.orderSummary", "Order summary")}
      lede={
        <p className="u-meta mt-1 text-ink-3">
          {rate == null
            ? c("checkout.summary.currencyOnly", `All figures in ${currency}`, { currency })
            : c("checkout.summary.currencyAndVat", `All figures in ${currency} · VAT at ${rate}%, ${country} being the place of supply`, { currency, rate: rateText, country })}
        </p>
      }
      totalLabel={c("checkout.summary.estimateLabel", "Estimate before delivery")}
      totalValue={money(estimate)}
      note={c(
        "checkout.summary.estimateProvenance",
        "Goods and their estimated VAT, from the lines in your cart · delivery, VAT on delivery and any discount are added by the server, and the recorded total is shown on your confirmation before any payment is taken",
      )}
      footer={
        <>
          {vatRateDiffers && rate != null && (
            <p role="status" className="u-meta mt-3 text-warning-ink">
              {c(
                "checkout.summary.vatRateDiffers",
                `Your delivery country taxes at ${rate}%; the displayed lines carry a different rate, so the VAT recorded on the order will differ from this estimate.`,
                { rate: rateText },
              )}
            </p>
          )}
          {quoteStatus === "loading" && (
            <p role="status" className="u-meta mt-3 text-ink-3">{c("checkout.summary.quoting", "Asking the server for a quote…")}</p>
          )}
          {quoteStatus === "failed" && (
            <p role="status" className="u-meta mt-3 text-ink-3">
              {c("checkout.summary.quoteUnavailable", "A live quote is not available right now · every figure is priced by the server when you submit")}
            </p>
          )}
        </>
      }
    >
      <MoneyRow
        label={c("checkout.summary.subtotal", "Subtotal (excl. VAT)")}
        note={c("checkout.summary.subtotalNote", `${lineCount} line${lineCount === 1 ? "" : "s"} · unit prices as displayed in your cart`, { count: lineCount, n: String(lineCount) })}
        value={money(subtotal)}
      />
      {couponCode && (
        <MoneyRow
          label={c("checkout.discount", "Discount")}
          note={c("checkout.summary.discountPending", `Code ${couponCode} · validated and applied by the server when you submit`, { code: couponCode })}
          value={onSubmission}
          tone="credit"
        />
      )}
      <MoneyRow label={c("checkout.summary.goodsVat", "Estimated VAT on goods")} note={goodsVatNote} value={money(vatEstimate)} />
      <MoneyRow label={c("checkout.summary.delivery", "Delivery")} note={deliveryNote} value={deliveryValue} />
      <MoneyRow label={c("checkout.summary.deliveryVat", "VAT on delivery")} note={deliveryVatNote} value={deliveryVatValue} />
    </Receipt>
  );
}
