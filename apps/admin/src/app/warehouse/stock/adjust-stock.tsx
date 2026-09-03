"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Button, Eyebrow } from "@avenick/ui";
import { CONTROL_SM } from "@/components/console/chrome";
import { adjustStockAction } from "./actions";

interface Props {
  stockId: string;
  qty: number;
  reservedQty: number;
}

/**
 * Inline on-hand correction for one stock row. The operator enters the new
 * count (not a delta) so the number they type is the number the shelf shows;
 * the service refuses anything below the reserved quantity and records the
 * reason on the movement row.
 */
export function AdjustStock({ stockId, qty, reservedQty }: Props) {
  const router = useRouter();
  const t = useTranslations("adminCommerce.stockAdjust");
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
      setError({ message: t("wholeNumber"), field: "newQty" });
      return;
    }
    if (parsed < reservedQty) {
      setError({ message: t("belowReserved", { reserved: String(reservedQty) }), field: "newQty" });
      return;
    }
    if (!reason.trim()) {
      setError({ message: t("reasonRequired"), field: "reason" });
      return;
    }
    startTransition(async () => {
      const result = await adjustStockAction({ stockId, newQty: parsed, reason: reason.trim(), reference: reference.trim() || undefined });
      if (!result.ok) {
        setError({ message: result.error, field: result.field });
        return;
      }
      setNotice(result.message ?? t("adjusted"));
      close();
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <Button type="button" variant="link" size="xs" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="h-3 w-3" aria-hidden="true" /> {t("open")}
        </Button>
        {notice && (
          <span role="status" className="u-meta text-success-ink">
            {notice}
          </span>
        )}
      </div>
    );
  }

  return (
    // The whole correction is one recessed well: it is all input, and it sits
    // visibly inside the row rather than floating over it.
    <form
      onSubmit={submit}
      data-rung={1}
      className="flex min-w-[15rem] flex-col gap-1.5 border border-border p-2 text-start"
      aria-label={t("formLabel")}
    >
      <div className="flex items-start justify-between gap-2">
        <label className="u-meta flex items-center gap-1.5 text-ink-2">
          {t("newOnHand")}
          <input
            data-rung={1}
            autoFocus
            type="number"
            inputMode="numeric"
            min={reservedQty}
            step={1}
            value={newQty}
            onChange={(event) => setNewQty(event.target.value)}
            disabled={pending}
            aria-invalid={error?.field === "newQty" || undefined}
            className={`${CONTROL_SM} fig w-20 text-end ${error?.field === "newQty" ? "border-danger" : ""}`}
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={close}
          disabled={pending}
          aria-label={t("cancel")}
          className="px-1"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
      <input
        data-rung={1}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder={t("reasonPlaceholder")}
        maxLength={500}
        disabled={pending}
        aria-label={t("reasonLabel")}
        aria-invalid={error?.field === "reason" || undefined}
        className={`${CONTROL_SM} ${error?.field === "reason" ? "border-danger" : ""}`}
      />
      <input
        data-rung={1}
        value={reference}
        onChange={(event) => setReference(event.target.value)}
        placeholder={t("referencePlaceholder")}
        maxLength={120}
        disabled={pending}
        aria-label={t("referenceLabel")}
        className={CONTROL_SM}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="xs" loading={pending} disabled={pending}>
          {t("save")}
        </Button>
        {/* The floor the service enforces, stated where the number is typed. */}
        <Eyebrow>{t("reservedNote", { count: String(reservedQty) })}</Eyebrow>
      </div>
      {error && (
        <span role="alert" className="u-meta text-danger-ink">
          {error.message}
        </span>
      )}
    </form>
  );
}
