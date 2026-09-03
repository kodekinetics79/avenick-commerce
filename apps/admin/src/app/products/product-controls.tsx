"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, RefreshCw, RotateCcw } from "lucide-react";
import { Button, Input, Surface } from "@avenick/ui";
import { ProductReviewControls } from "@/app/approvals/product-review-controls";
import { DecisionNoticeInline } from "@/app/approvals/decision-notice";
import { restoreListing, suppressListing } from "./actions";

interface Props {
  productId: string;
  status: string;
  /** Where a restore would land, derived server-side from publishedAt. */
  restoreTarget?: "ACTIVE" | "DRAFT";
}

/**
 * Per-row controls keyed on the listing's status. Review decisions reuse the
 * approvals control so both surfaces behave identically; suppress requires a
 * reason inline because it becomes the seller-facing issue text.
 *
 * Suppress is the one control here that takes a live listing off the storefront,
 * so it is the low-weight ghost that opens a recessed reason field rather than a
 * filled button that commits on the first click.
 */
export function ProductControls({ productId, status, restoreTarget }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suppressing, setSuppressing] = useState(false);
  const [reason, setReason] = useState("");
  // The empty-reason guard belongs to the field; a server refusal belongs to
  // the platform record and renders as the compare-and-swap notice.
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (status === "PENDING_REVIEW") return <ProductReviewControls productId={productId} />;
  if (done) {
    return (
      <p className="u-meta inline-flex items-center gap-1.5 text-success-ink">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {done}
      </p>
    );
  }

  function suppress() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setFieldError("A suppression reason is required");
      return;
    }
    setFieldError(null);
    setRefusal(null);
    startTransition(async () => {
      const result = await suppressListing({ productId, reason: trimmed });
      if (!result.ok) {
        // A refusal carrying `field` is about the reason that was typed, not
        // about the listing's recorded state. It goes back on the field; the
        // compare-and-swap notice is reserved for the case where the platform
        // record disagreed with the click.
        if (result.field) {
          setFieldError(result.error);
          return;
        }
        setRefusal(result.error);
        return;
      }
      setDone(result.message ?? "Suppressed");
      router.refresh();
    });
  }

  function restore() {
    setRefusal(null);
    startTransition(async () => {
      const result = await restoreListing({ productId });
      if (!result.ok) {
        setRefusal(result.error);
        return;
      }
      setDone(result.message ?? "Restored");
      router.refresh();
    });
  }

  if (status === "SUPPRESSED") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button type="button" variant="secondary" size="sm" onClick={restore} loading={pending}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore
        </Button>
        {restoreTarget && (
          <span className="u-meta max-w-[28ch] text-end text-ink-3">
            {restoreTarget === "ACTIVE" ? "Returns to its pre-suppression state (live unless the seller had paused it)" : "Never approved — returns to draft"}
          </span>
        )}
        {refusal && (
          <DecisionNoticeInline
            message={refusal}
            className="w-full max-w-sm"
            action={
              <Button type="button" variant="ghost" size="xs" onClick={() => router.refresh()}>
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Re-read this row
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    // DRAFT / REJECTED / SUSPENDED are owned by the seller or by the review
    // flow; there is no platform action to offer here.
    return <span className="u-meta text-ink-3">No platform action</span>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {suppressing ? (
        // Recessed, because law A reads "recessed = context or input" and this
        // is the one place on the row where something is typed.
        <Surface
          rung={1}
          as="form"
          aria-label="Suppress this listing"
          className="w-full max-w-sm space-y-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            suppress();
          }}
        >
          <Input
            autoFocus
            label="Reason the seller will see"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this listing is being taken down"
            maxLength={1000}
            disabled={pending}
            error={fieldError ?? undefined}
            hint="Written to the seller's issues queue."
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setSuppressing(false);
                setFieldError(null);
                setRefusal(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={pending}>
              <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Confirm suppression
            </Button>
          </div>
        </Surface>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setSuppressing(true)}
          className="hover:text-danger-ink"
        >
          <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Suppress
        </Button>
      )}
      {refusal && (
          <DecisionNoticeInline
            message={refusal}
            className="w-full max-w-sm"
            action={
              <Button type="button" variant="ghost" size="xs" onClick={() => router.refresh()}>
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Re-read this row
              </Button>
            }
          />
        )}
    </div>
  );
}
