"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Package, Truck, Navigation, CheckCircle, Ban, MessageSquare } from "lucide-react";
import { Button, FieldWell, Surface } from "@avenick/ui";
import { CONTROL, CONTROL_SM } from "@/components/console/chrome";
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
  /**
   * `label` is the sentence on the detail control and `short` the verb on the
   * compact row control, where there is no room for it; both are translated
   * from `adminCommerce.orderControls.steps.<to>`.
   */
  icon: typeof Package;
}

/**
 * The next step(s) an operator may take from a given order status. Mirrors the
 * chain in adminAdvanceOrder; the service is the authority and refuses
 * anything else, this map only decides which buttons to draw.
 *
 * These carried four saturated fills — purple, cyan, amber, green — one per
 * step, which taught the operator nothing except that the buttons were
 * different. They are all the same kind of act (advance this order one notch),
 * so they are all the same control; the step is named on the button.
 */
const NEXT_STEPS: Record<string, Step[]> = {
  CONFIRMED: [{ to: "PROCESSING", icon: Package }],
  PROCESSING: [{ to: "SHIPPED", icon: Truck }],
  SHIPPED: [
    { to: "OUT_FOR_DELIVERY", icon: Navigation },
    { to: "DELIVERED", icon: CheckCircle },
  ],
  OUT_FOR_DELIVERY: [{ to: "DELIVERED", icon: CheckCircle }],
};

const CANCELLABLE = new Set(["PENDING_PAYMENT", "PAYMENT_CONFIRMED"]);
const CLOSED = new Set(["CANCELLED", "REFUNDED", "RETURNED", "DELIVERED"]);

export function OrderControls({ orderId, status, paymentStatus, governed = false, variant }: Props) {
  const router = useRouter();
  const t = useTranslations("adminCommerce.orderControls");
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<null | { kind: "advance"; step: Step } | { kind: "cancel" } | { kind: "note" }>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const blockedId = useId();

  const steps = NEXT_STEPS[status] ?? [];
  const unpaid = paymentStatus === "UNPAID" || paymentStatus === "FAILED";
  const cancellable = CANCELLABLE.has(status) && unpaid && !governed;
  const cancelBlockedReason = cancellable
    ? null
    : governed && CANCELLABLE.has(status) && unpaid
      ? t("cancelBlocked.governed")
      : t("cancelBlocked.afterPayment");

  function run(work: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(result.message ?? t("done"));
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
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="secondary"
          size="xs"
          loading={pending}
          disabled={pending}
          onClick={() => advance(step)}
          title={t(`steps.${step.to}.label`)}
        >
          {!pending && <Icon className="h-3 w-3" aria-hidden="true" />} {t(`steps.${step.to}.short`)}
        </Button>
        {error && (
          <span role="alert" className="u-meta text-end text-danger-ink">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Button
              key={step.to}
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => setPanel({ kind: "advance", step })}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {t(`steps.${step.to}.label`)}
            </Button>
          );
        })}
        {!CLOSED.has(status) && (
          // Disabled controls are not reachable by a screen reader, and a title
          // attribute on one is announced by almost nothing — so the reason a
          // cancellation is refused is a real sentence below, and this button
          // points at it rather than hiding it in a tooltip.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-danger-ink hover:bg-danger-soft"
            disabled={pending || !cancellable}
            onClick={() => setPanel({ kind: "cancel" })}
            aria-describedby={cancelBlockedReason ? blockedId : undefined}
          >
            <Ban className="h-3.5 w-3.5" aria-hidden="true" /> {t("cancelOrder")}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setPanel({ kind: "note" })}>
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {t("addNote")}
        </Button>
      </div>
      {!CLOSED.has(status) && cancelBlockedReason && (
        <p id={blockedId} className="u-meta max-w-prose text-ink-2">{cancelBlockedReason}</p>
      )}

      {panel?.kind === "advance" && (
        <FieldWell
          as="form"
          className="flex flex-wrap items-end gap-2 p-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            advance(panel.step, text.trim() || undefined);
          }}
        >
          <label className="u-meta flex min-w-[16rem] flex-1 flex-col gap-1 text-ink-2">
            {t("messageLabel")}
            <input
              data-rung={1}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={500}
              disabled={pending}
              className={CONTROL_SM}
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={pending}>
            {t("confirmStep", { step: t(`steps.${panel.step.to}.label`) })}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setPanel(null)}>
            {t("back")}
          </Button>
        </FieldWell>
      )}

      {panel?.kind === "cancel" && (
        // An irreversible act gets a toned surface of its own, so the operator
        // cannot mistake this panel for the fulfilment panel above it.
        <Surface
          as="form"
          rung={1}
          tone="danger"
          className="flex flex-wrap items-end gap-2 p-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            run(() => cancelOrderAction({ orderId, expectedFrom: status, reason: text }));
          }}
        >
          <p className="u-meta w-full text-danger-ink">
            {t("cancelWarning")}
          </p>
          <label className="u-meta flex min-w-[16rem] flex-1 flex-col gap-1 text-ink-2">
            {t("reasonLabel")}
            <input
              data-rung={1}
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={500}
              required
              disabled={pending}
              className={CONTROL_SM}
            />
          </label>
          <Button type="submit" variant="destructive" size="sm" loading={pending} disabled={pending}>
            {!pending && <Ban className="h-3.5 w-3.5" aria-hidden="true" />} {t("confirmCancellation")}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setPanel(null)}>
            {t("back")}
          </Button>
        </Surface>
      )}

      {panel?.kind === "note" && (
        <FieldWell
          as="form"
          className="flex flex-wrap items-end gap-2 p-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            run(() => addOrderNoteAction({ orderId, note: text }));
          }}
        >
          <label className="u-meta flex min-w-[16rem] flex-1 flex-col gap-1 text-ink-2">
            {t("noteLabel")}
            <textarea
              data-rung={1}
              autoFocus
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={2000}
              rows={2}
              required
              disabled={pending}
              className={`${CONTROL} h-auto py-1.5`}
            />
          </label>
          <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={pending}>
            {!pending && <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />} {t("saveNote")}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setPanel(null)}>
            {t("back")}
          </Button>
        </FieldWell>
      )}

      {error && (
        <p role="alert" className="u-ui text-danger-ink">
          {error}
        </p>
      )}
      {notice && <p role="status" className="u-ui text-success-ink">{notice}</p>}
    </div>
  );
}
