"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw, Loader2 } from "lucide-react";
import { ProductReviewControls } from "@/app/approvals/product-review-controls";
import { restoreListing, suppressListing } from "./actions";

interface Props {
  productId: string;
  status: string;
  /** Where a restore would land, derived server-side from publishedAt. */
  restoreTarget?: "ACTIVE" | "DRAFT";
}

const BTN = "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Per-row controls keyed on the listing's status. Review decisions reuse the
 * approvals control so both surfaces behave identically; suppress requires a
 * reason inline because it becomes the seller-facing issue text.
 */
export function ProductControls({ productId, status, restoreTarget }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suppressing, setSuppressing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (status === "PENDING_REVIEW") return <ProductReviewControls productId={productId} />;
  if (done) return <span className="text-xs text-muted-foreground">{done}</span>;

  function suppress() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A suppression reason is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await suppressListing({ productId, reason: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.message ?? "Suppressed");
      router.refresh();
    });
  }

  function restore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreListing({ productId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.message ?? "Restored");
      router.refresh();
    });
  }

  if (status === "SUPPRESSED") {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={restore} disabled={pending} className={`${BTN} border-border hover:bg-muted`}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Restore
        </button>
        {restoreTarget && (
          <span className="text-[11px] text-muted-foreground">
            {restoreTarget === "ACTIVE" ? "Returns to its pre-suppression state (live unless the seller had paused it)" : "Never approved — returns to draft"}
          </span>
        )}
        {error && <span role="alert" className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    // DRAFT / REJECTED / SUSPENDED are owned by the seller or by the review
    // flow; there is no platform action to offer here.
    return <span className="text-xs text-muted-foreground">No platform action</span>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {suppressing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            suppress();
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason the seller will see"
            maxLength={1000}
            disabled={pending}
            aria-label="Suppression reason"
            className="h-8 w-52 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button type="submit" disabled={pending} className={`${BTN} border-red-600 bg-red-600 text-white hover:bg-red-700`}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />} Confirm suppress
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setSuppressing(false);
              setError(null);
            }}
            className={`${BTN} border-border text-muted-foreground hover:bg-muted`}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSuppressing(true)}
          disabled={pending}
          className={`${BTN} border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200`}
        >
          <Ban className="h-3 w-3" /> Suppress
        </button>
      )}
      {error && <span role="alert" className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
