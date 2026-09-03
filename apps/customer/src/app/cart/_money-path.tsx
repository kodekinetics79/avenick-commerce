/**
 * THE MONEY PATH — the shared presentation for cart, checkout, confirmation and
 * the order record.
 *
 * These four surfaces are one sequence, not four pages: a buyer assembles a
 * cart, walks a short finite checkout, receives a record, and comes back to
 * read that record later. Round one gave each of them its own summary block,
 * its own total treatment and its own idea of how a line looks, so the sequence
 * read as four unrelated screens that happened to share a colour palette. The
 * objects below are what make it one product — one Receipt, one line frame, one
 * total rank, in every one of the four.
 *
 * WHY THIS FILE LIVES UNDER app/cart RATHER THAN IN packages/ui: this round's
 * file ownership is disjoint per track, and the money path owns exactly
 * cart/, checkout/, wishlist/ and orders/. It belongs in packages/ui as
 * <Receipt> and it should move there the moment one commit can touch both — the
 * cross-track note in the handover says so. Nothing here is money-path-specific
 * except the copy the callers pass in.
 *
 * NO "use client" DIRECTIVE, deliberately (LAW 9). `copyFrom` is a callable
 * helper and the order record is a Server Component; a helper exported from a
 * client module becomes a client reference in the server graph and fails the
 * production build with a minified TypeError naming no file.
 */

import * as React from "react";
import { Dateline, Eyebrow, FieldWell, ImageFrame, Num, Surface } from "@avenick/ui";
import { cn } from "@avenick/utils";

/* ── COPY ──────────────────────────────────────────────────────────────────
   Every user-visible string on the money path comes from the next-intl tree.

   The tree itself (apps/customer/messages/{en,ar}.json) is not owned by this
   track, so the keys these four surfaces need are requested rather than added,
   and this accessor is what makes the request safe to ship ahead of the answer:
   `t.has()` is checked first, so a key the tree does not carry yet renders its
   English source string instead of rendering the literal key path in front of a
   buyer. It is a bridge, not a home. Once the keys land, every fallback here is
   dead code and the second argument can be deleted mechanically.

   It is NOT a place to add new copy. A string that exists only as a fallback
   here is a string that will never be translated. */
export type Copy = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>,
) => string;

/** The shape of a next-intl translator, narrowed so this module needs no
 *  next-intl import and stays usable from both sides of the RSC boundary. */
type Translator = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};

export function copyFrom(translator: unknown): Copy {
  const t = translator as Translator;
  return (key, fallback, values) => {
    try {
      return t.has(key) ? t(key, values) : fallback;
    } catch {
      return fallback;
    }
  };
}

/* ── THE LEDGER ROW ────────────────────────────────────────────────────────
   One label and one figure, baseline-aligned, the figure tabular and at the
   inline end so a column of them aligns down the column. `tone="credit"` is for
   a value that reduces the total — a discount — and it is the only coloured
   figure permitted here: money is ink, and the one exception is money moving
   the other way. */
export interface MoneyRowProps {
  label: string;
  value: string;
  tone?: "default" | "credit";
  /** A second, quieter line beneath the label, e.g. "5% on AED 1,200.00". */
  note?: string;
}

