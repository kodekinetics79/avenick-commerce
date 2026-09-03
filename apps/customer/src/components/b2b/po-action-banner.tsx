/**
 * Renders the outcome of a governed purchase-order transition.
 *
 * Financial actions must state what happened. This is the surface that makes
 * the difference between "approved" and "silently did nothing" visible.
 */
import { Surface } from "@avenick/ui";

export function POActionBanner({ done, error }: { done?: string; error?: string }) {
  if (!done && !error) return null;

  const isError = Boolean(error);
  return (
    // The ink is the -ink token, not the fill hue and not -foreground.
    // `text-success-foreground` is the colour meant to sit ON a success fill; on
    // a 10% success wash it was near-white text on near-white paper.
    <Surface
      rung={2}
      tone={isError ? "danger" : "success"}
      role="status"
      aria-live="polite"
      className="px-4 py-3"
    >
      <p className={`u-ui ${isError ? "text-danger-ink" : "text-success-ink"}`}>
        <span className="font-medium">{isError ? "Action failed. " : "Done. "}</span>
        <span className="text-ink-1">{error ?? done}</span>
      </p>
    </Surface>
  );
}
