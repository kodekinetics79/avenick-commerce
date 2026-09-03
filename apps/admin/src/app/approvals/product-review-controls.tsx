"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, Input, Surface } from "@avenick/ui";
import { approvePendingProduct, rejectPendingProduct } from "./actions";
import { DecisionNoticeInline } from "./decision-notice";

/**
 * What the control reports to a queue that owns the row's commit readout.
 * `idle` returns the row to rest — used when the refusal was about what was
 * typed rather than about the platform record, so the row was never contested.
 */
export type ReviewOutcome = "idle" | "pending" | "committed" | "failed";
/** Which decision it was, so the queue can tone the row's rule and wash. */
export type ReviewKind = "approve" | "reject";

interface Props {
  productId: string;
  /**
   * Lets the surrounding queue drive the row commit — the inline-start rule,
   * the wash and the drain. Presentation only: the decision has already been
   * written (or refused) by the time it fires.
   */
  onOutcome?: (outcome: ReviewOutcome, kind: ReviewKind) => void;
}

/**
 * Approve / Reject for a listing in PENDING_REVIEW. Reject is a two-step
 * control: the first click opens an inline reason field, because the reason is
 * what the seller sees in their issues queue and an empty one is worse than no
 * rejection at all.
 *
 * The two actions deliberately do NOT look alike. Approve is a raised secondary
 * carrying success ink; reject is a flat ghost that only commits on a second,
 * differently-shaped click. Two identical buttons side by side in a forty-row
 * queue is how the wrong one gets hit — weight, not colour, is what separates
 * them, and it survives both themes.
 *
 * A refusal is never shown as red micro-text in a corner. It is the
 * compare-and-swap notice, because when it appears nothing was written.
 */
export function ProductReviewControls({ productId, onOutcome }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // The empty-reason guard is a property of this field, so it renders on the
  // field (and is announced through aria-describedby). A server refusal is a
  // property of the platform record, so it renders as the notice.
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function approve() {
    setRefusal(null);
    onOutcome?.("pending", "approve");
    startTransition(async () => {
      const result = await approvePendingProduct({ productId });
      if (!result.ok) {
        setRefusal(result.error);
        onOutcome?.("failed", "approve");
        return;
      }
      setDone(result.message ?? "Approved");
      onOutcome?.("committed", "approve");
      router.refresh();
    });
  }

  function reject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setFieldError("A rejection reason is required");
      return;
    }
    setFieldError(null);
    setRefusal(null);
    onOutcome?.("pending", "reject");
    startTransition(async () => {
      const result = await rejectPendingProduct({ productId, reason: trimmed });
      if (!result.ok) {
        // The action returns `field` when the refusal is about the reason that
        // was typed (under three characters, or over a thousand). That belongs
        // on the field: the platform record never disagreed with the click, so
        // showing it as the compare-and-swap notice — and marking the row as
        // contested — would report a conflict that did not happen.
        if (result.field) {
          setFieldError(result.error);
          onOutcome?.("idle", "reject");
          return;
        }
        setRefusal(result.error);
        onOutcome?.("failed", "reject");
        return;
      }
      setDone(result.message ?? "Rejected");
      setRejecting(false);
      onOutcome?.("committed", "reject");
      router.refresh();
    });
  }

  if (done) {
    return (
      <p className="u-meta inline-flex items-center gap-1.5 text-success-ink">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {done}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {rejecting ? (
        // Recessed, because law A reads "recessed = context or input" and this
        // is the one place on the row where something is typed.
        <Surface
          rung={1}
          as="form"
          aria-label="Reject this listing"
          className="w-full max-w-sm space-y-2 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            reject();
          }}
        >
          <Input
            autoFocus
            label="Reason the seller will see"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What has to change before this can be listed"
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
                setRejecting(false);
                setFieldError(null);
                setRefusal(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={pending}>
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Confirm rejection
            </Button>
          </div>
        </Surface>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={approve} loading={pending} className="text-success-ink">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Approve
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="hover:text-danger-ink"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Reject
          </Button>
        </div>
      )}
      {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-sm" />}
    </div>
  );
}
