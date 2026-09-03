/**
 * Renders the outcome of a governed purchase-order transition.
 *
 * Financial actions must state what happened. This is the surface that makes
 * the difference between "approved" and "silently did nothing" visible.
 */
export function POActionBanner({ done, error }: { done?: string; error?: string }) {
  if (!done && !error) return null;

  const isError = Boolean(error);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-success/30 bg-success/10 text-success-foreground"
      }`}
    >
      <span className="font-semibold">{isError ? "Action failed. " : "Done. "}</span>
      {error ?? done}
    </div>
  );
}
