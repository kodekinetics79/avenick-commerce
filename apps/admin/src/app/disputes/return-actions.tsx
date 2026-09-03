"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Banknote } from "lucide-react";
import { Button, Input, Surface, Textarea } from "@avenick/ui";
import { DecisionNoticeInline } from "@/app/approvals/decision-notice";

interface Props {
  returnId: string;
  returnNumber: string;
  status: string;
  /** The most a refund may be, already resolved by the caller. */
  orderTotal: number;
  /** The order's own currency, so the amount field is never an unlabelled number. */
  currency: string;
}

type Mode = "approve" | "reject" | "refund";

/**
 * Approve, reject or record a refund against a return request.
 *
 * Round one drove all three through `window.prompt` — including the refund,
 * where an operator typed a MONEY AMOUNT and a bank reference into two
 * consecutive native dialogs. A native prompt cannot show the currency, cannot
 * show the maximum, cannot show which return is being refunded, cannot be
 * validated as you type, cannot be recovered from if the second dialog is
 * cancelled after the first was filled, and is unstyleable and unlocalisable.
 * On a financial action that is not a shortcut, it is a hazard.
 *
 * So each decision opens an inline, recessed panel on the row: it names the
 * return, states the consequence, shows the ceiling on the refund, and keeps
 * both fields on screen together. PRESENTATION ONLY — the same PATCH, the same
 * body, the same guards, the same response handling. The server re-validates
 * every one of these; nothing here is the authority on any of it.
 */
export function ReturnActions({ returnId, returnNumber, status, orderTotal, currency }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [resolution, setResolution] = useState("");
  const [amount, setAmount] = useState(orderTotal.toFixed(2));
  const [reference, setReference] = useState("");
  // A refusal about what was TYPED belongs on the field. A refusal from the
  // platform belongs in the compare-and-swap notice, because when that one
  // appears nothing was written.
  const [fieldError, setFieldError] = useState<{ on: "amount" | "reference" | "resolution"; message: string } | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  function close() {
    setMode(null);
    setFieldError(null);
    setRefusal(null);
  }

  async function transition(
    nextStatus: string,
    opts?: { resolution?: string; refundAmount?: number; refundReference?: string },
  ) {
    setPending(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, ...opts }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRefusal(json.error ?? "Failed to update return");
        return;
      }
      close();
      router.refresh();
    } catch {
      setRefusal("The platform could not be reached, so nothing was written. Retry when the connection is back.");
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    if (mode === "approve") {
      void transition("APPROVED", { resolution: resolution.trim() || undefined });
      return;
    }
    if (mode === "reject") {
      const trimmed = resolution.trim();
      if (!trimmed) {
        setFieldError({ on: "resolution", message: "A reason is required — the buyer is shown it." });
        return;
      }
      void transition("REJECTED", { resolution: trimmed });
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFieldError({ on: "amount", message: "Enter a refund amount greater than zero." });
      return;
    }
    if (value > orderTotal) {
      setFieldError({ on: "amount", message: `The refund cannot exceed ${orderTotal.toFixed(2)} ${currency}.` });
      return;
    }
    if (reference.trim().length < 3) {
      setFieldError({ on: "reference", message: "Enter the gateway or bank reference the refund was issued under." });
      return;
    }
    void transition("REFUNDED", { refundAmount: value, refundReference: reference.trim() });
  }

  if (mode) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Surface rung={1} as="form" onSubmit={submit} aria-label={`${mode} return ${returnNumber}`} className="w-full max-w-sm space-y-2 p-3 text-start">
          {mode === "refund" ? (
            <>
              {/* The warning is stated ONCE, at the top of the panel, in body ink
                  rather than as fine print: recording a refund the bank has not
                  actually issued is the one mistake this control can cause. */}
              <p className="u-meta text-ink-1">
                Record a refund against <span className="u-mono">{returnNumber}</span> only after the gateway or bank
                refund has succeeded. This writes the platform&apos;s record of money already returned; it does not move
                any.
              </p>
              <Input
                autoFocus
                label={`Refund amount (${currency})`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={pending}
                hint={`At most ${orderTotal.toFixed(2)} ${currency}.`}
                error={fieldError?.on === "amount" ? fieldError.message : undefined}
              />
              <Input
                label="Gateway or bank reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="The reference the refund was issued under"
                disabled={pending}
                error={fieldError?.on === "reference" ? fieldError.message : undefined}
              />
            </>
          ) : (
            <>
              <p className="u-meta text-ink-1">
                {mode === "approve" ? (
                  <>Approve return <span className="u-mono">{returnNumber}</span>? The buyer is told to send the goods back.</>
                ) : (
                  <>Reject return <span className="u-mono">{returnNumber}</span>? The reason below is shown to the buyer.</>
                )}
              </p>
              <div>
                <label htmlFor={`resolution-${returnId}`} className="u-ui mb-1.5 block font-medium text-ink-1">
                  {mode === "approve" ? "Resolution note (optional)" : "Reason the buyer will see"}
                </label>
                <Textarea
                  id={`resolution-${returnId}`}
                  autoFocus
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  maxLength={1000}
                  disabled={pending}
                  aria-describedby={fieldError?.on === "resolution" ? `resolution-${returnId}-msg` : undefined}
                  aria-invalid={fieldError?.on === "resolution" ? true : undefined}
                  className="min-h-[72px]"
                />
                {fieldError?.on === "resolution" && (
                  <p id={`resolution-${returnId}-msg`} className="u-meta mt-1 text-danger-ink">
                    {fieldError.message}
                  </p>
                )}
              </div>
            </>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant={mode === "reject" ? "danger" : "secondary"} size="xs" loading={pending}>
              {mode === "approve" ? "Confirm approval" : mode === "reject" ? "Confirm rejection" : "Record the refund"}
            </Button>
          </div>
        </Surface>
        {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-sm" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {status === "REQUESTED" && (
          <>
            <Button type="button" variant="secondary" size="xs" className="text-success-ink" onClick={() => setMode("approve")}>
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Approve
              <span className="sr-only"> return {returnNumber}</span>
            </Button>
            <Button type="button" variant="ghost" size="xs" className="hover:text-danger-ink" onClick={() => setMode("reject")}>
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Reject
              <span className="sr-only"> return {returnNumber}</span>
            </Button>
          </>
        )}
        {(status === "APPROVED" || status === "RECEIVED") && (
          <Button type="button" variant="secondary" size="xs" onClick={() => setMode("refund")}>
            <Banknote className="h-3.5 w-3.5" aria-hidden="true" /> Record refund
            <span className="sr-only"> for return {returnNumber}</span>
          </Button>
        )}
        {(status === "REJECTED" || status === "REFUNDED" || status === "IN_TRANSIT") && (
          // Not an em dash. A closed return has no decision left to take, and
          // saying so is a fact; a dash is a shrug that reads as a bug.
          <span className="u-meta text-ink-3">
            {status === "IN_TRANSIT" ? "Awaiting the goods" : "Settled"}
          </span>
        )}
      </div>
      {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-sm" />}
    </div>
  );
}
