"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  Dateline,
  EmptyState,
  FieldWell,
  Meter,
  Num,
  Skeleton,
  StatusPill,
} from "@avenick/ui";
import { ratingDistribution } from "./product-facts";
import { ReviewForm, type SubmittedReview } from "./review-form";
import { Stars } from "./stars";

export type Review = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  isVerified?: boolean;
  createdAt: string;
  user?: { firstName: string; lastName: string };
  /** Set only on a review merged in from this visitor's own POST response. */
  mine?: boolean;
};

/**
 * What the reviews section may offer the current visitor. Answered by the
 * eligibility endpoint, which reloads the account and checks for a DELIVERED
 * order containing this product; the POST re-checks all of it.
 */
export type ReviewAccess =
  | { state: "loading" }
  | { state: "ready"; eligible: boolean; reason: "anonymous" | "not-purchased" | "already-reviewed" | "ok" }
  | { state: "blocked"; message: string }
  | { state: "unknown" };

/**
 * The reviews section.
 *
 * NOTHING HERE IS INVENTED. The average is computed over the reviews the
 * catalogue actually returned and says so when that is a subset of the server's
 * total. The distribution is counted over the same window — never extrapolated
 * from an average, which is a chart drawn on a guess. The Verified badge means
 * exactly one thing: the eligibility service proved a DELIVERED order containing
 * this product before the row was written, and the POST re-checks it.
 *
 * WHO MAY WRITE IS DECIDED BY THE ENDPOINT, NEVER BY THIS COMPONENT. The form is
 * rendered only for `reason: "ok"`.
 *
 * THE EMPTY STATE IS THE DESIGNED OBJECT, and it is chosen by whether the reader
 * has anything to DO. The certificate variant is a composed plate that requires
 * exactly one real action; when the visitor can sign in and become eligible,
 * that action exists and the certificate is right. When they simply have not
 * bought the product there IS no honest next step, so the surface takes round
 * one's centred editorial blank instead. Inventing an action to satisfy a
 * variant is how a truthful surface starts looking padded.
 */
