import type { PillTone } from "@avenick/ui";

/**
 * One order-status vocabulary for the whole fulfilment surface.
 *
 * The catalog surface already had this (components/products/status-meta.ts) and
 * it is why "Paused" means the same thing on the list and on the edit form. The
 * fulfilment surface did not: /orders/[id] carried an exhaustive map, the orders
 * TABLE carried a second one written in raw Tailwind hues (including a
 * `bg-amber-500/15 text-amber-600` that exists in no token and has no dark
 * counterpart), and the dashboard carried a third that collapsed nine states
 * into four. Three maps for one enum is how the same order reads "Out for
 * delivery" in one place and "OUT FOR DELIVERY" in another.
 *
 * NO DIRECTIVE IN THIS FILE, deliberately. Law 9: Next replaces every export of
 * a `"use client"` module with a client reference in the server graph, so a
 * server component calling a helper exported from one fails the production build
 * with a minified TypeError. `orderStatusMeta` is called from both sides.
 *
 * The tone is the semantic pill tone, never a raw hue. Four semantic states are
 * what let a table of fifty rows stay calm; ten hand-picked colours carrying no
 * extra information is the loudest amateur signal a console can send.
 */
export interface OrderStatusMeta {
  label: string;
  tone: PillTone;
}

const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
  PENDING_PAYMENT: { label: "Pending payment", tone: "neutral" },
  PAYMENT_CONFIRMED: { label: "Payment confirmed", tone: "accent" },
  CONFIRMED: { label: "Confirmed", tone: "accent" },
  PROCESSING: { label: "Processing", tone: "primary" },
  SHIPPED: { label: "Shipped", tone: "primary" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", tone: "warning" },
  DELIVERED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "danger" },
  RETURN_REQUESTED: { label: "Return requested", tone: "warning" },
  RETURNED: { label: "Returned", tone: "danger" },
};

/**
 * A status arrives as a string from the page's own query. An unmapped value is
 * shown as it is rather than dropped or relabelled: a state nobody has named yet
 * is still a fact about the order, and guessing a label for it would invite an
 * action the order may not be ready for.
 */
export function orderStatusMeta(status: string): OrderStatusMeta {
  return (
    ORDER_STATUS_META[status] ?? {
      label: status.replace(/_/g, " ").toLowerCase(),
      tone: "neutral",
    }
  );
}

/**
 * The fulfilment state machine, in the order the platform advances it — exactly
 * the sequence app/orders/actions.ts is permitted to move a seller's lines
 * through.
 *
 * It MIRRORS that action's ALLOWED tuple rather than importing it, and that is a
 * constraint rather than a choice: actions.ts is a `"use server"` module, so
 * every export it has becomes a server reference in a client graph and a client
 * component cannot read a plain constant out of it. The duplication is therefore
 * load-bearing and has to be kept in step by hand — if the action's ALLOWED list
 * changes, this one changes with it, or the progress rail on /orders/[id] draws a
 * machine the platform no longer runs.
 */
export const ORDER_STAGES = ["CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

/** Statuses that sit before the machine starts: the order exists but is not released. */
export const ORDER_PRE_RELEASE = new Set(["PENDING_PAYMENT", "PAYMENT_CONFIRMED"]);

/**
 * The channel an order came through, as a pill tone. B2B is the accent because
 * it is the account's own trade channel; B2C is neutral. Two tones, not two
 * brand hues — the channel is a fact, not a rank.
 */
export function orderChannelTone(type: string): PillTone {
  return type === "B2B" ? "accent" : "neutral";
}
