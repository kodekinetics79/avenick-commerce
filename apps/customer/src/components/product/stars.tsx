import * as React from "react";
import { Star } from "lucide-react";

/**
 * The rating mark.
 *
 * The filled glyph is INK, not brass. Brass has exactly three permitted uses in
 * this system — the active-indicator rule, tier marks and verification marks —
 * and a rating is none of them: a brass star next to the brass <TierMark> on the
 * supplier card would make "four and a half stars" and "GOLD supplier" read as
 * the same class of claim. A semantic token is equally wrong, because it would
 * assert "warning" about a five-star review. Ink carries the rank, and the
 * figure beside it always says the same thing in words.
 *
 * The glyphs are hidden from assistive technology on purpose: every caller pairs
 * them with the figure itself, so the rating is never carried by colour or by an
 * icon alone.
 *
 * No directive: this is imported by client islands, and a module with no
 * directive can be reached from either graph (law 9).
 */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star key={step} className={`${className} fill-current ${step <= filled ? "text-ink-1" : "text-border"}`} />
      ))}
    </span>
  );
}
