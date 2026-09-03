import * as React from "react";
import Link from "next/link";
import { MapPin, MessageSquare } from "lucide-react";
import { Button, Eyebrow, StatusPill, Surface, TierMark } from "@avenick/ui";
import { Stars } from "./stars";

export type ProductSeller = {
  id?: unknown;
  businessNameEn?: unknown;
  businessNameAr?: unknown;
  tier?: unknown;
  city?: unknown;
  country?: unknown;
  reviewSummary?: { averageRating: number | null; reviewCount: number };
};

/**
 * The supplier card.
 *
 * NO SEAL, AND THAT IS THE POINT. <TierMark verified> exists and is the most
 * beautiful gesture in this system — a single arc of brass light travelling once
 * around the mark — and it requires a `basis`: the SellerDocument that was
 * reviewed and when. The storefront detail DTO does not carry one. A brass arc
 * around a badge reading "Verified" with no reviewed document behind it is a
 * fabricated trust signal rendered in CSS, which is the one unsurvivable failure
 * on this platform. So the card renders the tier the seller actually has and
 * nothing more, and the seal arrives on the day the DTO carries the citation.
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
  };
  quoteHref: string;
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

          {hasRating && summary && summary.averageRating !== null && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Stars value={summary.averageRating} className="h-3.5 w-3.5" />
              <span className="fig u-ui font-medium text-ink-1">{summary.averageRating.toFixed(1)}</span>
              <span className="u-meta text-ink-3">{labels.ratingBasis(summary.reviewCount)}</span>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* TierMark is the only component permitted to emit brass, and a tier
              is one of its three permitted uses. A tier the mark does not
              recognise stays a neutral pill rather than being dressed up as an
              accolade. */}
          {tierLabel && (tier === "GOLD" || tier === "PLATINUM" || tier === "VERIFIED") ? (
            <TierMark tier={tier} label={tierLabel} />
          ) : tierLabel ? (
            <StatusPill tone="neutral">{tierLabel}</StatusPill>
          ) : null}

          <Button asChild variant="secondary" size="sm">
            <Link href={quoteHref}>
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              {labels.requestQuote}
            </Link>
          </Button>
        </div>
      </div>
    </Surface>
  );
}
