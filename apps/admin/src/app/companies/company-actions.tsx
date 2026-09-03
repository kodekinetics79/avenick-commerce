"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { Button, Surface } from "@avenick/ui";
import { DecisionNoticeInline } from "@/app/approvals/decision-notice";

interface Props {
  companyId: string;
  /** The company's own name, so the confirm sentence names what is being changed. */
  name: string;
  status: string;
}

/**
 * Activate / verify / suspend a buyer company.
 *
 * The decision is a TWO-STEP control rather than a `window.confirm`. A native
 * confirm dialog is unstyleable, unlocalisable, blocks the whole tab, and — the
 * part that matters in a hundred-row register — it does not tell the operator
 * WHICH row they clicked, because the browser will not put the company's name in
 * it without the developer remembering to. So the confirmation happens in place,
 * on the row, naming the company and stating the consequence.
 *
 * The two steps are also differently SHAPED, not differently coloured: the first
 * click opens a panel, the second commits from inside it. Two identical buttons
 * side by side are how the wrong one gets hit.
 *
 * Presentation only: the same PATCH, the same body, the same response handling.
 * A refusal renders as the compare-and-swap notice, because when it appears
 * nothing was written — not as red micro-text in the corner of a cell.
 */
export function CompanyStatusActions({ companyId, name, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<"ACTIVE" | "SUSPENDED" | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function changeStatus(nextStatus: "ACTIVE" | "SUSPENDED") {
    setPending(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRefusal(json.error ?? "Failed to update status");
        return;
      }
      setConfirming(null);
      router.refresh();
    } catch {
      setRefusal("The platform could not be reached, so nothing was written. Retry when the connection is back.");
    } finally {
      setPending(false);
    }
  }

  const suspending = confirming === "SUSPENDED";
  const activating = status === "PENDING_VERIFICATION" ? "Verify" : "Activate";

  const panelRef = useRef<HTMLElement>(null);
  const promptId = useId();
  useEffect(() => {
    if (confirming) panelRef.current?.focus();
  }, [confirming]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (confirming) void changeStatus(confirming);
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        {/* Recessed: this is the one place on the row where a decision is being
            composed rather than taken, and law A reads "recessed = input".

            It is a real <form> and it TAKES FOCUS when it opens. The trigger
            button unmounts the instant this renders, so without the focus move
            a keyboard operator is dropped back to <body> in the middle of a
            hundred-row register and a screen reader announces nothing at all —
            which is strictly worse than the window.confirm this replaced, since
            a native dialog at least focuses itself. Focus lands on the panel
            rather than on a button, because pre-focusing "Confirm suspension" is
            how a destructive second step gets taken by an Enter that was meant
            for the first. */}
        <Surface
          rung={1}
          as="form"
          ref={panelRef}
          tabIndex={-1}
          aria-labelledby={promptId}
          onSubmit={onSubmit}
          className="w-full max-w-xs space-y-2 p-2.5 text-start outline-none"
        >
          <p id={promptId} className="u-meta text-ink-1">
            {suspending ? (
              <>
                Suspend <span className="font-medium">{name}</span>? Their members lose B2B purchasing immediately.
              </>
            ) : (
              <>
                Mark <span className="font-medium">{name}</span> active and verified? Their members regain B2B
                purchasing immediately.
              </>
            )}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={suspending ? "danger" : "secondary"} size="xs" loading={pending}>
              {suspending ? "Confirm suspension" : `Confirm ${activating.toLowerCase()}`}
            </Button>
          </div>
        </Surface>
        {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-xs" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "ACTIVE" ? (
        <Button type="button" variant="ghost" size="xs" className="hover:text-danger-ink" onClick={() => setConfirming("SUSPENDED")}>
          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
          Suspend<span className="sr-only"> {name}</span>
        </Button>
      ) : (
        <Button type="button" variant="secondary" size="xs" className="text-success-ink" onClick={() => setConfirming("ACTIVE")}>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          {activating}<span className="sr-only"> {name}</span>
        </Button>
      )}
      {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-xs" />}
    </div>
  );
}
