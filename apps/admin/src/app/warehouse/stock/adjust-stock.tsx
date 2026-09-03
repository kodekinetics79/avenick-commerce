"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { adjustStockAction } from "./actions";

interface Props {
  stockId: string;
  qty: number;
  reservedQty: number;
}

const BTN = "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD = "h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50";

/**
 * Inline on-hand correction for one stock row. The operator enters the new
 * count (not a delta) so the number they type is the number the shelf shows;
 * the service refuses anything below the reserved quantity and records the
 * reason on the movement row.
 */
export function AdjustStock({ stockId, qty, reservedQty }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [newQty, setNewQty] = useState(String(qty));
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
    setNewQty(String(qty));
    setReason("");
    setReference("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = Number(newQty);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError({ message: "On-hand must be a whole number of zero or more", field: "newQty" });
      return;
    }
    if (parsed < reservedQty) {
      setError({ message: `On-hand cannot go below the ${reservedQty} reserved for open orders`, field: "newQty" });
      return;
    }
    if (!reason.trim()) {
      setError({ message: "Say why the count changed", field: "reason" });
      return;
    }
    startTransition(async () => {
      const result = await adjustStockAction({ stockId, newQty: parsed, reason: reason.trim(), reference: reference.trim() || undefined });
      if (!result.ok) {
        setError({ message: result.error, field: result.field });
        return;
      }
      setNotice(result.message ?? "Adjusted");
      close();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1">
          <SlidersHorizontal className="h-3 w-3" /> Adjust
        </button>
        {notice && <span className="text-[11px] text-muted-foreground">{notice}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5 min-w-[14rem]" aria-label="Adjust on-hand quantity">
      <div className="flex items-center gap-1.5">
        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          New on-hand
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            min={reservedQty}
            step={1}
            value={newQty}
            onChange={(event) => setNewQty(event.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "newQty" || undefined}
            className={`${FIELD} w-20 ${error?.field === "newQty" ? "border-red-500" : ""}`}
          />
        </label>
        <button type="button" onClick={close} disabled={pending} aria-label="Cancel adjustment" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (required)"
        maxLength={500}
        disabled={pending}
        aria-label="Adjustment reason"
        aria-invalid={error?.field === "reason" || undefined}
        className={`${FIELD} w-full ${error?.field === "reason" ? "border-red-500" : ""}`}
      />
      <input
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder="Reference, e.g. stocktake sheet (optional)"
        maxLength={120}
        disabled={pending}
        aria-label="Adjustment reference"
        className={`${FIELD} w-full`}
      />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={`${BTN} border-primary bg-primary text-primary-foreground hover:bg-primary/90`}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Save
        </button>
        <span className="text-[11px] text-muted-foreground">{reservedQty} reserved</span>
      </div>
      {error && (
        <span role="alert" className="text-[11px] text-red-600">
          {error.message}
        </span>
      )}
    </form>
  );
}