export function ReviewPanel({
  slug,
  reviews,
  reviewTotal,
  reviewTotalKnown,
  avgRating,
  access,
  onSubmitted,
  signInHref,
  locale,
}: {
  slug: string;
  reviews: Review[];
  reviewTotal: number;
  reviewTotalKnown: boolean;
  avgRating: number | null;
  access: ReviewAccess;
  onSubmitted: (review: SubmittedReview) => void;
  signInHref: string;
  locale: "en" | "ar";
}) {
  const t = useTranslations("pdp.reviews");
  const count = reviews.length;
  const distribution = ratingDistribution(reviews);

  // Western digits in both locales — the GCC commerce convention this system
  // states everywhere it prints a figure, pinned here rather than left to the
  // Arabic locale's default numbering system.
  //
  // en-AE, not en-US. This is a Gulf storefront and the English build is read in
  // the Gulf: "13 Feb 2026" is the order this audience reads a date in and the
  // order the provenance voice uses everywhere else in the system, where en-US
  // would print "Feb 13, 2026" beside an Arabic column that does not.
  const dateFormat = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-AE-u-nu-latn" : "en-AE", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [locale],
  );

  const accessLine =
    access.state === "loading" ? (
      // The eligibility answer arrives after the product does, so the line it
      // will occupy is reserved rather than left to appear and push the list
      // down under the reader.
      <Skeleton className="h-5 w-72 max-w-full" />
    ) : access.state === "ready" && access.reason === "ok" ? (
      <ReviewForm slug={slug} onSubmitted={onSubmitted} />
    ) : access.state === "ready" && access.reason === "anonymous" ? (
      <p className="u-ui text-ink-2">
        {/* Underlined at rest, not only on hover. This link sits INSIDE a
            sentence of body text, so with colour as its only resting cue it is
            invisible to a reader who cannot separate primary-ink from ink-2
            (WCAG 1.4.1). Elsewhere on this page the link is the whole cell and
            hover-underline is enough; here it is not. */}
        <Link href={signInHref} className="u-focus rounded-sm text-primary-ink underline underline-offset-4">
          {t("signIn")}
        </Link>{" "}
        {t("signInPrompt")}
      </p>
    ) : access.state === "ready" && access.reason === "not-purchased" ? (
      <p className="u-ui text-ink-2">{t("notPurchased")}</p>
    ) : access.state === "ready" && access.reason === "already-reviewed" ? (
      <p className="u-ui text-ink-2">{t("alreadyReviewed")}</p>
    ) : access.state === "blocked" ? (
      <p className="u-ui text-ink-2">{access.message}</p>
    ) : access.state === "unknown" ? (
      <p className="u-ui text-ink-2">{t("unknown")}</p>
    ) : null;

  if (count === 0) {
    const canSignIn = access.state === "ready" && access.reason === "anonymous";
    const canWrite = access.state === "ready" && access.reason === "ok";

    return (
      <div className="space-y-5">
        {canWrite ? (
          <>
            <Dateline>{t("emptyHeadline")}</Dateline>
            {accessLine}
          </>
        ) : canSignIn ? (
          <EmptyState
            variant="certificate"
            eyebrow={t("emptyEyebrow")}
            headline={t("emptyHeadline")}
            body={t("emptyBody")}
            glyph={<MessageSquare />}
            action={
              <Button asChild variant="secondary">
                <Link href={signInHref}>{t("emptyAction")}</Link>
              </Button>
            }
          />
        ) : (
          <>
            <EmptyState
              eyebrow={t("emptyEyebrow")}
              headline={t("emptyHeadline")}
              body={t("emptyBody")}
            />
            {accessLine}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {avgRating != null && (
        <FieldWell className="grid gap-x-10 gap-y-5 p-4 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:p-5">
          <div>
            {/* "out of 5" is a WORD, so it comes from the message tree like every
                other word. As a hardcoded "/ 5" it was both an English literal
                and a bidi hazard: a bare slash is a neutral character, so in an
                Arabic paragraph its resolved side depends on what happens to sit
                next to it, and the denominator could land on either side of the
                figure. A translated run beside the figure has a direction of its
                own and cannot reorder. */}
            <p className="flex items-baseline gap-2">
              <Num rank="section" value={avgRating} />
              <span className="u-meta text-ink-3">{t("ofFive")}</span>
            </p>
            <div className="mt-1">
              <Stars value={avgRating} />
            </div>
            {/* The average is over the reviews SHOWN, never over the total: when
                the server reports more than it sent, the label says which subset
                it is. */}
            <Dateline className="mt-1.5">
              {reviewTotal > count
                ? t("averagedOverRecent", { shown: count, total: reviewTotal })
                : t("averagedOver", { count })}
            </Dateline>
          </div>

          {/* Counted over the window the catalogue returned, never extrapolated
              from the average. The bars are decoration on a number that is
              printed beside them, so the distribution is never carried by length
              alone. */}
          <ul className="min-w-0 space-y-1.5" aria-label={t("distributionLabel")}>
            {distribution.map((row) => (
              <li key={row.stars} className="flex items-center gap-3">
                <span className="fig w-12 shrink-0 u-meta text-ink-3">
                  {t("starsRow", { stars: row.stars })}
                </span>
                <Meter
                  value={row.count}
                  max={count}
                  tone="neutral"
                  size="sm"
                  className="min-w-0 flex-1"
                  label={t("starsRowAria", { count: row.count, stars: row.stars })}
                />
                <span className="fig w-6 shrink-0 text-end u-meta text-ink-2">{row.count}</span>
              </li>
            ))}
          </ul>
        </FieldWell>
      )}

      {accessLine}

      <ul className="divide-y divide-hairline">
        {reviews.map((review) => {
          // The author line never claims more than the row proves: a name when
          // the API returned one, "You" for the review just merged from this
          // visitor's own submit, otherwise a plain "Buyer" — the badge, not the
          // name, carries the verified claim.
          const author = review.user
            ? `${review.user.firstName} ${review.user.lastName.charAt(0)}.`.trim()
            : review.mine
              ? t("authorYou")
              : t("author");
          return (
            <li key={review.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 u-ui font-medium text-ink-1">
                    {author}
                    {review.isVerified && <StatusPill tone="success">{t("verified")}</StatusPill>}
                  </p>
                  <p className="mt-1 flex items-center gap-2">
                    <Stars value={review.rating} className="h-3.5 w-3.5" />
                    <span className="fig u-meta text-ink-3">{t("outOf", { value: review.rating })}</span>
                  </p>
                </div>
                <span className="u-provenance shrink-0">{dateFormat.format(new Date(review.createdAt))}</span>
              </div>
              {review.title && <p className="mt-2 u-lead font-medium text-ink-1">{review.title}</p>}
              {review.body && <p className="mt-1 max-w-prose u-body text-ink-2">{review.body}</p>}
            </li>
          );
        })}
      </ul>

      {reviewTotal > count && (
        <Dateline>
          {reviewTotalKnown ? t("countRecent", { count }) : t("count", { count })}
        </Dateline>
      )}
    </div>
  );
}
