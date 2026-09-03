import type { ProductStatus } from "@avenick/database";

/**
 * One product-status vocabulary for the whole catalog surface.
 *
 * The list and the edit page used to carry separate maps, which is how "Paused"
 * on one screen became "Inactive" on the next, and how the same state was drawn
 * amber in one place and yellow in the other. Typing the map against the enum
 * means a new status fails the build rather than rendering as a raw
 * SCREAMING_SNAKE token in front of a supplier.
 *
 * The words themselves live in the message catalog under
 * `sellerCatalog.status.<STATUS>` — this module is not a component and has no
 * translator in scope, so it hands back the KEY and the caller, which does have
 * one, resolves it. The tone stays here because it is a design decision, not a
 * translated string.
 *
 * The tone is the semantic pill tone, never a raw hue: four states, which is
 * what lets a table of forty rows stay calm.
 */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "accent" | "primary";

export interface StatusMeta {
  /**
   * Message key under the `sellerCatalog.status` namespace, or null for a
   * status nobody has labelled yet.
   */
  labelKey: string | null;
  /** What to show when there is no key — the raw status, made readable. */
  fallbackLabel: string;
  tone: StatusTone;
}

const STATUS_TONE: Record<ProductStatus, StatusTone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  // The seller pauses and resumes; the INACTIVE label reads "Paused", the verb
  // the bulk action and the CSV import both use, so the state is named after
  // the action that caused it.
  INACTIVE: "neutral",
  SUPPRESSED: "danger",
  SUSPENDED: "danger",
  REJECTED: "danger",
};

/**
 * The order a supplier reads their catalog in: what is live, then what is
 * waiting on someone, then what is theirs to finish, then what is stopped.
 */
export const STATUS_ORDER: ProductStatus[] = [
  "ACTIVE",
  "PENDING_REVIEW",
  "DRAFT",
  "INACTIVE",
  "REJECTED",
  "SUPPRESSED",
  "SUSPENDED",
];

/**
 * A row's status arrives as a string from the page's own query. An unmapped
 * value is shown as it is rather than dropped, because a status nobody has
 * labelled yet is still a fact about the listing.
 */
export function statusMeta(status: string): StatusMeta {
  // hasOwnProperty rather than `in`: `in` walks the prototype chain, so a row
  // carrying "toString" would be treated as a known status and asked for the
  // message key `status.toString`, which no catalog has.
  if (Object.prototype.hasOwnProperty.call(STATUS_TONE, status)) {
    return {
      labelKey: `status.${status}`,
      fallbackLabel: status,
      tone: STATUS_TONE[status as ProductStatus],
    };
  }
  return {
    labelKey: null,
    fallbackLabel: status.replace(/_/g, " ").toLowerCase(),
    tone: "neutral",
  };
}
