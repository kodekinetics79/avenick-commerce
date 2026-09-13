import * as React from "react";
import Link from "next/link";
import { MapPin, MessageSquare } from "lucide-react";
import { Button, Dateline, Eyebrow, StatusPill, Surface, TierMark } from "@avenick/ui";
import { Stars } from "./stars";

export type ProductSeller = {
  id?: unknown;
  businessNameEn?: unknown;
  businessNameAr?: unknown;
  tier?: unknown;
  city?: unknown;
  country?: unknown;
  reviewSummary?: { averageRating: number | null; reviewCount: number };
  /** The approved, unexpired SellerDocument a verification mark cites, or null. */
  verification?: { type?: unknown; reviewedAt?: unknown } | null;
};

/**
 * The supplier card.
 *
 * "VERIFIED" IS A CITATION OR IT IS NOTHING. <TierMark verified> — a single arc
 * of brass light travelling once around the mark — requires a `basis`: the
 * SellerDocument that was reviewed and when. An earlier version withheld that
 * seal because the DTO carried no citation, and rendered "the tier the seller
 * actually has" instead — which printed the same word, "Verified", in the same
 * brass. That reasoning assumed the stored tier was a reviewed fact, and it was
 * not: the only code that writes SellerTier.VERIFIED is the pilot importer and
 * the seed scripts, and every seller with live listings carried it with zero
 * approved documents. The storefront was printing a verification claim on
 * every product page that no review had produced. The word needs the same basis
 * the seal does.
 *
 * So a VERIFIED seller renders the seal only when the DTO carries an approved,
 * unexpired document, with that document and its review date as the basis —
 * the mark's accessible name, and a provenance line under the location. Without
 * one, NO tier mark renders: a neutral pill reading "Verified" would still be
 * the claim, just quieter. GOLD and PLATINUM keep the brass tier pill and
 * STANDARD a neutral one; none of those words says a document was reviewed.
 *
 * The rating is aggregated from this seller's product reviews by the service and
 * is ABSENT when they have none — a supplier with no reviews shows no star
 * rather than a zero. Location is real, recorded on the profile, and was being
 * thrown away by every previous version of this page.
 */
export function SellerCard({
  seller,
  locale,
  labels,
  quoteHref,
}: {
  seller: ProductSeller;
  locale: "en" | "ar";
  labels: {
    eyebrow: string;
    requestQuote: string;
    location: (city: string, country: string) => string;
    ratingBasis: (count: number) => string;
    /**
     * The tier enum rendered as a word in the reader's own language. <TierMark>
     * documents the label as a CALLER-SUPPLIED enum→label map precisely so the
     * stored value never reaches a buyer: without it an Arabic supplier card
     * prints "GOLD" in a brass pill, which is the product announcing that Arabic
     * is a setting. Returns null for a tier the message tree does not name, and
     * the pill is then not rendered at all rather than falling back to the enum.
     */
    tier: (tier: string) => string | null;
    /**
     * The verification citation — "Trade licence reviewed 14 Feb 2026" — in the
     * reader's language. Returns null for a document type the message tree does
     * not name or a date that does not parse, and the mark is then not rendered.
     */
    verifiedBasis: (type: string, reviewedAt: string | Date) => string | null;
  };
  /**
   * Omitted when the price panel above already offers the same request as its
   * primary action. Two controls to one destination in one column is the
   * duplicate LAW G asks you to look for before counting options.
   */
  quoteHref?: string;
}) {
  const nameEn = seller.businessNameEn ? String(seller.businessNameEn) : "";
  const nameAr = seller.businessNameAr ? String(seller.businessNameAr) : "";
  const primaryName = locale === "ar" ? nameAr || nameEn : nameEn;
  const secondaryName = locale === "ar" ? (nameAr ? nameEn : "") : nameAr;
  const tier = seller.tier ? String(seller.tier) : "";
  const tierLabel = tier ? labels.tier(tier) : null;
  const city = seller.city ? String(seller.city) : "";
  const country = seller.country ? String(seller.country) : "";
  const summary = seller.reviewSummary;
  const hasRating = !!summary && summary.averageRating !== null && summary.reviewCount > 0;

  const verification = seller.verification;
  const reviewedAt = verification?.reviewedAt;
  const basis = tier === "VERIFIED" && typeof verification?.type === "string"
    && (typeof reviewedAt === "string" || reviewedAt instanceof Date)
    ? labels.verifiedBasis(verification.type, reviewedAt)
    : null;

  // TierMark is the only component permitted to emit brass, and a tier is one
  // of its three permitted uses. A tier the mark does not recognise stays a
  // neutral pill rather than being dressed up as an accolade.
  const tierMark = tier === "VERIFIED"
    ? (tierLabel && basis ? <TierMark verified verifiedLabel={tierLabel} basis={basis} /> : null)
    : tierLabel && (tier === "GOLD" || tier === "PLATINUM")
      ? <TierMark tier={tier} label={tierLabel} />
      : tierLabel
        ? <StatusPill tone="neutral">{tierLabel}</StatusPill>
        : null;

  return (
    <Surface rung={2} className="p-4 sm:p-5">
      <Eyebrow>{labels.eyebrow}</Eyebrow>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="u-lead font-medium text-ink-1">{primaryName}</p>
          {!!secondaryName && (
            <p className="u-ui text-ink-2" dir={locale === "ar" ? "ltr" : "rtl"}>
              {secondaryName}
            </p>
          )}

          {(city || country) && (
            <p className="mt-1.5 flex items-center gap-1.5 u-meta text-ink-3">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {labels.location(city, country)}
            </p>
          )}

          {basis && tierMark && (
            // The citation, printed. The seal's accessible name already carries
            // it, so this copy is hidden from assistive technology rather than
            // announced twice.
            <Dateline className="mt-1.5" aria-hidden="true">{basis}</Dateline>
          )}

          {hasRating && summary && summary.averageRating !== null && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars value={summary.averageRating} className="h-3.5 w-3.5" />
              <span className="fig u-ui font-medium text-ink-1">{summary.averageRating.toFixed(1)}</span>
              <span className="u-meta text-ink-3">{labels.ratingBasis(summary.reviewCount)}</span>
            </p>
          )}
        </div>

        {(tierMark || quoteHref) && (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {tierMark}

            {quoteHref && (
              <Button asChild variant="secondary" size="sm">
                <Link href={quoteHref}>
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  {labels.requestQuote}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </Surface>
  );
}
