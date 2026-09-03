"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { Button, Surface } from "@avenick/ui";
import { useTranslations } from "next-intl";
import { DecisionNoticeInline } from "@/app/approvals/decision-notice";

interface Props {
  userId: string;
  /** The person's own name, so the confirm sentence names who is being changed. */
  name: string;
  status: string;
  isSelf: boolean;
}

/**
 * Suspend or restore a person's access.
 *
 * The confirmation is inline and it NAMES THE PERSON, because a `window.confirm`
 * reading "Suspend this user?" in a twenty-row table tells the operator nothing
 * about which row the click landed on. Signing someone out of the platform is
 * not a decision to take against an unnamed pronoun.
 *
 * Presentation only: the same PATCH, the same body, the same response handling.
 * A refusal renders as the compare-and-swap notice.
 */
export function UserStatusActions({ userId, name, status, isSelf }: Props) {
  const t = useTranslations("adminShell.users.actions");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  // Every hook runs before the first early return. React identifies hooks by
  // call order, so a `return` above one makes the order differ between renders
  // — and the row that renders the self-account notice would desynchronise the
  // hook state of every row after it in the table.
  const panelRef = useRef<HTMLElement>(null);
  const promptId = useId();
  useEffect(() => {
    if (confirming) panelRef.current?.focus();
  }, [confirming]);

  // The operator's own row carries a stated reason rather than a bare dash: a
  // missing control with no explanation reads as a bug.
  if (isSelf) return <span className="u-meta text-ink-3">{t("ownAccount")}</span>;

  const suspending = status === "ACTIVE";
  const nextStatus = suspending ? "SUSPENDED" : "ACTIVE";

  async function changeStatus() {
    setPending(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setRefusal(json.error ?? t("updateFailed"));
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setRefusal(t("networkFailure"));
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        {/* A real <form>, and it TAKES FOCUS when it opens. The trigger button
            unmounts the instant this renders, so without the focus move a
            keyboard operator is dropped back to <body> halfway down a register
            and a screen reader announces nothing — strictly worse than the
            window.confirm this replaced, which at least focused itself. Focus
            lands on the panel, not on the confirmSuspension button: pre-focusing
            the destructive step is how it gets taken by an Enter meant for the
            first click. */}
        <Surface
          rung={1}
          as="form"
          ref={panelRef}
          tabIndex={-1}
          aria-labelledby={promptId}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void changeStatus();
          }}
          className="w-full max-w-xs space-y-2 p-2.5 text-start outline-none"
        >
          <p id={promptId} className="u-meta text-ink-1">
            {/* t.rich, so the person's name keeps the emphasis that makes the
                confirmation name WHICH row the click landed on. */}
            {t.rich(suspending ? "confirmSuspend" : "confirmRestore", {
              name,
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" variant={suspending ? "danger" : "secondary"} size="xs" loading={pending}>
              {suspending ? t("confirmSuspension") : t("confirmRestoration")}
            </Button>
          </div>
        </Surface>
        {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-xs" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant={suspending ? "ghost" : "secondary"}
        size="xs"
        className={suspending ? "hover:text-danger-ink" : "text-success-ink"}
        onClick={() => setConfirming(true)}
      >
        {suspending ? <Ban className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {suspending ? t("suspend") : t("restore")}
        <span className="sr-only"> {name}</span>
      </Button>
      {refusal && <DecisionNoticeInline message={refusal} className="w-full max-w-xs" />}
    </div>
  );
}
