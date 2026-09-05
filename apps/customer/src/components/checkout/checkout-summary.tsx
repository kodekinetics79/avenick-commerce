import { formatCurrency } from "@avenick/utils";
import { MoneyRow, Receipt, type Copy } from "@/app/cart/_money-path";
import type { PreflightResult } from "@/lib/checkout-preflight";

/**
 * THE PRE-SUBMIT SUMMARY: the same six lines the order will carry, with each
 * line stating where its figure comes from.
 *
 * composeOrderTotals builds an order as goods − discount + VAT on goods +
 * delivery + VAT on delivery. Only two of those can be shown as figures before
 * the server has priced the order — the goods and their VAT, from the lines
 * in the cart, and both are labelled as the cart's displayed figures. The
 * other three are the server's to compute: the discount depends on rules the
 * browser cannot see, delivery on weights and bands it must not evaluate, and
 * VAT on delivery on that quote. Each of those rows names the RULE the server
 * will apply — the zone, the basis, the rate — and shows a figure only where
 * the figure is the server's own fact (a zone's flat fallback price, or the
 * zero that an unconfigured tariff charges). Nothing here is arithmetic the
 * server did not already do.
 */
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
}

export function CheckoutSummary({
  c, locale, currency, subtotal, vatEstimate, estimate, lineCount, couponCode, preflight, countryName,
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

  const zoneName = delivery.kind === "QUOTED"
    ? (locale === "ar" ? delivery.zone.nameAr || delivery.zone.nameEn : delivery.zone.nameEn)
    : "";

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

  const deliveryVatValue = delivery.kind === "NOT_CONFIGURED" ? money(0) : delivery.kind === "UNSERVED" || delivery.kind === "AMBIGUOUS" ? "—" : onSubmission;
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
        vatRateDiffers && rate != null ? (
          <p role="status" className="u-meta mt-3 text-warning-ink">
            {c(
              "checkout.summary.vatRateDiffers",
              `Your delivery country taxes at ${rate}%; the displayed lines carry a different rate, so the VAT recorded on the order will differ from this estimate.`,
              { rate: rateText },
            )}
          </p>
        ) : undefined
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
