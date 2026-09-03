"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { approvePendingProduct, rejectPendingProduct } from "./actions";

interface Props {
  productId: string;
}

const BTN = "inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Approve / Reject for a listing in PENDING_REVIEW. Reject is a two-step
 * control: the first click opens an inline reason field, because the reason is
 * what the seller sees in their issues queue and an empty one is worse than no
 * rejection at all.
 */
export function ProductReviewControls({ productId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await approvePendingProduct({ productId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.message ?? "Approved");
      router.refresh();
    });
  }

  function reject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A rejection reason is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rejectPendingProduct({ productId, reason: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.message ?? "Rejected");
      setRejecting(false);
      router.refresh();
    });
  }

  if (done) {
    return <span className="text-xs text-muted-foreground">{done}</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {rejecting ? (
        <form
          className="flex flex-wrap items-center gap-2 justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            reject();
          }}
        >
          <input
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason the seller will see"
            maxLength={1000}
            disabled={pending}
            aria-label="Rejection reason"
            className="h-8 w-56 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button type="submit" disabled={pending} className={`${BTN} bg-red-600 text-white hover:bg-red-700`}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} Confirm reject
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setRejecting(false);
              setError(null);
            }}
            className={`${BTN} border border-border text-muted-foreground hover:bg-muted`}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={approve} disabled={pending} className={`${BTN} bg-green-500 text-white hover:bg-green-600`}>
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Approve
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={pending}
            className={`${BTN} border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200`}
          >
            <XCircle className="h-3 w-3" /> Reject
          </button>
        </div>
      )}
      {error && (
        <span role="alert" className="text-[11px] text-red-600 text-right">
          {error}
        </span>
      )}
    </div>
  );
}
