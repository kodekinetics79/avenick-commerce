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
 * The tone is the semantic pill tone, never a raw hue: four states, which is
 * what lets a table of forty rows stay calm.
 */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "accent" | "primary";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
}

const STATUS_META: Record<ProductStatus, StatusMeta> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_REVIEW: { label: "In review", tone: "warning" },
  ACTIVE: { label: "Active", tone: "success" },
  // The seller pauses and resumes; "Paused" is the verb the bulk action and the
  // CSV import both use, so the state is named after the action that caused it.
  INACTIVE: { label: "Paused", tone: "neutral" },
  SUPPRESSED: { label: "Suppressed", tone: "danger" },
  SUSPENDED: { label: "Suspended by platform", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "danger" },
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
  return (
    STATUS_META[status as ProductStatus] ?? {
      label: status.replace(/_/g, " ").toLowerCase(),
      tone: "neutral",
    }
  );
}
