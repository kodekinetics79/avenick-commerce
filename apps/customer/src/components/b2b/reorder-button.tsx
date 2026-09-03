"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@avenick/ui";
import { useCartStore } from "@/stores/cart";
import { canonicalRequisitionCartLines } from "@/lib/requisition-reprice";
import { useB2BT } from "./use-b2b-t";

type Item = {
  productId: string;
  sku: string;
  nameEn: string;
  qty: number;
};

/**
 * Reorder a saved requisition list.
 *
 * The repricing call and its two failure branches are unchanged: nothing is
 * added to the cart unless the server hands back a canonical line for every
 * item. What changed is how a failure is reported.
 *
 * It used to be `alert()`. A native alert is modal, unstyled, untranslatable in
 * practice, dismissed before it can be read, and on a list of eight cards it
 * gives no clue WHICH card failed. The reason is now stated in the card that
 * produced it, with `role="alert"` so it is announced, and the button reports
 * that it is working while the round trip is in flight — a control that looks
 * identical before and during a network call is a control people press twice.
 */
export function ReorderButton({ items }: { items: Item[] }) {
  const t = useB2BT();
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function reorder() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/b2b/requisition-lists/reprice", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: items.map(({ productId, qty }) => ({ productId, quantity: qty })) }),
      });
      const body = await response.json();
      if (!response.ok || !body.success || !Array.isArray(body.data?.lines)) {
        // The server's own reason where it gave one; it is more actionable than
        // anything written here could be.
        setError(typeof body.error === "string" && body.error ? body.error : t("lists.reorder.failed"));
        return;
      }
      let lines;
      try {
        lines = canonicalRequisitionCartLines(items.length, body.data);
      } catch {
        setError(t("lists.reorder.incomplete"));
        return;
      }
      for (const line of lines) addItem(line);
      router.push("/cart");
    } catch {
      setError(t("lists.reorder.failed"));
    } finally {
      setPending(false);
    }
  }

  const reorderable = items.length > 0;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={reorder}
        disabled={!reorderable}
        loading={pending}
        // A `title` is not announced by most screen readers and never appears on
        // touch, so the reason a disabled control is disabled is given as its
        // accessible name rather than only as a tooltip.
        aria-label={reorderable ? t("lists.reorder.enabled") : t("lists.reorder.disabled")}
        title={reorderable ? t("lists.reorder.enabled") : t("lists.reorder.disabled")}
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t("lists.reorder")}
      </Button>
      {error && (
        <p role="alert" className="u-meta flex items-start gap-1.5 text-end text-danger-ink">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
