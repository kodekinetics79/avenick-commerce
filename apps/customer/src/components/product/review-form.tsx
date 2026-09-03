"use client";

import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { Button, Input, Textarea, FieldWell, Eyebrow, Dateline } from "@avenick/ui";

/** Mirrors the API route's zod bounds; the server is still the authority. */
const TITLE_MAX = 120;
const BODY_MIN = 10;
const BODY_MAX = 2000;

export type SubmittedReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerified: boolean;
  createdAt: string;
};

/**
 * Review form for a buyer the eligibility endpoint has already cleared.
 *
 * The form never decides eligibility itself: the parent renders it only for
 * `reason: "ok"`, and the POST re-checks the delivered-order rule in the
 * database. A 403/409 here therefore means the world changed since the page
 * loaded, and the message from the server is shown as-is.
 */
export function ReviewForm({ slug, onSubmitted }: { slug: string; onSubmitted: (review: SubmittedReview) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ratingGroup = useRef<HTMLDivElement>(null);

  /**
   * Roving arrow-key selection across the rating, which is what a radio group
   * owes a keyboard user: one tab stop for the whole group, arrows to choose.
   * Before this, all five stars were separate tab stops and the arrow keys did
   * nothing, so the control announced itself as a radio group and then did not
   * behave like one.
   *
   * The horizontal arrows are read through the document direction, because in
   * Arabic the "next" star is the one to the LEFT.
   */
  function onRatingKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const forward = event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
    const backward = event.key === "ArrowUp" || event.key === (rtl ? "ArrowRight" : "ArrowLeft");
    if (!forward && !backward) return;
    event.preventDefault();
    const current = rating || 1;
    const next = forward ? Math.min(5, current + 1) : Math.max(1, current - 1);
    setRating(next);
    // Focus follows selection, which is the expected radio-group behaviour and
    // is what makes the arrow keys audible to a screen reader.
    const options = ratingGroup.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    options?.[next - 1]?.focus();
  }

  const trimmedBody = body.trim();
  const bodyTooShort = trimmedBody.length > 0 && trimmedBody.length < BODY_MIN;
  const canSubmit = rating >= 1 && rating <= 5 && !bodyTooShort && title.trim().length <= TITLE_MAX && trimmedBody.length <= BODY_MAX && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(trimmedBody ? { body: trimmedBody } : {}),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setError(payload?.error ?? "Could not submit your review. Please try again.");
        return;
      }
      onSubmitted(payload.data as SubmittedReview);
    } catch {
      setError("Could not submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const shown = hover || rating;

  return (
    // A recessed rung-1 well, not a card. The reviews section already sits on a
    // rung-2 panel, so a rung-2 form on top of it is white on white separated by
    // a hairline — the exact flatness the elevation ladder exists to fix. Law A
    // also puts this on the right rung on its own terms: a block of inputs is
    // recessed, and the controls inside keep their own edge and inset shadow.
    <FieldWell as="form" onSubmit={submit} className="space-y-4 p-4" aria-label="Write a review">
      <div>
        <Eyebrow>Your review</Eyebrow>
        <h3 className="mt-0.5 u-h3 text-ink-1">Write a review</h3>
        {/* Why this form is being offered at all, in the provenance voice: the
            eligibility endpoint proved a delivered order, which is exactly what
            the Verified badge on the stored review will mean. */}
        <Dateline className="mt-1">You received this product, so your review will carry the Verified badge</Dateline>
      </div>

      <div>
        <p id="review-rating-label" className="u-ui mb-1.5 font-medium text-ink-1">Rating</p>
        <div className="flex items-center gap-2">
          <div
            ref={ratingGroup}
            className="flex items-center gap-1"
            role="radiogroup"
            aria-labelledby="review-rating-label"
            onKeyDown={onRatingKeyDown}
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                // One tab stop for the group: the arrow keys move within it.
                tabIndex={value === (rating || 1) ? 0 : -1}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHover(value)}
                onFocus={() => setHover(value)}
                onBlur={() => setHover(0)}
                className="u-focus rounded-sm p-0.5"
              >
                {/* Ink, for the same reason the rating marks on the product page
                    are ink: brass has three permitted uses in this system and a
                    rating is none of them, and a semantic hue would assert
                    "warning" about a five-star review. The figure beside the marks
                    always says the same thing in words. */}
                <Star className={`h-6 w-6 fill-current transition-colors duration-press ease-standard ${value <= shown ? "text-ink-1" : "text-border"}`} aria-hidden="true" />
              </button>
            ))}
          </div>
          {/* Outside the radiogroup on purpose: a group whose children are all
              role="radio" is what lets a screen reader announce "2 of 5"; a
              stray span inside it breaks that count. */}
          {rating > 0 && <span className="fig u-ui text-ink-2">{rating}/5</span>}
        </div>
      </div>

      <Input
        label="Title (optional)"
        value={title}
        maxLength={TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Sum it up in a line"
      />

      <div>
        <label htmlFor="review-body" className="mb-1.5 block u-ui font-medium text-ink-1">Review (optional)</label>
        <Textarea
          id="review-body"
          value={body}
          maxLength={BODY_MAX}
          rows={4}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What was it like to order, receive and use?"
          aria-invalid={bodyTooShort}
          aria-describedby="review-body-hint"
        />
        {/* The line's height is reserved either way, so tripping the minimum
            never pushes the submit button down the page under the pointer. */}
        <p id="review-body-hint" className={`mt-1 min-h-[18px] u-meta ${bodyTooShort ? "text-danger-ink" : "text-ink-3"}`}>
          {bodyTooShort ? `At least ${BODY_MIN} characters, or leave it empty.` : `${trimmedBody.length}/${BODY_MAX}`}
        </p>
      </div>

      {error && <p className="u-ui text-danger-ink" role="alert">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {rating === 0 ? <span className="u-meta text-ink-2">Pick a star rating to continue.</span> : <span />}
        <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
          {submitting ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </FieldWell>
  );
}
