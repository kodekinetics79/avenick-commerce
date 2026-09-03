"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@avenick/utils";
import { Dateline, Eyebrow, FieldWell, Num, QuantityLadder, SpecularSurface, Surface } from "@avenick/ui";
import type { Currency } from "@/lib/market-context";
import { nextBandOffer, splitMoney, type PriceBand } from "./product-facts";

export type PriceSelection = {
  unitPrice: number;
  vatRate: number;
  vatPerUnit: number;
  grossTotal: number;
  currency: string;
};

/**
 * The price block — the one RAISED object on this page, and the only rung 3 in
 * the viewport.
 *
 * WHY THE B2C AND B2B SHAPES DIFFER, and it is regulation rather than taste.
 * UAE FTA rules require consumer prices to be displayed VAT-INCLUSIVE, with an
 * explicit exception for supplies to VAT-registered businesses PROVIDED the
 * exclusion is stated. So the consumer headline is the inclusive unit price with
 * "Incl. VAT" beneath it, and the business headline is the exclusive figure with
 * the exclusion stated and the inclusive figure carried as a secondary line.
 * Both figures come from the same resolver output that the cart and the checkout
 * use; nothing here computes a price, and the full breakdown is printed below
 * either way. The asymmetry is also what makes the B2B surface feel like a more
 * serious product.
 *
 * THE FIGURE IS AT HERO RANK, not <PriceStack>'s `card` rank. PriceStack exists
 * for a tile, where 22px is correct against a 15px body; this is the highest
 * intent surface in the storefront and the price is the one enormous thing in
 * the buy column. The object it builds is identical — qualifier as a separate
 * metadata run, currency mark inside the figure run, VAT stated, secondary
 * beneath — so the two read as one component at two ranks. <PriceStack> itself
 * is used verbatim on the mobile buy bar, where `card` rank is right.
 */
