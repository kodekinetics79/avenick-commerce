"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button, Input, Textarea } from "@avenick/ui";

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
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-4 space-y-4" aria-label="Write a review">
      <div>
        <p className="text-sm font-semibold text-foreground">Write a review</p>
        <p className="text-xs text-muted-foreground mt-0.5">You received this product, so your review will carry the Verified badge.</p>
      </div>

      <div>
        <p id="review-rating-label" className="text-sm font-medium mb-1.5">Rating</p>
        <div className="flex items-center gap-1" role="radiogroup" aria-labelledby="review-rating-label">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHover(value)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              className="p-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star className={`h-6 w-6 transition-colors ${value <= shown ? "text-amber-400 fill-current" : "text-muted-foreground/30 fill-current"}`} />
            </button>
          ))}
          {rating > 0 && <span className="ms-2 text-sm text-muted-foreground">{rating}/5</span>}
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
        <label htmlFor="review-body" className="mb-1.5 block text-sm font-medium text-foreground">Review (optional)</label>
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
        <p id="review-body-hint" className={`mt-1 text-xs ${bodyTooShort ? "text-destructive" : "text-muted-foreground"}`}>
          {bodyTooShort ? `At least ${BODY_MIN} characters, or leave it empty.` : `${trimmedBody.length}/${BODY_MAX}`}
        </p>
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {rating === 0 ? <span className="text-xs text-muted-foreground">Pick a star rating to continue.</span> : <span />}
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? "Submitting…" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
