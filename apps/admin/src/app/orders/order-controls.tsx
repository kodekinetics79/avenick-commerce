"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Truck, Navigation, CheckCircle, Ban, MessageSquare, Loader2 } from "lucide-react";
import { addOrderNoteAction, advanceOrderAction, cancelOrderAction } from "./actions";

type Target = "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";

interface Props {
  orderId: string;
  status: string;
  paymentStatus: string;
  /** Placed from a governed B2B purchase order; the service refuses to cancel these. */
  governed?: boolean;
  /** "row" renders only the next fulfilment step; "detail" renders everything. */
  variant: "row" | "detail";
}

interface Step {
  to: Target;
  label: string;
  icon: typeof Package;
  className: string;
}

/**
 * The next step(s) an operator may take from a given order status. Mirrors the
 * chain in adminAdvanceOrder; the service is the authority and refuses
 * anything else, this map only decides which buttons to draw.
 */
const NEXT_STEPS: Record<string, Step[]> = {
  CONFIRMED: [{ to: "PROCESSING", label: "Mark as Processing", icon: Package, className: "bg-purple-600 text-white hover:bg-purple-700" }],
  PROCESSING: [{ to: "SHIPPED", label: "Mark as Shipped", icon: Truck, className: "bg-cyan-600 text-white hover:bg-cyan-700" }],
  SHIPPED: [
    { to: "OUT_FOR_DELIVERY", label: "Out for Delivery", icon: Navigation, className: "bg-amber-600 text-white hover:bg-amber-700" },
    { to: "DELIVERED", label: "Mark as Delivered", icon: CheckCircle, className: "bg-green-600 text-white hover:bg-green-700" },
  ],
  OUT_FOR_DELIVERY: [{ to: "DELIVERED", label: "Mark as Delivered", icon: CheckCircle, className: "bg-green-600 text-white hover:bg-green-700" }],
};

const CANCELLABLE = new Set(["PENDING_PAYMENT", "PAYMENT_CONFIRMED"]);
const CLOSED = new Set(["CANCELLED", "REFUNDED", "RETURNED", "DELIVERED"]);

const BTN = "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD = "h-8 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50";

export function OrderControls({ orderId, status, paymentStatus, governed = false, variant }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<null | { kind: "advance"; step: Step } | { kind: "cancel" } | { kind: "note" }>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const steps = NEXT_STEPS[status] ?? [];
  const unpaid = paymentStatus === "UNPAID" || paymentStatus === "FAILED";
  const cancellable = CANCELLABLE.has(status) && unpaid && !governed;
  const cancelBlockedReason = cancellable
    ? null
    : governed && CANCELLABLE.has(status) && unpaid
      ? "This order was placed from a governed purchase order; nothing can return that purchase order to an orderable state, so it cannot be cancelled here."
      : "Cancellation after payment is handled through Returns.";

  function run(work: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(result.message ?? "Done");
      setPanel(null);
      setText("");
      router.refresh();
    });
  }

  function advance(step: Step, message?: string) {
    run(() => advanceOrderAction({ orderId, to: step.to, expectedFrom: status, message }));
  }

  if (variant === "row") {
    const step = steps[0];
    if (!step) return null;
    const Icon = step.icon;
    return (
      <div className="flex flex-col gap-1">
        <button type="button" disabled={pending} onClick={() => advance(step)} className={`${BTN} px-2 py-0.5 ${step.className}`}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />} {step.to === "PROCESSING" ? "Process" : "Ship"}
        </button>
        {error && <span role="alert" className="text-[11px] text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.to}
              type="button"
              disabled={pending}
              onClick={() => setPanel({ kind: "advance", step })}
              className={`${BTN} ${step.className}`}
            >
              <Icon className="h-3.5 w-3.5" /> {step.label}
            </button>
          );
        })}
        {!CLOSED.has(status) && (
          <span className="inline-flex flex-col">
            <button
              type="button"
              disabled={pending || !cancellable}
              onClick={() => setPanel({ kind: "cancel" })}
              className={`${BTN} border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10`}
              title={cancelBlockedReason ?? undefined}
            >
              <Ban className="h-3.5 w-3.5" /> Cancel Order
            </button>
          </span>
        )}
        <button type="button" disabled={pending} onClick={() => setPanel({ kind: "note" })} className={`${BTN} border border-border text-muted-foreground hover:bg-muted`}>
          <MessageSquare className="h-3.5 w-3.5" /> Add internal note
        </button>
      </div>
      {!CLOSED.has(status) && cancelBlockedReason && (
        <p className="text-xs text-muted-foreground">{cancelBlockedReason}</p>
      )}

      {panel?.kind === "advance" && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-background p-3"
          onSubmit={(event) => {
            event.preventDefault();
            advance(panel.step, text.trim() || undefined);
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground flex-1 min-w-[16rem]">
            Message shown to the customer (optional)
            <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} disabled={pending} className={FIELD} />
          </label>
          <button type="submit" disabled={pending} className={`${BTN} ${panel.step.className}`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Confirm: {panel.step.label}
          </button>
          <button type="button" disabled={pending} onClick={() => setPanel(null)} className={`${BTN} border border-border text-muted-foreground hover:bg-muted`}>
            Back
          </button>
        </form>
      )}

      {panel?.kind === "cancel" && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => cancelOrderAction({ orderId, expectedFrom: status, reason: text }));
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground flex-1 min-w-[16rem]">
            Reason (shown to the customer)
            <input autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={500} required disabled={pending} className={FIELD} />
          </label>
          <button type="submit" disabled={pending} className={`${BTN} bg-red-600 text-white hover:bg-red-700`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Confirm cancellation
          </button>
          <button type="button" disabled={pending} onClick={() => setPanel(null)} className={`${BTN} border border-border text-muted-foreground hover:bg-muted`}>
            Back
          </button>
        </form>
      )}

      {panel?.kind === "note" && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-background p-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => addOrderNoteAction({ orderId, note: text }));
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground flex-1 min-w-[16rem]">
            Internal note (staff only; the customer never sees it)
            <textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={2} required disabled={pending} className={`${FIELD} h-auto py-1.5`} />
          </label>
          <button type="submit" disabled={pending} className={`${BTN} bg-primary text-primary-foreground hover:bg-primary/90`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Save note
          </button>
          <button type="button" disabled={pending} onClick={() => setPanel(null)} className={`${BTN} border border-border text-muted-foreground hover:bg-muted`}>
            Back
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </div>
  );
}