export function PricePanel({
  selection,
  currency,
  locale,
  qty,
  moq,
  isB2B,
  ladder,
  onSetQty,
  children,
}: {
  selection: PriceSelection | null;
  currency: Currency;
  locale: "en" | "ar";
  qty: number;
  moq: number;
  isB2B: boolean;
  ladder: PriceBand[];
  onSetQty: (qty: number) => void;
  /** The quantity stepper and the commit action, rendered inside the panel. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("pdp.price");
  const tl = useTranslations("pdp.ladder");

  const money = (amount: number) => formatCurrency(amount, currency, locale);

  if (!selection) {
    return (
      <Surface rung={3} rim className="p-5 sm:p-6">
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <p className="mt-1 u-body text-danger-ink">{t("none")}</p>
        <Dateline className="mt-2">{t("noneBasis")}</Dateline>
        {children && <div className="mt-5">{children}</div>}
      </Surface>
    );
  }

  const inclusiveUnit = selection.unitPrice + selection.vatPerUnit;
  const headline = isB2B ? selection.unitPrice : inclusiveUnit;
  const headlineMoney = splitMoney(headline, currency, locale);
  const secondary = isB2B
    ? t("secondaryIncl", { amount: money(inclusiveUnit) })
    : t("secondaryExcl", { amount: money(selection.unitPrice) });

  const bands = ladder.map((band) => ({
    band: band.nextQty
      ? tl("band", { from: band.minQty, to: band.nextQty - 1 })
      : tl("bandOpen", { from: band.minQty }),
    price: money(band.unitPrice),
    from: band.minQty,
    to: band.nextQty === null ? null : band.nextQty - 1,
  }));

  const offer = nextBandOffer(ladder, qty);

  return (
    // SpecularSurface only feeds --mx/--my to the Surface below it. It carries no
    // styling of its own and early-returns before attaching a listener on a
    // coarse pointer or under reduced motion, so a phone registers nothing at
    // all. One specular surface on this page, well inside the 8–12 budget, and
    // it is on the raised object rather than on the photograph — a light sweep
    // over a supplier's own image is a change to their photograph.
    <SpecularSurface>
    <Surface rung={3} rim specular className="p-5 sm:p-6">
      <Eyebrow>{ladder.length > 1 ? t("eyebrowAtQty", { qty }) : t("eyebrow")}</Eyebrow>

      {/* The qualifier is a metadata run BESIDE the figure, never baked into the
          formatted string: baked in it renders at the figure's own rank and
          collapses the figure-to-label ratio at exactly the place a buyer looks
          first. The currency mark sits inside the figure run at half size —
          never superscripted, never a different colour, because a raised or
          coloured currency mark is discount-retail signalling and this is trade. */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Num rank="hero" currency={headlineMoney.code} value={headlineMoney.figure} />
        <span className="u-meta text-ink-3">{isB2B ? t("exclVat") : t("inclVat")}</span>
      </div>
      <p className="fig u-meta text-ink-3">{secondary}</p>

      <dl className="mt-4 divide-y divide-hairline border-t border-hairline">
        <MoneyRow label={t("vatRow", { rate: selection.vatRate })} value={money(selection.vatPerUnit)} />
        <MoneyRow label={t("quantityRow")} value={t("unitsValue", { qty })} />
        <MoneyRow label={t("totalRow")} value={money(selection.grossTotal)} emphasis />
      </dl>

      <Dateline className="mt-2">{t("basis")}</Dateline>

      {ladder.length > 1 && (
        // The bands the supplier actually published. There is no pricing leak in
        // showing these to a consumer: the detail DTO filters price rows by
        // CHANNEL before they ever reach the browser, so a B2C visitor is only
        // ever shown B2C bands and a B2B one only B2B bands. The tile-level rule
        // that gates a ladder on isB2B guards a LIST DTO, which does not filter.
        // Each row shows what the resolver says a buyer pays at that break — a
        // real <table> with scoped headers and an sr-only caption, because it is
        // tabular data and a screen reader must be able to navigate it by
        // column. All bands on the PDP; the tile is the surface that caps at
        // three.
        <FieldWell className="mt-4 p-3">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <Eyebrow>{tl("title")}</Eyebrow>
            {moq > 1 && <span className="fig u-meta text-ink-3">{tl("moq", { qty: moq })}</span>}
          </div>
          <QuantityLadder
            tiers={bands}
            activeQty={qty}
            max={0}
            caption={tl("caption")}
            headers={{ qty: tl("qtyHeader"), unitPrice: tl("priceHeader") }}
          />

          {offer && (
            // The one piece of merchandising on this page that is not a claim:
            // the bands are the supplier's own and the offer is arithmetic on
            // them. It carries the SAME brass rule as the active band directly
            // above it, the active nav item and the certificate's top edge — one
            // gesture in a different posture, never a sixth invention.
            // The action is an sr-only run INSIDE the control rather than an
            // aria-label over it. An aria-label REPLACES the accessible name, so
            // a voice-control user saying the words they can see — "twelve more
            // units" — would fail to reach a control whose only name was "Set
            // the quantity to 12 units" (WCAG 2.5.3, label in name). Composed
            // this way the visible offer leads the name and the action follows.
            <button
              type="button"
              onClick={() => onSetQty(offer.band.minQty)}
              // u-state-wash, NOT u-state. `.u-state` mixes toward --state-base, which
              // defaults to --primary, so a transparent control wearing it turns
              // solid indigo on hover — and this label is ink-2, which fails
              // outright on a filled primary ground. The wash is the documented
              // choice for a control sitting on a surface it does not own: an 8%
              // ink tint over whatever the well is, in both themes.
              className="u-focus u-state-wash mt-2 flex w-full items-center gap-2 rounded-nested border-s-[3px] border-brass px-2.5 py-2 text-start"
            >
              <span className="u-meta text-ink-2">
                {tl("nextOffer", { more: offer.more, price: money(offer.band.unitPrice) })}
              </span>
              <span className="sr-only">{tl("nextOfferAction", { qty: offer.band.minQty })}</span>
              <ArrowUpRight className="ms-auto h-3.5 w-3.5 shrink-0 text-brass-ink rtl:-scale-x-100" aria-hidden="true" />
            </button>
          )}
        </FieldWell>
      )}

      {children && <div className="mt-5">{children}</div>}
    </Surface>
    </SpecularSurface>
  );
}

/** One line of the price breakdown: label at the inline start, figure at the end. */
function MoneyRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={`u-ui ${emphasis ? "font-medium text-ink-1" : "text-ink-2"}`}>{label}</dt>
      <dd className={`fig text-end ${emphasis ? "u-lead font-medium text-ink-1" : "u-ui text-ink-1"}`}>{value}</dd>
    </div>
  );
}
