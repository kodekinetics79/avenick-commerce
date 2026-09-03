"use client";

import * as React from "react";
import Link from "next/link";
import { Check, MessageSquare, Minus, Plus, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, CommitBadge, CommitLabel, FieldWell } from "@avenick/ui";

/**
 * THE COMMIT — the one gesture this page exists for, built so that the rollback
 * would be possible before the confirmation was.
 *
 * The button lands first: <Button> carries the 160ms press translate, and the
 * line is already in the cart store by the time anything animates. The
 * confirmation is a READOUT, never a gate — the control stays enabled and a
 * second press simply restarts the acknowledgement from wherever it is.
 *
 * THE LABEL WIPES RATHER THAN FADES. A cross-fade between two strings puts every
 * frame at partial opacity, i.e. unreadable, on the one control the buyer is
 * watching most closely. <CommitLabel> travels a clip-path edge from the inline
 * start with both layers at full opacity throughout.
 *
 * THE DIGIT IS NEVER THE ANIMATED ELEMENT. <CommitBadge> springs the CONTAINER
 * of the confirmation line 1 → 1.18 → 1 and the figure inside is swapped
 * instantly. On a trade platform an animated number is a number you cannot
 * trust. The line's height is reserved whether or not it is showing, so the
 * confirmation never pushes the page out from under the buyer's pointer.
 */
export function BuyActions({
  qty,
  moq,
  maxQty,
  canBuy,
  inStock,
  added,
  addedToken,
  onQty,
  onAdd,
  requestAvailabilityHref,
}: {
  qty: number;
  moq: number;
  maxQty: number;
  /** A resolvable price exists for this selection and quantity. */
  canBuy: boolean;
  inStock: boolean;
  /** The quantity that was actually added, or null. Never a boolean: the
   *  announcement names a figure, and a buyer who nudges the stepper during the
   *  confirmation window would otherwise hear a number never sent to the cart. */
  added: number | null;
  /** Changes on every successful add, so the pulse restarts rather than sticking
   *  at frame zero when a buyer presses four times quickly. */
  addedToken: number;
  onQty: (next: number) => void;
  onAdd: () => void;
  requestAvailabilityHref: string | null;
}) {
  const t = useTranslations("pdp.buy");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Named as a group so the live quantity is not announced as a bare
            number with no idea what it counts, and NOT clipped: the ± buttons
            are flush to the well's edges, so an overflow-hidden here would
            swallow their focus ring. */}
        <FieldWell role="group" aria-label={t("quantityGroup")} className="inline-flex items-center">
          <button
            type="button"
            aria-label={t("decrease")}
            disabled={!canBuy || qty <= moq}
            onClick={() => onQty(Math.max(moq, qty - 1))}
            className="u-focus flex h-control-lg w-11 items-center justify-center text-ink-2 transition-colors duration-press ease-standard hover:text-ink-1 disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          {/* Announced, not animated: a figure a buyer reads never counts up, it
              just changes. */}
          <span
            className="fig min-w-[3rem] text-center u-ui font-medium text-ink-1"
            aria-live="polite"
            aria-atomic="true"
          >
            {qty}
          </span>
          <button
            type="button"
            aria-label={t("increase")}
            disabled={!canBuy || qty >= maxQty}
            onClick={() => onQty(qty + 1)}
            className="u-focus flex h-control-lg w-11 items-center justify-center text-ink-2 transition-colors duration-press ease-standard hover:text-ink-1 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </FieldWell>

        <Button
          size="lg"
          variant="primary"
          className="min-w-[12rem] flex-1"
          disabled={!inStock || !canBuy}
          onClick={onAdd}
        >
          {/* Both icons are laid over one another by the wipe's grid, so the
              control's width is fixed and confirming it cannot reflow the row. */}
          <CommitLabel
            done={added !== null}
            idle={
              <span className="inline-flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                {t("addToCart")}
              </span>
            }
            committed={
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t("added")}
              </span>
            }
          />
        </Button>
      </div>

      {/* The confirmation, in the provenance voice — a record being made, not a
          celebration. Its height is reserved either way. */}
      <p className="flex min-h-[20px] items-center gap-2" aria-hidden="true">
        {added !== null && (
          <CommitBadge pulseKey={addedToken} className="items-center gap-1.5 text-success-ink">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="fig u-meta">{t("announce", { qty: added })}</span>
          </CommitBadge>
        )}
      </p>
      {/* The only announcement a screen reader gets, so it is never duplicated by
          the visible line above. */}
      <p role="status" aria-live="polite" className="sr-only">
        {added !== null ? t("announce", { qty: added }) : ""}
      </p>

      {moq > 1 && <p className="fig u-meta text-ink-2">{t("moqNote", { qty: moq })}</p>}
      {canBuy && inStock && maxQty > 0 && (
        <p className="fig u-meta text-ink-3">{t("availableNote", { qty: maxQty })}</p>
      )}

      {!inStock && requestAvailabilityHref && (
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href={requestAvailabilityHref}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            {t("requestAvailability")}
          </Link>
        </Button>
      )}
    </div>
  );
}