export function MoneyRow({ label, value, tone = "default", note }: MoneyRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="u-ui block text-ink-2">{label}</span>
        {note && <span className="u-meta block text-ink-3">{note}</span>}
      </span>
      {/* `u-ui`, not `text-ui`. Both set the same rank, but `cn` is
          tailwind-merge and it classifies every unrecognised `text-*` value as a
          COLOUR: `text-ui` and `text-ink-1` land in one group and the last one
          wins, so `text-ui` was being dropped and the breakdown figures were
          rendering at body rank against a `u-ui` label beside them. The type
          utilities are the safe form here and they carry the RTL and portal
          tokens as well. */}
      <span
        className={cn(
          "fig u-ui shrink-0",
          tone === "credit" ? "text-success-ink" : "text-ink-1",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ── THE RECEIPT ───────────────────────────────────────────────────────────
   The money path's signature object, and the answer to "the total is
   unmistakable".

   Round one put the total in a 30px figure inside a small aside, one rank above
   the subtotal it sat beneath — two adjacent ranks separated by size alone,
   which by the seven-levers rule means they were the same rank. Here the total
   is separated from the breakdown above it by SIX levers at once: size (46px
   against 13px), weight (700 against 400), family (tabular figures), colour,
   case (a micro-caps label rather than a sentence), and space-before. Blur the
   page until no word is legible and you can still tell which number is the one
   that matters. That is the whole test.

   The plate carries the ruled ground and the grain — the same ruling as the
   ambient field, at the same line-height, so a receipt reads as a page torn out
   of the register rather than as a box. Budget: it is one of at most three
   ruled/grained elements per viewport, and the money path never renders two.

   The brass hairline across its top edge is `.u-drawn` at data-on, i.e. THE
   SAME GESTURE as active nav, the certificate's top edge, the quantity ladder's
   active band and the reading-progress rule. One gesture in different postures
   is what makes a system read as designed rather than assembled. */
export interface ReceiptProps {
  /** Micro-caps heading, e.g. "Order summary". */
  eyebrow: string;
  /** <MoneyRow> children — the breakdown that adds up to the total. */
  children?: React.ReactNode;
  /** Micro-caps label above the figure, e.g. "Total" or "Estimate". */
  totalLabel: string;
  /** The formatted total, currency mark included. Never a number. */
  totalValue: string;
  /** LAW E. What this figure is and is not — provenance, never a promise. */
  note?: string;
  /** Actions and alerts, below the total. */
  footer?: React.ReactNode;
  /** Rendered between the eyebrow and the breakdown, e.g. a destination pill. */
  lede?: React.ReactNode;
  className?: string;
  /** Element type. The order record renders it inside a <section>. */
  as?: React.ElementType;
}

export function Receipt({
  eyebrow,
  children,
  totalLabel,
  totalValue,
  note,
  footer,
  lede,
  className,
  as,
}: ReceiptProps) {
  return (
    <Surface rung={2} as={as ?? "div"} className={cn("overflow-hidden", className)}>
      {/* The ruling and the grain are ::before / ::after on this element, so the
          content sits in its own positioned layer above them. Without the
          explicit z-index the ruling paints over the figures, which is exactly
          the "ruled-paper homework" failure the ruling is masked to avoid. */}
      <div data-rule-ground="" data-grain="" className="p-5 sm:p-6">
        <div className="relative z-10">
          <div className="u-drawn w-14" data-on="true" aria-hidden="true" />

          <Eyebrow as="h2" className="mt-3">
            {eyebrow}
          </Eyebrow>

          {lede}

          {children && (
            /* Recessed: the breakdown is the context you read on the way to the
               total, never something you act on. LAW A. */
            <FieldWell className="mt-4 divide-y divide-hairline px-4 py-2">{children}</FieldWell>
          )}

          <div className="mt-5 border-t-2 border-border-strong pt-4">
            <p className="u-micro text-ink-3">{totalLabel}</p>
            {/* rank="hero" is 46px against a 13px label — a 3.5× ratio where the
                rest of the page runs at 1.5×. The DIGITS ARE NEVER ANIMATED and
                <Num> is the structural guarantee of that: on a trade platform
                every intermediate frame of a ticking total is a financial value
                that is false.

                It steps down to section rank below 640px. A five-figure total at
                46px is about 325px of tabular digits and the receipt is 318px
                wide inside its padding on a 390px phone — and this Surface
                clips, so the alternative to stepping down is a total with its
                last digits cut off, which is the one thing a money figure may
                never be. */}
            <Num rank="hero" value={totalValue} className="mt-1 block text-fig-section sm:text-fig-hero" />
            {note && <Dateline className="mt-2">{note}</Dateline>}
          </div>

          {footer}
        </div>
      </div>
    </Surface>
  );
}

/* ── THE LINE FRAME ────────────────────────────────────────────────────────
   Every product image on the money path goes through <ImageFrame>: the cart
   line, the wishlist tile, the checkout review line. Same plate, same cast
   floor, same overhead light, same 4:5 portrait, same 9% inset, and the same
   DESIGNED no-image state — the frame with a mark and the SKU in mono, which
   occupies the identical box so a list mixing presence and absence has no
   ragged baseline.

   object-fit: contain is the non-negotiable. Cover crops the valve off a
   fitting and the label off a drum, and one frame with cover in a row of nine
   with contain is worse than nine with cover, because it announces that the
   system is not actually a system. */
export interface LineFrameProps {
  /** Tailwind width for the frame, e.g. "w-20". The height follows the ratio. */
  width?: string;
  sku?: string;
  /** `out` desaturates; it never scrims. */
  state?: "available" | "out" | "unconfirmed";
  /**
   * `nested` is a line's own corner, concentric with the row it sits in.
   * `none` is for a frame that is FLUSH with the edge of the card holding it —
   * the wishlist tile — where a radius would leave a sliver of card showing
   * above the photograph.
   *
   * It is a prop rather than a class the caller passes, because `cn` is
   * tailwind-merge and tailwind-merge does not know `rounded-nested` is a
   * border-radius: it keeps BOTH classes and the stylesheet order decides,
   * which meant a caller passing `rounded-none` silently lost. A prop cannot
   * lose that argument.
   */
  radius?: "nested" | "none";
  /** A next/image element. Omit to get the designed no-image state. */
  children?: React.ReactNode;
  className?: string;
}

export function LineFrame({
  width = "w-20",
  sku,
  state = "available",
  radius = "nested",
  children,
  className,
}: LineFrameProps) {
  return (
    <ImageFrame
      sku={sku}
      state={state}
      className={cn(
        "shrink-0 overflow-hidden",
        radius === "none" ? "rounded-none" : "rounded-nested",
        width,
        className,
      )}
    >
      {children}
    </ImageFrame>
  );
}
